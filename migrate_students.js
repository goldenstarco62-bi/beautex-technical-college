import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'backend/database.sqlite');

async function migrate() {
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const columns = ['dob', 'address', 'guardian_name', 'guardian_contact', 'blood_group'];

    for (const col of columns) {
        try {
            await db.run(`ALTER TABLE students ADD COLUMN ${col} TEXT`);
            console.log(`✅ Added column: ${col}`);
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log(`ℹ️ Column ${col} already exists`);
            } else {
                console.error(`❌ Error adding ${col}:`, error.message);
            }
        }
    }
    await db.close();
}

migrate();
