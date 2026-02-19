
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './backend/src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, 'backend/.env') });

async function checkRecent() {
    try {
        const today = new Date().toISOString().split('T')[0];
        console.log(`--- Checking for records from: ${today} ---`);

        const faculty = await query('SELECT id, name, email, created_at FROM faculty WHERE created_at >= ?', [today]);
        const users = await query('SELECT id, email, role, status, created_at FROM users WHERE created_at >= ?', [today]);

        console.log('--- RECENT_DATA_START ---');
        console.log(JSON.stringify({ faculty, users, count: { faculty: faculty.length, users: users.length } }, null, 2));
        console.log('--- RECENT_DATA_END ---');

        if (faculty.length === 0) {
            console.log('ℹ️ No faculty records found for today.');
        }

    } catch (error) {
        console.error('❌ Error checking database:', error);
    }
}

checkRecent();
