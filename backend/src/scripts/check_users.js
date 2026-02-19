import pg from 'pg';

const connectionString = "postgresql://postgres:Pssw0rd%40201@db.nbkbuodflizorcscvdac.supabase.co:5432/postgres";

async function checkUsers() {
    const pool = new pg.Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🐘 Connecting to Supabase...');
        const res = await pool.query('SELECT COUNT(*) FROM users');
        console.log('👥 User count:', res.rows[0].count);
    } catch (error) {
        console.error('❌ Check failed:', error.message);
    } finally {
        await pool.end();
    }
}

checkUsers();
