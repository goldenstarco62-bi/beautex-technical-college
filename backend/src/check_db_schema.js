import 'dotenv/config';
import { query } from './config/database.js';

async function checkSchema() {
    try {
        console.log('--- Faculty Columns ---');
        const facultyCols = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'faculty'
        `);
        console.table(facultyCols);

        console.log('--- Students Columns ---');
        const studentCols = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'students'
        `);
        console.table(studentCols);

        console.log('--- Users Columns ---');
        const userCols = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        `);
        console.table(userCols);

        console.log('--- Last 5 Users ---');
        const users = await query('SELECT email, role, must_change_password FROM users LIMIT 5');
        console.table(users);

    } catch (err) {
        console.error('Error checking schema:', err);
    }
    process.exit(0);
}

checkSchema();
