import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import dotenv from 'dotenv';
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL;

async function initializeSupabase() {
    if (!connectionString) {
        console.error('❌ DATABASE_URL not found in .env file');
        return;
    }

    const pool = new pg.Pool({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🐘 Connecting to Supabase...');
        const schema = fs.readFileSync(path.join(__dirname, '../models/supabase_schema.sql'), 'utf-8');

        console.log('🚀 Running schema initialization...');
        await pool.query(schema);
        console.log('✅ Schema initialized successfully!');

    } catch (error) {
        console.error('❌ Initialization failed:', error);
    } finally {
        await pool.end();
    }
}

initializeSupabase();
