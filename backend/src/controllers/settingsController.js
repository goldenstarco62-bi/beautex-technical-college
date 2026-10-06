import { getDb, query } from '../config/database.js';
import memoryCache from '../utils/cache.js';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../database.sqlite');

export async function getSettings(req, res) {
    try {
        const cached = memoryCache.get('system_settings');
        if (cached) {
            return res.json(cached);
        }

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

        memoryCache.set('system_settings', settingsObj, 60000);
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
        res.download(dbPath, 'college_cms_backup_' + new Date().toISOString().split('T')[0] + '.sqlite');
    } catch (error) {
        logger.error('Error downloading backup:', error);
        res.status(500).json({ error: 'Failed to download backup' });
    }
}

export async function exportFullBackup(req, res) {
    try {
        const tables = [
            'users', 'students', 'courses', 'faculty', 'attendance',
            'cat_results', 'cat_periods', 'course_units', 'payments',
            'student_fees', 'system_settings'
        ];

        const backupData = {
            version: '1.0.0',
            exported_at: new Date().toISOString(),
            exported_by: req.user?.email || req.user?.id,
            data: {}
        };

        for (const table of tables) {
            try {
                const rows = await query(`SELECT * FROM ${table}`);
                backupData.data[table] = rows || [];
            } catch (err) {
                backupData.data[table] = [];
            }
        }

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

        if (!backupData.data || typeof backupData.data !== 'object') {
            return res.status(400).json({ error: 'Invalid backup file format.' });
        }

        const { withTransaction, run } = await import('../config/database.js');
        const data = backupData.data;

        await withTransaction(async () => {
            // Restore system settings
            if (Array.isArray(data.system_settings)) {
                for (const row of data.system_settings) {
                    if (row.key && row.value !== undefined) {
                        await run(
                            'INSERT INTO system_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value',
                            [row.key, String(row.value)]
                        ).catch(() => {});
                    }
                }
            }

            // Restore students
            if (Array.isArray(data.students)) {
                for (const s of data.students) {
                    if (s.id && s.name && s.email) {
                        await run(
                            `INSERT INTO students (id, name, email, course, intake, gpa, status, contact, photo, dob, address, guardian_name, guardian_contact, blood_group, id_status, passport_status)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                             ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name, email=EXCLUDED.email, course=EXCLUDED.course, status=EXCLUDED.status`,
                            [s.id, s.name, s.email, typeof s.course === 'object' ? JSON.stringify(s.course) : (s.course || 'General'), s.intake || null, s.gpa || 0, s.status || 'Active', s.contact || null, s.photo || null, s.dob || null, s.address || null, s.guardian_name || null, s.guardian_contact || null, s.blood_group || null, s.id_status || 'Not Generated', s.passport_status || 'Not Generated']
                        ).catch(() => {});
                    }
                }
            }

            const memoryCache = (await import('../utils/cache.js')).default;
            memoryCache.flush();
        });

        res.json({ message: 'Database backup restored successfully!' });
    } catch (error) {
        logger.error('Restore backup error:', error);
        res.status(500).json({ error: 'Failed to restore database backup: ' + error.message });
    }
}

