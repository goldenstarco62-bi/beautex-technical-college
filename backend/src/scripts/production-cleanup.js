import 'dotenv/config';
import pg from 'pg';

async function cleanupProductionDb() {
    const { Pool } = pg;
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('🧹 Starting Database Cleanup for Production Ready State...');

        // 1. Clear core entity tables
        console.log('📡 Cleaning up Students, Faculty, and Users...');
        await pool.query('DELETE FROM users WHERE email NOT IN (\'admin@beautex.edu\', \'beautexcollege01@gmail.com\')');
        await pool.query('DELETE FROM students');
        await pool.query('DELETE FROM faculty');

        // 2. Clear academic and communication tables
        console.log('📢 Cleaning up Announcements and Materials...');
        await pool.query('DELETE FROM announcements');
        await pool.query('DELETE FROM course_materials');

        // 3. Clear activity and financial logs
        console.log('📋 Cleaning up Attendance, Grades, and Finance...');
        await pool.query('DELETE FROM attendance');
        await pool.query('DELETE FROM grades');
        await pool.query('DELETE FROM payments');
        await pool.query('DELETE FROM student_fees');
        await pool.query('DELETE FROM academic_reports');
        await pool.query('DELETE FROM audit_logs');

        console.log('\n✅ Database cleanup complete!');
        console.log('✨ All demo data and announcements have been wiped.');
        console.log('👤 Only the primary Admin accounts have been preserved for initial setup.');

    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
    } finally {
        await pool.end();
    }
}

cleanupProductionDb();
