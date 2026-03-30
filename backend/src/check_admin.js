import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

async function check() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const res = await pool.query("SELECT id, email, role, status, last_login, must_change_password FROM users WHERE role IN ('admin', 'superadmin')");
        console.log('Admin Users:');
        res.rows.forEach(user => {
            console.log(`- ${user.email} (Role: ${user.role}, Status: ${user.status}, MustChange: ${user.must_change_password})`);
        });
    } finally {
        await pool.end();
    }
}

check();
