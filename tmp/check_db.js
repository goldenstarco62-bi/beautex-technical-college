
import { getDb, query, initializeDatabase } from '../backend/src/config/database.js';

async function checkTables() {
    try {
        await initializeDatabase();
        const tables = await query("SELECT name FROM sqlite_master WHERE type='table'");
        console.log('Tables in database:', tables.map(t => t.name).join(', '));

        const schema = await query("PRAGMA table_info('student_daily_reports')");
        if (schema.length > 0) {
            console.log('student_daily_reports columns:', schema.map(c => c.name).join(', '));
        } else {
            console.log('student_daily_reports table DOES NOT EXIST!');
        }
    } catch (err) {
        console.error('Error checking tables:', err);
    } finally {
        process.exit();
    }
}

checkTables();
