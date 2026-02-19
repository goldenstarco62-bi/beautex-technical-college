import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');

async function verifyPasswords() {
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const users = await db.all('SELECT email, password, role FROM users');
    console.log(`🔍 Checking ${users.length} users...\n`);

    for (const user of users) {
        const matches = await bcrypt.compare('admin123', user.password);
        if (matches) {
            console.log(`✅ ${user.email} (${user.role}): OK`);
        } else {
            console.log(`❌ ${user.email} (${user.role}): FAIL`);
        }
    }

    await db.close();
}

verifyPasswords().catch(console.error);
