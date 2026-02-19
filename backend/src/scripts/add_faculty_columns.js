
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, run } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function migrate() {
    try {
        console.log('🚀 Starting migration: Adding columns to faculty table...');
        const db = await getDb();
        const config = db.constructor.name === 'NativeConnection' ? 'mongo' : (process.env.DATABASE_URL ? 'pg' : 'sqlite');

        if (config === 'mongo') {
            console.log('ℹ️ MongoDB detected. Skipping SQL migration.');
            return;
        }

        if (config === 'pg') {
            console.log('🐘 Migrating PostgreSQL (Supabase)...');
            // Check if columns exist first to avoid errors
            try {
                await run('ALTER TABLE faculty ADD COLUMN IF NOT EXISTS position TEXT;');
                await run('ALTER TABLE faculty ADD COLUMN IF NOT EXISTS specialization TEXT;');
                console.log('✅ PostgreSQL columns added or already exist.');
            } catch (err) {
                console.error('❌ PostgreSQL Migration Error:', err.message);
            }
        } else {
            console.log('📂 Migrating local SQLite...');
            try {
                // SQLite doesn't support ADD COLUMN IF NOT EXISTS in all versions, 
                // so we catch the error if they already exist.
                await run('ALTER TABLE faculty ADD COLUMN position TEXT;');
                console.log('✅ SQLite column "position" added.');
            } catch (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log('ℹ️ SQLite column "position" already exists.');
                } else {
                    console.error('❌ SQLite Migration Error (position):', err.message);
                }
            }

            try {
                await run('ALTER TABLE faculty ADD COLUMN specialization TEXT;');
                console.log('✅ SQLite column "specialization" added.');
            } catch (err) {
                if (err.message.includes('duplicate column name')) {
                    console.log('ℹ️ SQLite column "specialization" already exists.');
                } else {
                    console.error('❌ SQLite Migration Error (specialization):', err.message);
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
