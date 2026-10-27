import { getDb, query, getActiveDbEngine } from '../config/database.js';
import memoryCache from '../utils/cache.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../database.sqlite');

// Keys that only Super Admin may read or modify (credentials, integration keys,
// security policy). Read path masks them; write path drops them.
export const SENSITIVE_KEYS = [
    'mpesa_consumer_key', 'mpesa_consumer_secret', 'mpesa_passkey', 'mpesa_shortcode', 'mpesa_callback_url', 'mpesa_status',
    'sms_api_key', 'sms_username', 'sms_sender_id',
    'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure',
    'google_calendar_api_key', 'zoom_api_key', 'google_meet_api_key',
    'backup_interval', 'backup_types',
    'password_policy_min_len', 'password_policy_require_special', 'two_factor_auth', 'session_timeout', 'failed_login_attempts',
    'activity_monitoring_enabled'
];

function isSuperAdmin(user) {
    const role = (user?.role || '').toLowerCase().replace(/[\s_]/g, '');
    return role === 'superadmin';
}

export async function getSettings(req, res) {
    try {
        let settingsObj = memoryCache.get('system_settings');
        if (!settingsObj) {
            const settings = await query('SELECT * FROM system_settings');

            // Convert array to object
            settingsObj = settings.reduce((acc, curr) => {
                acc[curr.key] = curr.value;
                // Parse booleans
                if (curr.value === 'true') acc[curr.key] = true;
                else if (curr.value === 'false') acc[curr.key] = false;
                else acc[curr.key] = curr.value;
                return acc;
            }, {});

            memoryCache.set('system_settings', settingsObj, 60000);
        }

        if (isSuperAdmin(req.user)) {
            return res.json(settingsObj);
        }
        const masked = { ...settingsObj };
        for (const key of SENSITIVE_KEYS) masked[key] = '';
        res.json(masked);
    } catch (error) {
        logger.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
}

export async function updateSettings(req, res) {
    try {
        const db = await getDb();
        const settings = req.body;
        const isPostgres = !!process.env.DATABASE_URL;

        if (!isSuperAdmin(req.user)) {
            logger.warn(`Non-superadmin user ${req.user?.email} attempted to update settings. Filtering out sensitive keys.`);
            for (const key of SENSITIVE_KEYS) {
                delete settings[key];
            }
        }

        const entries = Object.entries(settings);
        const pairs = entries.map(([key, value]) => [
            key,
            typeof value === 'boolean' ? value.toString() : (value ?? '')
        ]);

        if (isPostgres) {
            // PostgreSQL: single bulk upsert via unnest()
            const keys   = pairs.map(p => p[0]);
            const values = pairs.map(p => p[1]);
            await db.query(
                `INSERT INTO system_settings (key, value, updated_at)
                 SELECT unnest($1::text[]), unnest($2::text[]), CURRENT_TIMESTAMP
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
                [keys, values]
            );
        } else {
            // SQLite: single INSERT OR REPLACE with all rows in one statement
            if (pairs.length === 0) { res.json({ message: 'Settings updated successfully' }); return; }
            const placeholders = pairs.map(() => '(?, ?, CURRENT_TIMESTAMP)').join(', ');
            const flatValues   = pairs.flatMap(p => p);
            await db.run('BEGIN TRANSACTION');
            await db.run(
                `INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ${placeholders}`,
                flatValues
            );
            await db.run('COMMIT');
        }

        memoryCache.del('system_settings');
        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        logger.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
}

export async function uploadFileSetting(req, res) {
    try {
        const { key } = req.body;
        if (!key) {
            return res.status(400).json({ error: 'Setting key is required.' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'File is required.' });
        }

        const mime_type = req.file.mimetype;
        const b64 = req.file.buffer.toString('base64');
        const file_url = `data:${mime_type};base64,${b64}`;

        const db = await getDb();
        const isPostgres = !!process.env.DATABASE_URL;

        if (isPostgres) {
            await db.query(
                `INSERT INTO system_settings (key, value, updated_at) 
                 VALUES ($1, $2, CURRENT_TIMESTAMP)
                 ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
                [key, file_url]
            );
        } else {
            await db.run(`
                INSERT OR REPLACE INTO system_settings (key, value, updated_at) 
                VALUES (?, ?, CURRENT_TIMESTAMP)
            `, [key, file_url]);
        }

        logger.info(`File uploaded successfully for setting key: ${key}`);
        memoryCache.del('system_settings');
        res.json({ message: 'File uploaded successfully', key, value: file_url });
    } catch (error) {
        logger.error('Error uploading setting file:', error);
        res.status(500).json({ error: 'Failed to upload setting file' });
    }
}

export async function downloadBackup(req, res) {
    try {
        // No SQLite file exists on a Postgres deployment — serve the full JSON export instead.
        if (getActiveDbEngine() === 'postgres') {
            return exportFullBackup(req, res);
        }
        if (!fs.existsSync(dbPath)) {
            return res.status(404).json({ error: 'SQLite database file not found on this deployment.' });
        }
        res.download(dbPath, 'college_cms_backup_' + new Date().toISOString().split('T')[0] + '.sqlite', (err) => {
            if (err) logger.error('Error streaming SQLite backup:', err);
        });
    } catch (error) {
        logger.error('Error downloading backup:', error);
        res.status(500).json({ error: 'Failed to download backup' });
    }
}

export async function exportFullBackup(req, res) {
    try {
        // Discover tables from the live catalog so backups never miss new tables.
        let tables;
        if (getActiveDbEngine() === 'postgres') {
            tables = (await query(
                `SELECT table_name AS name FROM information_schema.tables
                 WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                 ORDER BY table_name`
            )).map(r => r.name);
        } else {
            tables = (await query(
                `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
            )).map(r => r.name);
        }

        const backupData = {
            version: '2.0.0',
            engine: getActiveDbEngine(),
            exported_at: new Date().toISOString(),
            exported_by: req.user?.email || req.user?.id,
            tables: tables.length,
            data: {}
        };

        const failed = [];
        for (const table of tables) {
            try {
                const rows = await query(`SELECT * FROM "${table}"`);
                backupData.data[table] = rows || [];
            } catch (err) {
                logger.warn(`Backup: failed to export table "${table}": ${err.message}`);
                backupData.data[table] = [];
                failed.push(table);
            }
        }
        backupData.failed_tables = failed;

        const fileName = `beautex_cms_backup_${new Date().toISOString().split('T')[0]}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.status(200).send(JSON.stringify(backupData, null, 2));
    } catch (error) {
        logger.error('Export backup error:', error);
        res.status(500).json({ error: 'Failed to generate database backup' });
    }
}

export async function restoreFullBackup(req, res) {
    try {
        let backupData;
        if (req.file) {
            backupData = JSON.parse(req.file.buffer.toString('utf-8'));
        } else if (req.body?.data) {
            backupData = req.body;
        } else {
            return res.status(400).json({ error: 'Backup data file or payload is required.' });
        }

        if (!backupData.data || typeof backupData.data !== 'object' || Array.isArray(backupData.data)) {
            return res.status(400).json({ error: 'Invalid backup file format.' });
        }

        const { restoreBackupData } = await import('../utils/backupRestore.js');
        const report = await restoreBackupData(backupData.data);

        const memoryCache = (await import('../utils/cache.js')).default;
        memoryCache.flush();
        logger.info({ by: req.user?.email, restored: report.restored.length, failed: report.failed.length }, 'database backup restored');
        res.json({ message: 'Database backup restored successfully', report });
    } catch (error) {
        logger.error('Restore backup error:', error);
        res.status(500).json({ error: 'Failed to restore database backup — changes rolled back', detail: error.message });
    }
}

// ── Integration / system status probes ───────────────────────────────────────
// GET /settings/integrations/status?gateway=mpesa&live=1
// Without `gateway` all integrations are reported; without `live` only fast,
// local checks run (DB ping + "credential present"). `live=1` performs ONE
// read-only outbound probe per requested gateway (no sends, no charges).
// Responses never contain credential values — only status + message.

const INTEGRATION_GATEWAYS = ['database', 'sms', 'email', 'mpesa', 'google_calendar', 'zoom', 'google_meet'];

const withTimeout = (promise, ms, label) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
]);

async function rawSettingsMap() {
    const rows = await query("SELECT key, value FROM system_settings");
    const map = {};
    for (const r of rows || []) map[r.key] = String(r.value ?? '').trim();
    return map;
}

async function probeDatabase() {
    const t0 = Date.now();
    try {
        await withTimeout(query('SELECT 1 AS ping'), 5000, 'Database ping');
        return { status: 'online', message: `${getActiveDbEngine()} responded in ${Date.now() - t0}ms` };
    } catch (err) {
        return { status: 'offline', message: String(err.message || err).slice(0, 160) };
    }
}

async function probeSms(live) {
    const { getGatewayConfig } = await import('../services/smsService.js');
    const cfg = await getGatewayConfig();
    if (!cfg.apiKey || !cfg.username) {
        return { status: 'not_configured', message: 'Africa\'s Talking API key/username not set (Settings or environment).' };
    }
    if (!live) return { status: 'configured', message: 'Credentials saved — not live-tested.' };
    try {
        const AfricasTalking = (await import('africastalking')).default;
        const client = AfricasTalking({ apiKey: cfg.apiKey, username: cfg.username });
        await withTimeout(client.ACCOUNT.fetchAccount(), 8000, 'Africa\'s Talking');
        return { status: 'connected', message: 'Africa\'s Talking accepted the saved credentials (account read OK).' };
    } catch (err) {
        return { status: 'error', message: `Gateway rejected credentials or unreachable: ${String(err.message || err).slice(0, 140)}` };
    }
}

async function probeEmail(live) {
    // Same resolution order the mail service uses: Settings rows first, env fallback.
    const { getSmtpConfig } = await import('../services/emailService.js');
    const cfg = await getSmtpConfig();
    if (!cfg.user || !cfg.pass) {
        return { status: 'not_configured', message: 'No SMTP credentials saved in Settings and no SMTP_USER/SMTP_PASS in the environment.' };
    }
    if (!live) return { status: 'configured', message: `SMTP credentials present for ${cfg.user} via ${cfg.host}:${cfg.port} — not live-tested.` };
    try {
        const nodemailer = (await import('nodemailer')).default;
        const transporter = nodemailer.createTransport({
            host: cfg.host, port: cfg.port, secure: cfg.secure, requireTLS: !cfg.secure,
            connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 8000,
            auth: { user: cfg.user, pass: cfg.pass }
        });
        await withTimeout(transporter.verify(), 10000, 'SMTP verify');
        transporter.close?.();
        return { status: 'connected', message: `SMTP login OK for ${cfg.user} (no mail sent).` };
    } catch (err) {
        return { status: 'error', message: `SMTP handshake failed: ${String(err.message || err).slice(0, 140)}` };
    }
}

async function probeMpesa(live) {
    const s = await rawSettingsMap();
    const key = s.mpesa_consumer_key, secret = s.mpesa_consumer_secret;
    if (!key || !secret || /^\*+$/.test(key) || /^\*+$/.test(secret)) {
        return { status: 'not_configured', message: 'Daraja consumer key/secret not saved in Settings.' };
    }
    if (!live) return { status: 'configured', message: 'Daraja credentials saved — not live-tested.' };
    try {
        const resp = await withTimeout(
            fetch('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
                headers: { Authorization: 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64') }
            }), 8000, 'Daraja OAuth');
        const body = await resp.json().catch(() => ({}));
        if (resp.ok && body.access_token) {
            return { status: 'connected', message: 'Safaricom Daraja sandbox issued an access token (key/secret valid).' };
        }
        return { status: 'error', message: `Daraja sandbox responded ${resp.status}: ${String(body.errorMessage || 'invalid credentials').slice(0, 120)}` };
    } catch (err) {
        return { status: 'error', message: `Daraja unreachable: ${String(err.message || err).slice(0, 140)}` };
    }
}

async function probeKeyBased(settingKey, label) {
    const s = await rawSettingsMap();
    const val = s[settingKey];
    if (!val || /^\*+$/.test(val)) {
        return { status: 'not_configured', message: `${label} key not saved in Settings.` };
    }
    return { status: 'configured', message: `${label} credential saved — live handshake not supported for this key type.` };
}

export async function getIntegrationStatus(req, res) {
    try {
        const gateway = String(req.query.gateway || '').toLowerCase();
        const live = req.query.live === '1' || req.query.live === 'true';
        if (gateway && !INTEGRATION_GATEWAYS.includes(gateway)) {
            return res.status(400).json({ error: `Unknown gateway. Expected one of: ${INTEGRATION_GATEWAYS.join(', ')}` });
        }
        const targets = gateway ? [gateway] : INTEGRATION_GATEWAYS;
        const results = {};
        for (const g of targets) {
            if (g === 'database') results[g] = await probeDatabase();
            else if (g === 'sms') results[g] = await probeSms(live);
            else if (g === 'email') results[g] = await probeEmail(live);
            else if (g === 'mpesa') results[g] = await probeMpesa(live);
            else if (g === 'google_calendar') results[g] = await probeKeyBased('google_calendar_api_key', 'Google Calendar');
            else if (g === 'zoom') results[g] = await probeKeyBased('zoom_api_key', 'Zoom');
            else if (g === 'google_meet') results[g] = await probeKeyBased('google_meet_api_key', 'Google Meet');
        }
        res.json({ checked_at: new Date().toISOString(), live, results });
    } catch (error) {
        logger.error('Integration status error:', error);
        res.status(500).json({ error: 'Failed to compute integration status' });
    }
}


// KPI counts for the Settings dashboard. Same tables the management pages list
// from, so the cards never drift from those lists. A null count means the
// table query failed — the frontend shows "—" rather than a fake zero.
export async function getDashboardStats(req, res) {
    try {
        const count = async (sql) => {
            try {
                const rows = await query(sql);
                return parseInt(rows[0]?.count, 10);
            } catch (err) {
                logger.warn(`dashboard-stats count failed: ${err.message}`);
                return null;
            }
        };
        const [programs, courses, students, staff, active_portals] = await Promise.all([
            count('SELECT COUNT(*) as count FROM departments'),
            count('SELECT COUNT(*) as count FROM courses'),
            count('SELECT COUNT(*) as count FROM students'),
            count('SELECT COUNT(*) as count FROM faculty'),
            count("SELECT COUNT(*) as count FROM users WHERE LOWER(role) = 'student' AND UPPER(status) = 'ACTIVE'"),
        ]);
        res.json({ programs, courses, students, staff, active_portals, checked_at: new Date().toISOString() });
    } catch (error) {
        logger.error({ err: error }, 'getDashboardStats: unhandled error');
        res.status(500).json({ error: 'Failed to compute dashboard statistics' });
    }
}
