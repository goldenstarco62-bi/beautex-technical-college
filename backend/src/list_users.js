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
        console.log('All Users:');
        console.table(res.rows);
    } finally {
        await pool.end();
    }
}

list();
