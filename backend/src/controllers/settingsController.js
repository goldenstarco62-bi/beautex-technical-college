import { getDb, query } from '../config/database.js';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../database.sqlite');

export async function getSettings(req, res) {
    try {
        const settings = await query('SELECT * FROM system_settings');

        // Convert array to object
        const settingsObj = settings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            // Parse booleans
            if (curr.value === 'true') acc[curr.key] = true;
            else if (curr.value === 'false') acc[curr.key] = false;
            else acc[curr.key] = curr.value;
            return acc;
        }, {});

        res.json(settingsObj);
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
        const userRole = (req.user?.role || '').toLowerCase().trim();

        // Sensitive keys that only Super Admin is allowed to modify
        const sensitiveKeys = [
            'mpesa_consumer_key', 'mpesa_consumer_secret', 'mpesa_passkey', 'mpesa_shortcode', 'mpesa_callback_url', 'mpesa_status',
            'sms_api_key', 'sms_username', 'sms_sender_id',
            'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_secure',
            'google_calendar_api_key', 'zoom_api_key', 'google_meet_api_key',
            'backup_interval', 'backup_types',
            'password_policy_min_len', 'password_policy_require_special', 'two_factor_auth', 'session_timeout', 'failed_login_attempts',
            'activity_monitoring_enabled'
        ];

        if (userRole === 'admin') {
            logger.warn(`Admin user ${req.user.email} attempted to update settings. Filtering out sensitive keys.`);
            for (const key of sensitiveKeys) {
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
        res.json({ message: 'File uploaded successfully', key, value: file_url });
    } catch (error) {
        logger.error('Error uploading setting file:', error);
        res.status(500).json({ error: 'Failed to upload setting file' });
    }
}

export async function downloadBackup(req, res) {
    try {
        res.download(dbPath, 'college_cms_backup_' + new Date().toISOString().split('T')[0] + '.sqlite');
    } catch (error) {
        logger.error('Error downloading backup:', error);
        res.status(500).json({ error: 'Failed to download backup' });
    }
}
