import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

async function list() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const res = await pool.query("SELECT email, role, status FROM users");
        console.log('--- USER LIST START ---');
        res.rows.forEach(u => console.log(`${u.email} | ${u.role} | ${u.status}`));
        console.log('--- USER LIST END ---');
    } finally {
        await pool.end();
    }
}

list();
