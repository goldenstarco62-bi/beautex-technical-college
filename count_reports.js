import { query } from './backend/src/config/database.js';
import 'dotenv/config';

async function check() {
    try {
        const res = await query('SELECT COUNT(*) as count FROM daily_activity_reports');
        console.log('Daily Reports Count:', res);
        
        const latest = await query('SELECT id, report_date, department FROM daily_activity_reports ORDER BY report_date DESC LIMIT 5');
        console.log('Latest Reports:', latest);
    } catch (e) {
        console.error(e);
    }
}

check();
