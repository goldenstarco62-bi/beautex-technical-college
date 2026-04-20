import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

const pool = new Pool({
    connectionString: 'postgresql://postgres.yvuzwapppawempxnhnvd:Pssw0rd@2026@aws-1-eu-west-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const client = await pool.connect();
        console.log('🐘 Connected to PostgreSQL');
        
        const countRes = await client.query('SELECT COUNT(*) FROM daily_activity_reports');
        console.log('Total Daily Reports:', countRes.rows[0].count);
        
        const reports = await client.query('SELECT id, report_date, department FROM daily_activity_reports ORDER BY report_date DESC');
        console.log('All Daily Reports:', reports.rows);
        
        const constraints = await client.query(`
            SELECT conname, contype, pg_get_constraintdef(c.oid) 
            FROM pg_constraint c 
            JOIN pg_namespace n ON n.oid = c.connamespace 
            WHERE conrelid = 'daily_activity_reports'::regclass
        `);
        console.log('Constraints:', constraints.rows);
        
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}

check();
