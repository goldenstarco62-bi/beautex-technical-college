require('dotenv').config();
const { getDb } = require('./src/config/database.js');

async function test() {
    try {
        const db = await getDb();
        console.log('Database type:', db.constructor.name);
        if (db.constructor.name === 'Pool') {
            const res = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
            console.log('Tables:', res.rows.map(r => r.table_name));

            const dailyCheck = await db.query("SELECT * FROM information_schema.columns WHERE table_name = 'daily_activity_reports'");
            console.log('Daily Activity Reports Columns:', dailyCheck.rows.map(r => r.column_name));
        } else if (db.constructor.name === 'Database') {
            console.log('SQLite Database detected');
        } else {
            console.log('Other Database detected:', db.constructor.name);
        }
        process.exit(0);
    } catch (e) {
        console.error('Test failed:', e.message);
        process.exit(1);
    }
}
test();
