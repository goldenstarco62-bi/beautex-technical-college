import 'dotenv/config';
import pg from 'pg';

async function testConnection() {
    const connectionString = process.env.DATABASE_URL;
    console.log('Testing connection to:', connectionString ? connectionString.split('@')[1] : 'UNDEFINED');

    if (!connectionString) {
        console.error('ERROR: DATABASE_URL not found in environment');
        process.exit(1);
    }

    const pool = new pg.Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting...');
        const client = await pool.connect();
        console.log('Connected successfully!');
        const res = await client.query('SELECT current_database(), current_user');
        console.log('Query result:', res.rows[0]);
        client.release();
    } catch (err) {
        console.error('Connection failed:', err.message);
    } finally {
        await pool.end();
    }
}

testConnection();
