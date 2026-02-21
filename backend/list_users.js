import 'dotenv/config';
import { query } from './src/config/database.js';

async function listUsers() {
    try {
        const users = await query('SELECT id, email, role, status, must_change_password FROM users');
        console.log('USERS_START');
        console.log(JSON.stringify(users, null, 2));
        console.log('USERS_END');
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

listUsers();
