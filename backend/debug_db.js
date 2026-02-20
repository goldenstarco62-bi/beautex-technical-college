import 'dotenv/config';
import { getDb } from './src/config/database.js';

async function test() {
    try {
        const db = await getDb();
        console.log('Testing connection...');
        const result = await db.query('SELECT 1+1 AS result');
        console.log('Result:', result.rows);
    } catch (err) {
        console.error('ERROR MESSAGE:', err.message);
        console.error('ERROR CODE:', err.code);
        console.error('FULL ERROR:', JSON.stringify(err, null, 2));
    }
    process.exit();
}
test();
