
import { queryOne } from '../backend/src/config/database.js';
// Don't load .env, so it defaults to SQLite
async function check() {
    process.env.DATABASE_URL = '';
    process.env.MONGODB_URI = '';
    try {
        const r = await queryOne('SELECT COUNT(*) as count FROM payments');
        console.log('--- LOCAL SQLITE STATUS ---');
        console.log(`Payment Records: ${r?.count || 0}`);
    } catch (err) {
        console.error('Check failed (sqlite):', err.message);
    } finally {
        process.exit();
    }
}
check();
