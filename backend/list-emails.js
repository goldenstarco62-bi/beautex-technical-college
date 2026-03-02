
import { query } from './src/config/database.js';
import dotenv from 'dotenv';
dotenv.config();

async function showAllEmails() {
    try {
        const rows = await query("SELECT email FROM users");
        console.log(`Checking ${rows.length} emails...`);
        rows.forEach((r, i) => {
            console.log(`${i + 1}: [${r.email}] (Length: ${r.email ? r.email.length : 0})`);
        });
    } catch (err) {
        console.error(err.message);
    }
    process.exit();
}

showAllEmails();
