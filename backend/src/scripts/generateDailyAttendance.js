import { generateDailyAttendanceReports } from '../services/attendanceReportService.js';
import { initializeDatabase } from '../config/database.js';
import dotenv from 'dotenv';
import moment from 'moment';

dotenv.config();

/**
 * CLI Script to generate daily attendance reports
 * Usage: node src/scripts/generateDailyAttendance.js [YYYY-MM-DD]
 */
async function run() {
    try {
        console.log('🚀 Initializing system for report generation...');
        await initializeDatabase();

        const args = process.argv.slice(2);
        const date = args[0] || moment().format('YYYY-MM-DD');

        if (!moment(date, 'YYYY-MM-DD', true).isValid()) {
            console.error('❌ Invalid date format. Please use YYYY-MM-DD.');
            process.exit(1);
        }

        console.log(`📅 Generating reports for date: ${date}`);
        const reports = await generateDailyAttendanceReports(date);

        if (reports.length > 0) {
            console.log('✅ Success! Generated reports:');
            reports.forEach(r => console.log(`   - ${r.department}: ${r.fileName}`));
        } else {
            console.log('ℹ️ No reports generated (possibly no attendance records found).');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to run daily attendance report script:', error);
        process.exit(1);
    }
}

run();
