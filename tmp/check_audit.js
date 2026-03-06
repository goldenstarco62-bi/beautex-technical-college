
import { query } from '../backend/src/config/database.js';
import pkg from 'dotenv';
const { config } = pkg;
config({ path: './backend/.env' });

async function check() {
    try {
        const logs = await query("SELECT * FROM audit_logs WHERE action LIKE '%payment%' OR resource = 'payments' ORDER BY created_at DESC LIMIT 20");
        console.log('--- RECENT PAYMENT AUDIT LOGS ---');
        console.log(logs);
    } catch (err) {
        console.error('Audit log check failed:', err.message);
    } finally {
        process.exit();
    }
}
check();
