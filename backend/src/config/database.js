import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pg from 'pg';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../database.sqlite');
const DATABASE_URL = process.env.DATABASE_URL;
const MONGODB_URI = process.env.MONGODB_URI;

const { Pool } = pg;

let db;
let pgPool;
let mongoConnection;

/**
 * Get database connection based on environment variables
 */
export async function getDb() {
    // 1. Check for MongoDB Atlas (Priority)
    if (MONGODB_URI) {
        if (!mongoConnection) {
            try {
                await mongoose.connect(MONGODB_URI);
                mongoConnection = mongoose.connection;
                console.log('🍃 Connected to MongoDB Atlas');
            } catch (err) {
                console.error('❌ MongoDB Connection Error:', err);
                throw err;
            }
        }
        return mongoConnection;
    }

    // 2. Check for PostgreSQL (Supabase)
    if (DATABASE_URL) {
        if (!pgPool) {
            pgPool = new Pool({
                connectionString: DATABASE_URL,
                ssl: { rejectUnauthorized: false }
            });
            pgPool.on('error', (err) => {
                console.error('Unexpected error on idle client', err);
            });
            console.log('🐘 Connected to Supabase (PostgreSQL)');
        }
        return pgPool;
    }

    // 3. Fallback to SQLite
    if (!db) {
        if (process.env.NODE_ENV === 'production') {
            console.warn('⚠️ WARNING: No MONGODB_URI or DATABASE_URL found in production environment.');
            console.warn('⚠️ Falling back to local SQLite. Data will NOT persist on Vercel.');
        }

        const sqlite3 = (await import('sqlite3')).default;
        const { open } = await import('sqlite');

        // Ensure directory exists for database file
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            console.log(`📁 Creating missing database directory: ${dbDir}`);
            fs.mkdirSync(dbDir, { recursive: true });
        }

        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        // Enable foreign keys
        await db.run('PRAGMA foreign_keys = ON');
        console.log('📂 Connected to local SQLite');
    }
    return db;
}

/**
 * Initialize database schema
 */
export async function initializeDatabase() {
    if (MONGODB_URI) {
        console.log('ℹ️ MongoDB detected. Schemas are handled by Mongoose models.');
        return;
    }

    // Read schema from SQL file
    const schemaPath = path.join(__dirname, '../models/schema.sql');
    if (!fs.existsSync(schemaPath)) {
        console.error('❌ Schema file not found at:', schemaPath);
        return;
    }

    let schema = fs.readFileSync(schemaPath, 'utf8');
    const database = await getDb();

    if (DATABASE_URL) {
        console.log('🐘 Initializing PostgreSQL schema...');
        // Basic SQLite -> Postgres translations
        const pgSchema = schema
            .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
            .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
            .replace(/DATETIME/gi, 'TIMESTAMP')
            .replace(/date\(\'now\'\)/gi, 'CURRENT_DATE')
            .replace(/BOOLEAN DEFAULT 1/gi, 'BOOLEAN DEFAULT TRUE')
            .replace(/BOOLEAN DEFAULT 0/gi, 'BOOLEAN DEFAULT FALSE')
            .replace(/INSERT OR IGNORE/gi, 'INSERT')
            .replace(/PRAGMA foreign_keys = ON;/gi, '');

        const statements = pgSchema.split(';').filter(s => s.trim().length > 0);
        for (let statement of statements) {
            try {
                await database.query(statement.trim());
            } catch (err) {
                const errMsg = err.message.toLowerCase();
                if (!errMsg.includes('already exists') &&
                    !errMsg.includes('already a primary key') &&
                    !errMsg.includes('duplicate key')) {
                    console.warn(`⚠️ Postgres Init Warning: ${err.message}`);
                }
            }
        }
        console.log('✅ PostgreSQL Schema checked/initialized');
        await runPostgresMigrations(database);
        return;
    }

    try {
        await database.exec(schema);
        console.log('✅ SQLite Database initialized successfully');
    } catch (error) {
        if (error.message.includes('already exists') || error.code === 'SQLITE_CONSTRAINT') {
            console.log('ℹ️ SQLite Database already initialized');
        } else {
            console.error('❌ SQLite Initialization Error:', error);
            throw error;
        }
    }

    // Auto-migration for must_change_password (SQLite)
    try {
        const tableInfo = await database.all("PRAGMA table_info(users)");
        const columnExists = tableInfo.some(col => col.name === 'must_change_password');
        if (!columnExists) {
            console.log('🔄 Applying migration: Adding must_change_password to SQLite users table...');
            await database.run('ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT 1');
            await database.run("UPDATE users SET must_change_password = 0 WHERE role IN ('superadmin', 'admin')");
            console.log('✅ Migration applied successfully');
        }
    } catch (err) {
        console.error('⚠️ Migration warning:', err.message);
    }
}

async function runPostgresMigrations(database) {
    try {
        // Check for 'name' column in users table
        const checkNameCol = await database.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='name'
        `);

        if (checkNameCol.rows.length === 0) {
            console.log('🔄 Applying migration: Adding name column to Postgres users table...');
            await database.query('ALTER TABLE users ADD COLUMN name TEXT');
            console.log('✅ name column migration applied');
        }

        // Check for must_change_password column
        const checkCol = await database.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='users' AND column_name='must_change_password'
        `);

        if (checkCol.rows.length === 0) {
            console.log('🔄 Applying migration: Adding must_change_password to Postgres users table...');
            await database.query('ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT TRUE');
            await database.query("UPDATE users SET must_change_password = FALSE WHERE role IN ('superadmin', 'admin')");
            console.log('✅ Migration applied successfully');
        }
    } catch (err) {
        console.error('⚠️ Postgres migration warning:', err.message);
    }
}

/**
 * Generic query function
 */
export async function query(sql, params = []) {
    const database = await getDb();
    if (DATABASE_URL) {
        let paramCount = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++paramCount}`);
        const result = await database.query(pgSql, params);
        return result.rows;
    }
    return database.all(sql, params);
}

/**
 * Generic query one function
 */
export async function queryOne(sql, params = []) {
    const database = await getDb();
    if (DATABASE_URL) {
        let paramCount = 0;
        const pgSql = sql.replace(/\?/g, () => `$${++paramCount}`);
        const result = await database.query(pgSql, params);
        return result.rows[0];
    }
    return database.get(sql, params);
}

/**
 * Generic run function for write operations
 */
export async function run(sql, params = []) {
    const database = await getDb();
    if (DATABASE_URL) {
        let paramCount = 0;
        let pgSql = sql.replace(/\?/g, () => `$${++paramCount}`);

        pgSql = pgSql.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO');

        if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.toLowerCase().includes('on conflict')) {
            const lowerPgSql = pgSql.toLowerCase();
            if (lowerPgSql.includes('insert into users')) {
                pgSql += ' ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, must_change_password = EXCLUDED.must_change_password, status = EXCLUDED.status';
            } else if (lowerPgSql.includes('students') || lowerPgSql.includes('courses') || lowerPgSql.includes('faculty')) {
                pgSql += ' ON CONFLICT (id) DO NOTHING';
            }
        }

        // Add RETURNING id if it's an INSERT statement and doesn't have one
        if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.toUpperCase().includes('RETURNING')) {
            pgSql += ' RETURNING id';
        }

        const result = await database.query(pgSql, params);

        // For Postgres, the result of RETURNING id is in result.rows[0].id
        const lastID = (result.rows && result.rows[0]) ? result.rows[0].id : null;
        return { lastID, changes: result.rowCount };
    }
    return database.run(sql, params);
}

export default { getDb, query, queryOne, run };
