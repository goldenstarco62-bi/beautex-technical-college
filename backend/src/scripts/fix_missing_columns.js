
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, run } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function migrate() {
    try {
        console.log('🚀 Starting migration: Fixing missing columns in users and faculty tables...');
        const db = await getDb();
        const isMongo = db.constructor.name === 'NativeConnection';

        if (isMongo) {
            console.log('ℹ️ MongoDB detected. Skipping SQL migration.');
            return;
        }

        const isPg = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgres');

        if (isPg) {
            console.log('🐘 Migrating PostgreSQL (Supabase)...');
            try {
                // Faculty Table
                await run('ALTER TABLE faculty ADD COLUMN IF NOT EXISTS position TEXT;');
                await run('ALTER TABLE faculty ADD COLUMN IF NOT EXISTS specialization TEXT;');
                await run('ALTER TABLE faculty ADD COLUMN IF NOT EXISTS photo TEXT;');

                // Users Table
                await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT;');

                console.log('✅ PostgreSQL columns added or already exist.');
            } catch (err) {
                console.error('❌ PostgreSQL Migration Error:', err.message);
            }
        } else {
            console.log('📂 Migrating local SQLite...');
            const columnsToAdd = [
                { table: 'faculty', column: 'position', type: 'TEXT' },
                { table: 'faculty', column: 'specialization', type: 'TEXT' },
                { table: 'faculty', column: 'photo', type: 'TEXT' },
                { table: 'users', column: 'photo', type: 'TEXT' }
            ];

            for (const item of columnsToAdd) {
                try {
                    await run(`ALTER TABLE ${item.table} ADD COLUMN ${item.column} ${item.type};`);
                    console.log(`✅ SQLite column "${item.column}" added to "${item.table}".`);
                } catch (err) {
                    if (err.message.includes('duplicate column name')) {
                        console.log(`ℹ️ SQLite column "${item.column}" already exists in "${item.table}".`);
                    } else {
                        console.error(`❌ SQLite Migration Error (${item.table}.${item.column}):`, err.message);
                    }
                }
            }
        }

        console.log('🎉 Migration complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Unexpected Migration Error:', error);
        process.exit(1);
    }
}

migrate();
