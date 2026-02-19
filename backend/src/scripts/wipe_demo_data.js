import { run } from '../config/database.js';

async function wipeDemoData() {
    console.log('🗑️  Permanently wiping all demo data and users...');
    try {
        const tables = [
            'attendance',
            'grades',
            'trainer_reports',
            'daily_activity_reports',
            'weekly_summary_reports',
            'monthly_summary_reports',
            'students',
            'faculty',
            'announcements',
            'sessions',
            'users'
        ];

        for (const table of tables) {
            console.log(`   Cleaning ${table}...`);
            await run(`DELETE FROM ${table}`);
        }

        console.log('✅ All tables cleared successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to wipe data:', error);
        process.exit(1);
    }
}

wipeDemoData();
