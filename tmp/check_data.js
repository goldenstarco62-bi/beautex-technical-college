
import { query } from '../backend/src/config/database.js';

async function checkData() {
    try {
        const attendance = await query("SELECT COUNT(*) as count FROM attendance");
        const reports = await query("SELECT COUNT(*) as count FROM student_daily_reports");

        console.log('Attendance Records:', attendance[0].count);
        console.log('Daily Reports:', reports[0].count);

        if (reports[0].count > 0) {
            const lastReport = await query("SELECT * FROM student_daily_reports ORDER BY created_at DESC LIMIT 1");
            console.log('Last Report:', JSON.stringify(lastReport[0], null, 2));
        }
    } catch (err) {
        console.error('Error checking data:', err);
    } finally {
        process.exit();
    }
}

checkData();
