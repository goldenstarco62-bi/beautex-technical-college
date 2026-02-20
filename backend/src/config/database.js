import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import pg from 'pg';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../database.sqlite');
const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_URL = process.env.DATABASE_URL;
const { Pool } = pg;

let db;
let pgPool;
let mongoConnection;

export const getProcessedDatabaseUrl = () => {
    let url = process.env.DATABASE_URL;
    if (!url) return null;

    // Fix for special characters in password (like @)
    // Format: postgresql://user:password@host:port/db
    try {
        if (url.includes('@') && url.indexOf('@') !== url.lastIndexOf('@')) {
            const protocolPart = url.split('://')[0];
            const rest = url.split('://')[1];
            const credentials = rest.substring(0, rest.lastIndexOf('@'));
            const hostPart = rest.substring(rest.lastIndexOf('@') + 1);

            if (credentials.includes(':')) {
                const [user, pass] = credentials.split(':');
                const encodedPass = encodeURIComponent(pass);
                return `${protocolPart}://${user}:${encodedPass}@${hostPart}`;
            }
        }
    } catch (e) {
        console.warn('⚠️ URL encoding helper failed, using raw URL');
    }
    return url;
};

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
    const processedUrl = getProcessedDatabaseUrl();
    if (processedUrl) {
        if (!pgPool) {
            pgPool = new Pool({
                connectionString: processedUrl,
                ssl: { rejectUnauthorized: false },
                connectionTimeoutMillis: 10000, // 10s timeout
            });
            pgPool.on('error', (err) => {
                console.error('Unexpected error on idle client', err);
            });
            console.log('🐘 Connected to Supabase (PostgreSQL)');
        }
        return pgPool;
    }

    // 3. Fallback to SQLite (Only in development)
    if (!db) {
        if (process.env.NODE_ENV === 'production') {
            const error = new Error('CRITICAL: No DATABASE_URL or MONGODB_URI provided in production environment. Website cannot start without a cloud database.');
            console.error(error.message);
            throw error;
        }

        const sqlite3 = (await import('sqlite3')).default;
        const { open } = await import('sqlite');

        // Ensure directory exists for database file
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        await db.run('PRAGMA foreign_keys = ON');
        console.log('📂 Connected to local SQLite');
    }
    return db;
}

/**
 * Initialize database schema
 */
let isInitializing = false;
export async function initializeDatabase() {
    if (isInitializing) return;
    isInitializing = true;

    try {
        if (MONGODB_URI) {
            console.log('ℹ️ MongoDB detected. Schemas are handled by Mongoose models.');
            return;
        }

        const database = await getDb();
        const processedUrl = getProcessedDatabaseUrl();

        if (processedUrl) {
            console.log('🐘 PostgreSQL detected. Ensuring all tables are initialized...');

            // Check if users table exists
            const checkTable = await database.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'users'
                );
            `);

            if (!checkTable.rows[0].exists) {
                console.log('🚀 Base table "users" missing. Running full schema initialization...');
                const supabaseSchemaPath = path.join(__dirname, '../models/supabase_schema.sql');
                const supabaseSchema = fs.readFileSync(supabaseSchemaPath, 'utf-8');
                await database.query(supabaseSchema);
                console.log('✅ Full PostgreSQL schema initialized.');
            } else {
                console.log('ℹ️ Base tables present. Running safe schema patch...');
                const supabaseSchemaPath = path.join(__dirname, '../models/supabase_schema.sql');
                if (fs.existsSync(supabaseSchemaPath)) {
                    const supabaseSchema = fs.readFileSync(supabaseSchemaPath, 'utf-8');
                    await database.query(supabaseSchema);
                    console.log('✅ PostgreSQL schema check/update complete.');
                }
            }

            await runPostgresMigrations(database);
            return;
        }

        // SQLite Initialization
        const schemaPath = path.join(__dirname, '../models/schema.sql');
        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf-8');
            try {
                await database.exec(schema);
                console.log('✅ SQLite Database initialized successfully');
            } catch (error) {
                if (error.message.includes('already exists') || error.code === 'SQLITE_CONSTRAINT') {
                    console.log('ℹ️ SQLite Database already initialized');
                } else {
                    console.error('❌ SQLite Initialization Error:', error);
                }
            }
        } else {
            console.warn('⚠️ Schema file not found. Skipping auto-initialization.');
        }

    } catch (err) {
        console.error('❌ Critical Init Error:', err.message);
    } finally {
        isInitializing = false;
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

        // Check for phone column in users
        const checkPhone = await database.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name='users' AND column_name='phone'
        `);
        if (checkPhone.rows.length === 0) {
            await database.query('ALTER TABLE users ADD COLUMN phone TEXT');
            console.log('✅ phone column added to users');
        }

        // Check for address column in users
        const checkAddr = await database.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name='users' AND column_name='address'
        `);
        if (checkAddr.rows.length === 0) {
            await database.query('ALTER TABLE users ADD COLUMN address TEXT');
            console.log('✅ address column added to users');
        }

        // Check for bio column in users
        const checkBio = await database.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name='users' AND column_name='bio'
        `);
        if (checkBio.rows.length === 0) {
            await database.query('ALTER TABLE users ADD COLUMN bio TEXT');
            console.log('✅ bio column added to users');
        }

        // Check for photo column in users
        const checkPhoto = await database.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name='users' AND column_name='photo'
        `);
        if (checkPhoto.rows.length === 0) {
            await database.query('ALTER TABLE users ADD COLUMN photo TEXT');
            console.log('✅ photo column added to users');
        }

        // --- Students Table Migrations ---
        const studentCols = await database.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name='students'
        `);
        const existingStudentCols = studentCols.rows.map(r => r.column_name);

        if (!existingStudentCols.includes('bio')) {
            await database.query('ALTER TABLE students ADD COLUMN bio TEXT');
            console.log('✅ bio column added to students');
        }
        if (!existingStudentCols.includes('photo')) {
            await database.query('ALTER TABLE students ADD COLUMN photo TEXT');
            console.log('✅ photo column added to students');
        }
        if (!existingStudentCols.includes('phone')) {
            await database.query('ALTER TABLE students ADD COLUMN phone TEXT');
            console.log('✅ phone column added to students');
        }
        if (!existingStudentCols.includes('intake')) {
            await database.query('ALTER TABLE students ADD COLUMN intake TEXT');
            console.log('✅ intake column added to students');
        }

        // --- Faculty Table Migrations ---
        const facultyCols = await database.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name='faculty'
        `);
        const existingFacultyCols = facultyCols.rows.map(r => r.column_name);

        if (!existingFacultyCols.includes('address')) {
            await database.query('ALTER TABLE faculty ADD COLUMN address TEXT');
            console.log('✅ address column added to faculty');
        }
        if (!existingFacultyCols.includes('bio')) {
            await database.query('ALTER TABLE faculty ADD COLUMN bio TEXT');
            console.log('✅ bio column added to faculty');
        }
        if (!existingFacultyCols.includes('passport')) {
            await database.query('ALTER TABLE faculty ADD COLUMN passport TEXT');
            console.log('✅ passport column added to faculty');
        }
        if (!existingFacultyCols.includes('photo')) {
            await database.query('ALTER TABLE faculty ADD COLUMN photo TEXT');
            console.log('✅ photo column added to faculty');
        }
        if (!existingFacultyCols.includes('phone')) {
            await database.query('ALTER TABLE faculty ADD COLUMN phone TEXT');
            console.log('✅ phone column added to faculty');
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
    if (getProcessedDatabaseUrl()) {
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
    if (getProcessedDatabaseUrl()) {
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
    if (getProcessedDatabaseUrl()) {
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
