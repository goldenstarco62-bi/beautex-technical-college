import { getDb, run, query } from '../config/database.js';
import mongoose from 'mongoose';

async function wipeEverything() {
    console.log('🧹 Starting deep clean of all database tables/collections...');

    try {
        const db = await getDb();
        const isMongo = db.constructor.name === 'NativeConnection';
        const isPostgres = !!process.env.DATABASE_URL;

        if (isMongo) {
            console.log('🍃 MongoDB detected. Cleaning all collections...');
            const collections = await db.db.listCollections().toArray();
            for (const collection of collections) {
                console.log(`   Cleaning collection ${collection.name}...`);
                await db.db.collection(collection.name).deleteMany({});
            }
            console.log('✅ MongoDB collections cleared successfully!');
        } else {
            let tables = [];
            if (isPostgres) {
                // Get all user tables in PostgreSQL
                const result = await db.query(`
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_type = 'BASE TABLE'
                    AND table_name != 'spatial_ref_sys'
                `);
                tables = result.rows.map(r => r.table_name);
            } else {
                // Get all tables in SQLite
                const result = await query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
                tables = result.map(r => r.name);
            }

            console.log(`📋 Found ${tables.length} tables to clean.`);

            for (const table of tables) {
                try {
                    console.log(`   Cleaning ${table}...`);
                    if (isPostgres) {
                        await db.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
                    } else {
                        await run(`DELETE FROM ${table}`);
                        // Reset autoincrement in SQLite
                        await run(`DELETE FROM sqlite_sequence WHERE name = ?`, [table]).catch(() => { });
                    }
                } catch (err) {
                    console.warn(`⚠️ Warning: Could not clean table ${table}: ${err.message}`);
                }
            }
        }

        console.log('✅ Deep clean complete! All data has been wiped.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to wipe database:', error);
        process.exit(1);
    }
}

wipeEverything();
