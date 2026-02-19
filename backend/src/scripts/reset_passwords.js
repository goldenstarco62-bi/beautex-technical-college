import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');

async function resetPasswords() {
    console.log('🔄 Resetting all user passwords to "admin123"...');

    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const hashedPassword = await bcrypt.hash('admin123', 10);

    const result = await db.run(
        'UPDATE users SET password = ?',
        [hashedPassword]
    );

    console.log(`✅ Success! Updated ${result.changes} users.`);
    console.log('👉 All accounts now use password: admin123');

    await db.close();
}

resetPasswords().catch(console.error);
