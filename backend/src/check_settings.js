import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

async function check() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        const res = await pool.query("SELECT * FROM system_settings");
        console.table(res.rows);
    } finally {
        await pool.end();
    }
}

check();
