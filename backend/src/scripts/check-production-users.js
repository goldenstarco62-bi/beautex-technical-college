import 'dotenv/config';
import pg from 'pg';

async function checkUsers() {
    const { Pool } = pg;
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('🔍 Checking Users in Supabase...');
        const res = await pool.query('SELECT id, email, role, status FROM users');
        console.log('Users found:', res.rows);

        if (res.rows.length === 0) {
            console.log('⚠️ No users found! We need to seed the admin account.');
        }
    } catch (error) {
        console.error('❌ Check failed:', error.message);
    } finally {
        await pool.end();
    }
}

checkUsers();
