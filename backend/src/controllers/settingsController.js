import { getDb, query } from '../config/database.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../../database.sqlite');

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
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
}

export async function updateSettings(req, res) {
    try {
        const db = await getDb();
        const settings = req.body;
        const isPostgres = !!process.env.DATABASE_URL;

        if (isPostgres) {
            // PostgreSQL: use ON CONFLICT upsert
            for (const [key, value] of Object.entries(settings)) {
                let stringValue = value;
                if (typeof value === 'boolean') stringValue = value.toString();

                await db.query(
                    `INSERT INTO system_settings (key, value, updated_at) 
                     VALUES ($1, $2, CURRENT_TIMESTAMP)
                     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
                    [key, stringValue]
                );
            }
        } else {
            // SQLite: use INSERT OR REPLACE with transactions
            await db.run('BEGIN TRANSACTION');
            for (const [key, value] of Object.entries(settings)) {
                let stringValue = value;
                if (typeof value === 'boolean') stringValue = value.toString();

                await db.run(`
                    INSERT OR REPLACE INTO system_settings (key, value, updated_at) 
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                `, [key, stringValue]);
            }
            await db.run('COMMIT');
        }

        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
}

export async function downloadBackup(req, res) {
    try {
        res.download(dbPath, 'college_cms_backup_' + new Date().toISOString().split('T')[0] + '.sqlite');
    } catch (error) {
        console.error('Error downloading backup:', error);
        res.status(500).json({ error: 'Failed to download backup' });
    }
}
