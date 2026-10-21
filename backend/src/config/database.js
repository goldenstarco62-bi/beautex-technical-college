import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { AsyncLocalStorage } from 'async_hooks';
import pg from 'pg';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../../database.sqlite');
const MONGODB_URI = process.env.MONGODB_URI?.trim();
const DATABASE_URL = process.env.DATABASE_URL?.trim();
const { Pool } = pg;

let db;
let pgPool;
let mongoConnection;

// Holds the dedicated Postgres client for the currently-running transaction (if any).
// AsyncLocalStorage scopes it to the async call tree, so nested query/run/queryOne
// calls inside withTransaction() transparently reuse the SAME connection instead of
// checking out random pool connections (which would break atomicity).
const txStore = new AsyncLocalStorage();

/**
 * Determine the active SQL engine for query portability.
 * Prioritizes MONGODB_URI (if using Mongo logic), then DATABASE_URL (for Postgres), then SQLite.
 */
export const getActiveDbEngine = () => {
    if (!!process.env.MONGODB_URI) return 'mongodb';
    const processedUrl = getProcessedDatabaseUrl();
    if (processedUrl && processedUrl.startsWith('postgres')) return 'postgres';
    return 'sqlite';
};

/**
 * Returns the appropriate SQL function for 'today' based on the active engine.
 * PostgreSQL uses CURRENT_DATE, while SQLite uses date('now').
 */
export const getCurrentDateSQL = () => {
    return getActiveDbEngine() === 'postgres' ? 'CURRENT_DATE' : "date('now')";
};

/**
 * Returns the appropriate SQL function for date math (e.g., today + 30 days).
 */
export const getDateIntervalSQL = (days) => {
    const engine = getActiveDbEngine();
    if (engine === 'postgres') {
        const op = days >= 0 ? '+' : '-';
        return `CURRENT_DATE ${op} INTERVAL '${Math.abs(days)} days'`;
    }
    const op = days >= 0 ? '+' : '-';
    return `date('now', '${op}${Math.abs(days)} days')`;
};


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
    if (processedUrl && processedUrl.startsWith('postgres')) {
        if (!pgPool) {
            try {
                pgPool = new Pool({
                    connectionString: processedUrl,
                    ssl: { rejectUnauthorized: false },
                    connectionTimeoutMillis: 10000, // 10s timeout
                    idleTimeoutMillis: 30000,       // drop idle clients after 30s so dead connections don't linger
                    keepAlive: true,                // TCP keep-alive survives laptop sleep / short Wi-Fi drops
                });
                pgPool.on('error', (err) => {
                    // Errors on idle/removed clients surface here; the client is evicted automatically.
                    console.error('Unexpected error on idle Postgres client:', err.message);
                });
                // Test the connection
                const client = await pgPool.connect();
                console.log('🐘 Connected to Supabase (PostgreSQL)');
                client.release();
            } catch (err) {
                console.error('❌ PostgreSQL Connection Error:', err.message);
                pgPool = null;
                throw err;
            }
        }
        return pgPool;
    }

    // 3. Fallback to SQLite (Only in development)
    if (!db) {
        const isVercel = !!process.env.VERCEL;
        const isProduction = process.env.NODE_ENV === 'production';

        if (isProduction || isVercel) {
            const envType = isVercel ? 'Vercel (Production)' : 'Production';
            const error = new Error(`CRITICAL: No DATABASE_URL or MONGODB_URI provided in ${envType} environment. Website cannot start with ephemeral SQLite storage.`);
            console.error('################################################################');
            console.error('🛑 DATABASE CONFIGURATION ERROR');
            console.error(error.message);
            console.error('Please set DATABASE_URL (for Supabase) or MONGODB_URI (for Atlas)');
            console.error('in your environment variables.');
            console.error('################################################################');
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
        console.log('📂 Connected to local SQLite (Development Mode)');
    }
    return db;
}

/**
 * Initialize database schema
 */
let isInitializing = false;
// Bump this whenever a new migration block is added below — the version gate
// then re-runs the full (idempotent) migration sweep once on next boot.
const SCHEMA_MIGRATION_VERSION = 'pg-2026-10-21-01';

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

            // ── Schema version gate: skips the full migration sweep (previously ~27s of
            //    sequential round-trips) when this version is already recorded. ──
            await database.query(`CREATE TABLE IF NOT EXISTS schema_migrations (key TEXT PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
            const versionApplied = await database.query(
                `SELECT 1 AS ok FROM schema_migrations WHERE key = $1`,
                [SCHEMA_MIGRATION_VERSION]
            );

            if (versionApplied.rows.length > 0) {
                console.log(`✅ Schema ${SCHEMA_MIGRATION_VERSION} already applied — skipping migration sweep (fast boot).`);
            } else {
                // Check if users table exists
                const checkTable = await database.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'users'
                    );
                `);

                if (!checkTable.rows[0].exists) {
                    console.log('🚀 Base table "users" missing in PostgreSQL. Running full schema initialization...');
                    const supabaseSchemaPath = path.join(__dirname, '../models/supabase_schema.sql');
                    if (fs.existsSync(supabaseSchemaPath)) {
                        const supabaseSchema = fs.readFileSync(supabaseSchemaPath, 'utf-8');
                        // Split content by semicolons to execute as individual queries if needed, 
                        // though most PostgreSQL drivers handle multiple statements if they are simple DDL.
                        await database.query(supabaseSchema);
                        console.log('✅ Full PostgreSQL schema initialized.');
                    } else {
                        console.error('❌ Critical: supabase_schema.sql not found for PostgreSQL initialization');
                    }
                } else {
                    console.log('ℹ️ Base tables present. Skipping base schema execution (speed optimization).');
                }

                await runPostgresMigrations(database);

                // ─── INVENTORY MODULE (POSTGRES) ──────────────────────────────
                const pgInvSchemaPath = path.join(__dirname, '../models/postgres_inventory_schema.sql');
                if (fs.existsSync(pgInvSchemaPath)) {
                    console.log('📦 Initializing Inventory Module for PostgreSQL...');
                    const pgInvSchema = fs.readFileSync(pgInvSchemaPath, 'utf-8');
                    try {
                        await database.query(pgInvSchema);
                        console.log('✅ Inventory schema initialized (PostgreSQL)');
                    } catch (e) {
                        console.warn('⚠️ Inventory schema warning (PostgreSQL):', e.message);
                    }
                }

                await ensureHighPerformanceIndexes(database);

                await database.query(
                    `INSERT INTO schema_migrations (key) VALUES ($1) ON CONFLICT (key) DO NOTHING`,
                    [SCHEMA_MIGRATION_VERSION]
                );
                console.log(`✅ Schema version ${SCHEMA_MIGRATION_VERSION} recorded in schema_migrations.`);
            }

            await seedNewSettings(database);
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

        // Run migrations for SQLite
        await runSqliteMigrations(database);
        await ensureHighPerformanceIndexes(database);
        await seedNewSettings(database);

    } catch (err) {
        console.error('❌ Critical Init Error:', err.message);
    } finally {
        isInitializing = false;
    }
}

async function runPostgresMigrations(database) {
    try {
        // Migration: Fix clashing trainer_reports table (renaming Academic style to academic_reports)
        const checkTrCol = await database.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name='trainer_reports' AND column_name='student_id'
        `);
        if (checkTrCol.rows.length > 0) {
            const checkAc = await database.query(`
                SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'academic_reports')
            `);
            if (!checkAc.rows[0].exists) {
                console.log('🔄 Postgres Migration: Renaming clashing trainer_reports to academic_reports...');
                await database.query('ALTER TABLE trainer_reports RENAME TO academic_reports');
            } else {
                console.log('⚠️ Postgres Conflict: Dropping clashing trainer_reports...');
                await database.query('DROP TABLE trainer_reports');
            }
        }

        // Migration: Relax constraints on academic_reports for Class Reporting
        try {
            await database.query('ALTER TABLE academic_reports DROP CONSTRAINT IF EXISTS academic_reports_student_id_fkey');
            console.log('✅ Postgres Migration: Relaxed academic_reports constraints');
            
            // New Migration: Add report_date to academic_reports if missing
            try {
                await database.query('ALTER TABLE academic_reports ADD COLUMN IF NOT EXISTS report_date DATE');
                console.log('✅ Postgres Migration: Added report_date to academic_reports');
            } catch (err) {
                console.warn('⚠️ Postgres Migration warning (academic_reports report_date):', err.message);
            }
        } catch (e) {
            // Might fail if constraint name is different or doesn't exist, ignore
        }

        // Migration: Ensure trainer_reports table exists (may have been dropped by the clash-fix above)
        await database.query(`
            CREATE TABLE IF NOT EXISTS trainer_reports (
                id SERIAL PRIMARY KEY,
                trainer_id TEXT NOT NULL,
                trainer_name TEXT NOT NULL,
                week_number TEXT NOT NULL,
                report_date DATE NOT NULL,
                daily_report TEXT NOT NULL,
                record_of_work TEXT NOT NULL,
                course_id TEXT,
                status TEXT DEFAULT 'Submitted',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ trainer_reports table ensured');

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

        // Check for last_seen_at column in users
        const checkLastSeen = await database.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name='users' AND column_name='last_seen_at'
        `);
        if (checkLastSeen.rows.length === 0) {
            await database.query('ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMPTZ');
            console.log('✅ last_seen_at column added to users');
        }

        // Check for last_login column in users
        const checkLastLogin = await database.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name='users' AND column_name='last_login'
        `);
        if (checkLastLogin.rows.length === 0) {
            await database.query('ALTER TABLE users ADD COLUMN last_login TIMESTAMPTZ');
            console.log('✅ last_login column added to users');
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
        if (!existingStudentCols.includes('department')) {
            await database.query('ALTER TABLE students ADD COLUMN department TEXT');
            console.log('✅ department column added to students');
        }
        if (!existingStudentCols.includes('level')) {
            await database.query('ALTER TABLE students ADD COLUMN level TEXT DEFAULT \'Module 1\'');
            console.log('✅ level column added to students');
        }
        if (!existingStudentCols.includes('id_status')) {
            await database.query('ALTER TABLE students ADD COLUMN id_status TEXT DEFAULT \'Not Generated\'');
            console.log('✅ id_status column added to students');
        }
        if (!existingStudentCols.includes('passport_status')) {
            await database.query('ALTER TABLE students ADD COLUMN passport_status TEXT DEFAULT \'Not Generated\'');
            console.log('✅ passport_status column added to students');
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
        if (!existingFacultyCols.includes('id_number')) {
            await database.query('ALTER TABLE faculty ADD COLUMN id_number TEXT');
            console.log('✅ id_number column added to faculty');
        }
        if (!existingFacultyCols.includes('category')) {
            await database.query('ALTER TABLE faculty ADD COLUMN category TEXT DEFAULT \'Trainer\'');
            console.log('✅ category column added to faculty');
        }

        // --- Audit Logs Table Migrations ---
        const auditCols = await database.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name='audit_logs'
        `);
        const existingAuditCols = auditCols.rows.map(r => r.column_name);

        if (!existingAuditCols.includes('user_email')) {
            console.log('🔄 Applying migration: Adding user_email to Postgres audit_logs...');
            await database.query('ALTER TABLE audit_logs ADD COLUMN user_email TEXT');
            console.log('✅ user_email column added to audit_logs');
        }

        // Add missing columns to daily_activity_reports
        const dailyFields = await database.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name='daily_activity_reports'
        `);
        const existingDailyCols = dailyFields.rows.map(r => r.column_name);

        if (!existingDailyCols.includes('disciplinary_cases')) {
            await database.query('ALTER TABLE daily_activity_reports ADD COLUMN disciplinary_cases INTEGER DEFAULT 0');
            console.log('✅ disciplinary_cases column added to daily_activity_reports');
        }
        if (!existingDailyCols.includes('staff_absent')) {
            await database.query('ALTER TABLE daily_activity_reports ADD COLUMN staff_absent INTEGER DEFAULT 0');
            console.log('✅ staff_absent column added to daily_activity_reports');
        }
        if (!existingDailyCols.includes('facilities_issues')) {
            await database.query('ALTER TABLE daily_activity_reports ADD COLUMN facilities_issues TEXT');
            console.log('✅ facilities_issues column added to daily_activity_reports');
        }
        if (!existingDailyCols.includes('equipment_maintenance')) {
            await database.query('ALTER TABLE daily_activity_reports ADD COLUMN equipment_maintenance TEXT');
            console.log('✅ equipment_maintenance column added to daily_activity_reports');
        }

        // New Daily Report Format Columns (Postgres)
        const newDailyCols = [
            { name: 'department', type: 'TEXT' },
            { name: 'total_students_expected', type: 'INTEGER DEFAULT 0' },
            { name: 'absent_students_list', type: 'TEXT' },
            { name: 'topics_covered', type: 'TEXT' },
            { name: 'practical_sessions', type: 'TEXT' },
            { name: 'meetings_held', type: 'TEXT' },
            { name: 'admissions_registrations', type: 'TEXT' },
            { name: 'fees_collection_summary', type: 'TEXT' },
            { name: 'discipline_issues', type: 'TEXT' },
            { name: 'student_feedback', type: 'TEXT' },
            { name: 'counseling_support', type: 'TEXT' },
            { name: 'cleaning_maintenance', type: 'TEXT' },
            { name: 'internet_ict_status', type: 'TEXT' },
            { name: 'inquiries_received', type: 'INTEGER DEFAULT 0' },
            { name: 'walk_ins', type: 'INTEGER DEFAULT 0' },
            { name: 'social_media_activities', type: 'TEXT' },
            { name: 'challenges_faced', type: 'TEXT' },
            { name: 'actions_taken', type: 'TEXT' },
            { name: 'plans_for_next_day', type: 'TEXT' }
        ];

        for (const col of newDailyCols) {
            if (!existingDailyCols.includes(col.name)) {
                console.log(`🔄 Postgres Migration: Adding ${col.name} to daily_activity_reports...`);
                await database.query(`ALTER TABLE daily_activity_reports ADD COLUMN ${col.name} ${col.type}`);
            }
        }

        // Change classes_conducted from INTEGER to TEXT if needed
        const checkClassesType = await database.query(`
            SELECT data_type FROM information_schema.columns 
            WHERE table_name='daily_activity_reports' AND column_name='classes_conducted'
        `);
        if (checkClassesType.rows[0]?.data_type === 'integer') {
            console.log('🔄 Postgres Migration: Changing classes_conducted to TEXT...');
            await database.query('ALTER TABLE daily_activity_reports ALTER COLUMN classes_conducted TYPE TEXT USING classes_conducted::text');
        }

        // Migration: Relax UNIQUE constraint on daily_activity_reports (report_date -> report_date, department)
        try {
            const checkConstraint = await database.query(`
                SELECT conname FROM pg_constraint 
                WHERE conname = 'daily_activity_reports_report_date_key'
            `);
            if (checkConstraint.rows.length > 0) {
                console.log('🔄 Postgres Migration: Relaxing daily_activity_reports UNIQUE constraint...');
                await database.query('ALTER TABLE daily_activity_reports DROP CONSTRAINT daily_activity_reports_report_date_key');
            }
            
            // Add composite unique constraint if department is not null
            const checkComposite = await database.query(`
                SELECT conname FROM pg_constraint 
                WHERE conname = 'daily_activity_reports_date_dept_key'
            `);
            if (checkComposite.rows.length === 0) {
                await database.query('ALTER TABLE daily_activity_reports ADD CONSTRAINT daily_activity_reports_date_dept_key UNIQUE (report_date, department)');
                console.log('✅ Composite UNIQUE constraint added (report_date, department)');
            }
        } catch (e) {
            console.warn('⚠️ daily_activity_reports constraint migration warning:', e.message);
        }

        // Check for reset_token columns (for forgot-password flow)
        const checkResetToken = await database.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name='users' AND column_name='reset_token'
        `);
        if (checkResetToken.rows.length === 0) {
            await database.query('ALTER TABLE users ADD COLUMN reset_token TEXT');
            await database.query('ALTER TABLE users ADD COLUMN reset_token_expiry TIMESTAMPTZ');
            console.log('✅ reset_token columns added to users');
        }

        // Check for can_edit_finance column in users
        const checkFinanceCol = await database.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name='users' AND column_name='can_edit_finance'
        `);
        if (checkFinanceCol.rows.length === 0) {
            await database.query('ALTER TABLE users ADD COLUMN can_edit_finance BOOLEAN DEFAULT FALSE');
            console.log('✅ can_edit_finance column added to users');
        }

        // Check for can_edit_students column in users
        const checkStudentEditCol = await database.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name='users' AND column_name='can_edit_students'
        `);
        if (checkStudentEditCol.rows.length === 0) {
            await database.query('ALTER TABLE users ADD COLUMN can_edit_students BOOLEAN DEFAULT FALSE');
            console.log('✅ can_edit_students column added to users');
        }

        // --- Payments Table Migrations ---
        const paymentCols = await database.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name='payments'
        `);
        const existingPaymentCols = paymentCols.rows.map(r => r.column_name);

        const newPaymentCols = [
            { name: 'category', type: "TEXT DEFAULT 'Tuition Fee'" },
            { name: 'semester', type: 'TEXT' },
            { name: 'academic_year', type: 'TEXT' },
            { name: 'remarks', type: 'TEXT' }
        ];

        for (const col of newPaymentCols) {
            if (!existingPaymentCols.includes(col.name)) {
                console.log(`🔄 Postgres Migration: Adding ${col.name} to payments table...`);
                await database.query(`ALTER TABLE payments ADD COLUMN ${col.name} ${col.type}`);
            }
        }

        // --- Student Daily Reports: student comment columns ---
        const dailyRptCols = await database.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name='student_daily_reports'
        `);
        const existingDailyRptCols = dailyRptCols.rows.map(r => r.column_name);
        if (!existingDailyRptCols.includes('lesson_taught')) {
            await database.query('ALTER TABLE student_daily_reports ADD COLUMN lesson_taught BOOLEAN DEFAULT NULL');
            console.log('✅ lesson_taught column added to student_daily_reports');
        }
        if (!existingDailyRptCols.includes('student_comment')) {
            await database.query('ALTER TABLE student_daily_reports ADD COLUMN student_comment TEXT');
            console.log('✅ student_comment column added to student_daily_reports');
        }
        if (!existingDailyRptCols.includes('student_commented_at')) {
            await database.query('ALTER TABLE student_daily_reports ADD COLUMN student_commented_at TIMESTAMPTZ');
            console.log('✅ student_commented_at column added to student_daily_reports');
        }

        // --- Notifications Table ---
        await database.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id TEXT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                type TEXT DEFAULT 'info',
                priority TEXT DEFAULT 'medium',
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ notifications table ensured (PostgreSQL)');
    } catch (err) {

        console.error('⚠️ Postgres migration warning:', err.message);
    }

    // Migration: Procurement Wishlist
    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS inv_procurement_wishlist (
                id SERIAL PRIMARY KEY,
                item_name TEXT NOT NULL,
                description TEXT,
                quantity INTEGER NOT NULL,
                estimated_unit_price DECIMAL DEFAULT 0.0,
                priority TEXT DEFAULT 'Medium' CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')),
                requested_by TEXT NOT NULL,
                requested_by_name TEXT NOT NULL,
                department TEXT NOT NULL,
                status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Purchased', 'Rejected')),
                rejection_reason TEXT,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Procurement wishlist table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ Procurement wishlist migration warning (PostgreSQL):', e.message);
    }

    // Migration: Activity Report Summary Tables (Weekly & Monthly)
    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS weekly_summary_reports (
                id SERIAL PRIMARY KEY,
                week_start_date DATE NOT NULL,
                week_end_date DATE NOT NULL,
                reported_by TEXT NOT NULL,
                total_classes_conducted INTEGER DEFAULT 0,
                average_attendance DECIMAL DEFAULT 0,
                total_assessments INTEGER DEFAULT 0,
                active_students INTEGER DEFAULT 0,
                avg_student_attendance DECIMAL DEFAULT 0,
                disciplinary_cases INTEGER DEFAULT 0,
                courses_completed INTEGER DEFAULT 0,
                new_enrollments INTEGER DEFAULT 0,
                key_achievements TEXT,
                challenges_faced TEXT,
                action_items TEXT,
                revenue_collected DECIMAL DEFAULT 0,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ weekly_summary_reports table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ weekly_summary_reports migration warning (PostgreSQL):', e.message);
    }

    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS monthly_summary_reports (
                id SERIAL PRIMARY KEY,
                month TEXT,
                month_start_date DATE,
                month_end_date DATE,
                reported_by TEXT NOT NULL,
                total_students INTEGER DEFAULT 0,
                new_enrollments INTEGER DEFAULT 0,
                graduations INTEGER DEFAULT 0,
                dropouts INTEGER DEFAULT 0,
                total_classes INTEGER DEFAULT 0,
                average_attendance DECIMAL DEFAULT 0,
                total_assessments INTEGER DEFAULT 0,
                average_pass_rate DECIMAL DEFAULT 0,
                total_faculty INTEGER DEFAULT 0,
                new_hires INTEGER DEFAULT 0,
                faculty_departures INTEGER DEFAULT 0,
                revenue DECIMAL DEFAULT 0,
                expenses DECIMAL DEFAULT 0,
                major_achievements TEXT,
                challenges TEXT,
                strategic_initiatives TEXT,
                goals_next_month TEXT,
                additional_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ monthly_summary_reports table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ monthly_summary_reports migration warning (PostgreSQL):', e.message);
    }

    // Migration: Monthly Fee Tracking Module (Postgres)
    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS monthly_fee_tracking (
                id SERIAL PRIMARY KEY,
                student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                month_label TEXT NOT NULL,
                amount_due DECIMAL DEFAULT 0.0,
                amount_paid DECIMAL DEFAULT 0.0,
                balance DECIMAL DEFAULT 0.0,
                status TEXT DEFAULT 'Not Paid' CHECK(status IN ('Paid', 'Not Paid', 'Partial')),
                due_date DATE,
                paid_date TIMESTAMP,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, year, month)
            )
        `);
        console.log('✅ monthly_fee_tracking table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ monthly_fee_tracking migration warning (PostgreSQL):', e.message);
    }

    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS monthly_fee_notifications (
                id SERIAL PRIMARY KEY,
                student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                notification_type TEXT NOT NULL,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                message TEXT NOT NULL
            )
        `);
        console.log('✅ monthly_fee_notifications table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ monthly_fee_notifications migration warning (PostgreSQL):', e.message);
    }

    // Performance indexes (PostgreSQL)
    try {
        await database.query('CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_student_daily_reports_student_id ON student_daily_reports(student_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_student_daily_reports_trainer_email ON student_daily_reports(trainer_email)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_sessions_teacher_email ON sessions(teacher_email)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_students_email ON students(email)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_faculty_email ON faculty(email)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_grades_student_id ON grades(student_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_academic_reports_student_id ON academic_reports(student_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_academic_reports_trainer_email ON academic_reports(trainer_email)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_student_unit_marks_student_id ON student_unit_marks(student_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_student_fees_student_id ON student_fees(student_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_monthly_fee_tracking_student_id ON monthly_fee_tracking(student_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_course_units_course_id ON course_units(course_id)');
        console.log('✅ Performance indexes ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ Performance indexes migration warning (PostgreSQL):', e.message);
    }

    // Migration: Course Units table (competency-based grading)
    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS course_units (
                id SERIAL PRIMARY KEY,
                course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ course_units table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ course_units migration warning (PostgreSQL):', e.message);
    }

    // Migration: Extend course_units for Unit Coverage Tracking & Master Units (PostgreSQL)
    try {
        await database.query('ALTER TABLE course_units ADD COLUMN IF NOT EXISTS code TEXT');
        await database.query('ALTER TABLE course_units ADD COLUMN IF NOT EXISTS description TEXT');
        await database.query('ALTER TABLE course_units ADD COLUMN IF NOT EXISTS expected_duration TEXT');
        await database.query('ALTER TABLE course_units ADD COLUMN IF NOT EXISTS unit_remarks TEXT');
        await database.query("ALTER TABLE course_units ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active'");
        await database.query('ALTER TABLE course_units ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE');
        await database.query('ALTER TABLE course_units ALTER COLUMN course_id DROP NOT NULL');

        await database.query(`
            CREATE TABLE IF NOT EXISTS course_unit_assignments (
                id SERIAL PRIMARY KEY,
                course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                unit_id INTEGER NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
                sort_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(course_id, unit_id)
            )
        `);
        console.log('✅ course_units extended & course_unit_assignments table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ course_units extension migration warning (PostgreSQL):', e.message);
    }

    // Migration: Student Unit Marks table (competency-based grading)
    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS student_unit_marks (
                id SERIAL PRIMARY KEY,
                student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                unit_id INTEGER NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
                unit_name TEXT NOT NULL,
                marks DECIMAL NOT NULL,
                grade TEXT NOT NULL CHECK(grade IN ('Distinction', 'Credit', 'Pass', 'Fail')),
                lecturer TEXT,
                recorded_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, course_id, unit_id)
            )
        `);
        console.log('✅ student_unit_marks table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ student_unit_marks migration warning (PostgreSQL):', e.message);
    }

    // ── Unit Coverage Tracking Tables (PostgreSQL) ────────────────────────────
    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS unit_coverage_logs (
                id SERIAL PRIMARY KEY,
                course_id TEXT NOT NULL,
                unit_id INTEGER NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
                teacher_id TEXT NOT NULL,
                teacher_name TEXT NOT NULL,
                academic_period TEXT,
                date_covered DATE NOT NULL,
                time_covered TEXT,
                remarks TEXT,
                material_urls TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ unit_coverage_logs table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ unit_coverage_logs migration warning (PostgreSQL):', e.message);
    }

    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS unit_coverage_confirmations (
                id SERIAL PRIMARY KEY,
                coverage_log_id INTEGER NOT NULL REFERENCES unit_coverage_logs(id) ON DELETE CASCADE,
                student_id TEXT NOT NULL,
                student_name TEXT NOT NULL,
                response TEXT NOT NULL CHECK(response IN ('Yes', 'Partially', 'No')),
                comment TEXT,
                confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(coverage_log_id, student_id)
            )
        `);
        console.log('✅ unit_coverage_confirmations table ensured (PostgreSQL)');

        await database.query('CREATE INDEX IF NOT EXISTS idx_ucl_course_id ON unit_coverage_logs(course_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_ucl_unit_id ON unit_coverage_logs(unit_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_ucc_coverage_log_id ON unit_coverage_confirmations(coverage_log_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_ucc_student_id ON unit_coverage_confirmations(student_id)');
    } catch (e) {
        console.warn('⚠️ unit_coverage_confirmations migration warning (PostgreSQL):', e.message);
    }

    // Migration: Add student_id to unit_coverage_logs for per-student tracking (PostgreSQL)
    try {
        await database.query('ALTER TABLE unit_coverage_logs ADD COLUMN IF NOT EXISTS student_id TEXT');
        await database.query('CREATE INDEX IF NOT EXISTS idx_ucl_student_id ON unit_coverage_logs(student_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_ucl_student_course ON unit_coverage_logs(student_id, course_id, unit_id)');
        console.log('✅ student_id added to unit_coverage_logs (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ unit_coverage_logs student_id migration warning (PostgreSQL):', e.message);
    }

    // ── CAT Results Module Tables (PostgreSQL) ────────────────────────────────
    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS cat_periods (
                id SERIAL PRIMARY KEY,
                academic_year TEXT NOT NULL,
                term_name TEXT NOT NULL,
                cat_name TEXT NOT NULL,
                month TEXT,
                max_marks REAL DEFAULT 100,
                start_date DATE,
                end_date DATE,
                status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Closed', 'Draft')),
                created_by TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ cat_periods table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ cat_periods migration warning (PostgreSQL):', e.message);
    }

    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS cat_results (
                id SERIAL PRIMARY KEY,
                student_id TEXT NOT NULL,
                course_id TEXT NOT NULL,
                unit_id INTEGER,
                unit_name TEXT NOT NULL,
                cat_period_id INTEGER NOT NULL,
                marks REAL,
                percentage REAL,
                grade TEXT CHECK(grade IN ('Distinction','Credit','Pass','Fail')),
                status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending','Present','Absent','Exempted')),
                workflow_status TEXT DEFAULT 'Draft' CHECK(workflow_status IN ('Draft','Submitted','Approved','Published')),
                entered_by TEXT,
                trainer_name TEXT,
                remarks TEXT,
                submitted_at TIMESTAMP,
                approved_at TIMESTAMP,
                approved_by TEXT,
                published_at TIMESTAMP,
                published_by TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, unit_id, cat_period_id)
            )
        `);
        await database.query('CREATE INDEX IF NOT EXISTS idx_cat_results_student ON cat_results(student_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_cat_results_course ON cat_results(course_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_cat_results_period ON cat_results(cat_period_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_cat_results_workflow ON cat_results(workflow_status)');
        console.log('✅ cat_results table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ cat_results migration warning (PostgreSQL):', e.message);
    }

    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS result_audit_logs (
                id SERIAL PRIMARY KEY,
                result_id INTEGER,
                student_id TEXT,
                unit_name TEXT,
                cat_period_id INTEGER,
                action TEXT NOT NULL,
                previous_marks REAL,
                new_marks REAL,
                previous_status TEXT,
                new_status TEXT,
                changed_by TEXT NOT NULL,
                changed_by_name TEXT,
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ result_audit_logs table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ result_audit_logs migration warning (PostgreSQL):', e.message);
    }

    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS trainer_unit_assignments (
                id SERIAL PRIMARY KEY,
                faculty_id TEXT NOT NULL,
                course_id TEXT NOT NULL,
                unit_id INTEGER NOT NULL,
                assigned_by TEXT,
                assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(faculty_id, course_id, unit_id)
            )
        `);
        // Align legacy column names (teacher_id / trainer_id) to faculty_id
        const tuaCols = await database.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = 'trainer_unit_assignments'`
        );
        const tuaColNames = tuaCols.rows.map(r => r.column_name);
        if (!tuaColNames.includes('faculty_id')) {
            const legacyCol = ['teacher_id', 'trainer_id'].find(c => tuaColNames.includes(c));
            if (legacyCol) {
                await database.query(`ALTER TABLE trainer_unit_assignments RENAME COLUMN ${legacyCol} TO faculty_id`);
                console.log(`✅ trainer_unit_assignments: renamed legacy column ${legacyCol} -> faculty_id (PostgreSQL)`);
            }
        }
        await database.query('CREATE INDEX IF NOT EXISTS idx_tua_faculty ON trainer_unit_assignments(faculty_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_tua_course ON trainer_unit_assignments(course_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_tua_unit ON trainer_unit_assignments(unit_id)');
        await database.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_tua_unit_course ON trainer_unit_assignments(unit_id, course_id)');
        console.log('✅ trainer_unit_assignments table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ trainer_unit_assignments migration warning (PostgreSQL):', e.message);
    }

    // ── New Academic Structure Tables ─────────────────────────────────────────
    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS global_units (
                id SERIAL PRIMARY KEY,
                unit_code TEXT UNIQUE NOT NULL,
                unit_name TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ global_units table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ global_units migration warning (PostgreSQL):', e.message);
    }

    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS program_units (
                id SERIAL PRIMARY KEY,
                course_id TEXT NOT NULL,
                unit_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(course_id, unit_id)
            )
        `);
        console.log('✅ program_units table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ program_units migration warning (PostgreSQL):', e.message);
    }

    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS assessments (
                id SERIAL PRIMARY KEY,
                course_id TEXT NOT NULL,
                unit_id INTEGER NOT NULL,
                assessment_name TEXT NOT NULL,
                assessment_type TEXT NOT NULL,
                max_marks DECIMAL NOT NULL,
                weight DECIMAL NOT NULL,
                term TEXT,
                academic_year TEXT,
                status TEXT DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ assessments table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ assessments migration warning (PostgreSQL):', e.message);
    }

    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS assessment_results (
                id SERIAL PRIMARY KEY,
                student_id TEXT NOT NULL,
                course_id TEXT NOT NULL,
                unit_id INTEGER NOT NULL,
                assessment_id INTEGER NOT NULL,
                marks DECIMAL NOT NULL,
                grade TEXT,
                entered_by TEXT,
                status TEXT DEFAULT 'Submitted',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, course_id, unit_id, assessment_id)
            )
        `);
        console.log('✅ assessment_results table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ assessment_results migration warning (PostgreSQL):', e.message);
    }

    // ── UNIT OFFERINGS: one unit taught by one lecturer to one group ──────────
    // Common units (Business Skills, ICT, Communication Skills...) are taught by
    // different lecturers to students of different courses. Units stay shared in
    // global_units; an *offering* is the teaching instance, and students are
    // attached per offering instead of per course.
    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS unit_offerings (
                id SERIAL PRIMARY KEY,
                unit_id INTEGER NOT NULL,
                course_id TEXT,
                offering_name TEXT NOT NULL,
                faculty_id TEXT,
                faculty_name TEXT,
                group_label TEXT DEFAULT 'Default',
                academic_year TEXT,
                term TEXT,
                is_default BOOLEAN DEFAULT FALSE,
                status TEXT DEFAULT 'Active',
                dedupe_key TEXT UNIQUE NOT NULL,
                created_by TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await database.query('CREATE INDEX IF NOT EXISTS idx_offerings_unit ON unit_offerings(unit_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_offerings_course ON unit_offerings(course_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_offerings_faculty ON unit_offerings(faculty_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_offerings_status ON unit_offerings(status)');
        console.log('✅ unit_offerings table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ unit_offerings migration warning (PostgreSQL):', e.message);
    }

    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS offering_students (
                id SERIAL PRIMARY KEY,
                offering_id INTEGER NOT NULL,
                student_id TEXT NOT NULL,
                enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(offering_id, student_id)
            )
        `);
        await database.query('CREATE INDEX IF NOT EXISTS idx_off_students_offering ON offering_students(offering_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_off_students_student ON offering_students(student_id)');
        console.log('✅ offering_students table ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ offering_students migration warning (PostgreSQL):', e.message);
    }

    try {
        await database.query('ALTER TABLE cat_results ADD COLUMN IF NOT EXISTS offering_id INTEGER');
        await database.query('CREATE INDEX IF NOT EXISTS idx_cat_results_offering ON cat_results(offering_id)');
        // Offering-keyed rows get their own key; the legacy UNIQUE(student_id, unit_id,
        // cat_period_id) stays in place so historic rows keep their integrity.
        await database.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS uq_cat_results_offering
            ON cat_results(student_id, offering_id, cat_period_id)
            WHERE offering_id IS NOT NULL
        `);
        console.log('✅ cat_results.offering_id ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ cat_results.offering_id migration warning (PostgreSQL):', e.message);
    }

    try {
        await database.query('ALTER TABLE global_units ADD COLUMN IF NOT EXISTS is_common BOOLEAN DEFAULT FALSE');
    } catch (e) {
        console.warn('⚠️ global_units.is_common migration warning (PostgreSQL):', e.message);
    }

    // Idempotent backfill: default offering per (unit, course), lecturer copied from
    // trainer_unit_assignments where one exists, then historic marks stamped onto it.
    try {
        await database.query(`
            INSERT INTO unit_offerings (unit_id, course_id, offering_name, faculty_id, faculty_name, group_label, is_default, dedupe_key, created_by)
            SELECT pu.unit_id, pu.course_id,
                   COALESCE(gu.unit_name, 'Unit ' || CAST(pu.unit_id AS TEXT)),
                   tua.faculty_id, f.name, 'Default', TRUE,
                   pu.unit_id || '|' || pu.course_id || '|*|*|*',
                   'system-migration'
            FROM program_units pu
            JOIN global_units gu ON gu.id = pu.unit_id
            LEFT JOIN trainer_unit_assignments tua
                   ON tua.unit_id = pu.unit_id AND tua.course_id = pu.course_id
            LEFT JOIN faculty f ON f.id = tua.faculty_id
            ON CONFLICT (dedupe_key) DO NOTHING
        `);
        await database.query(`
            INSERT INTO unit_offerings (unit_id, course_id, offering_name, group_label, is_default, dedupe_key, created_by)
            SELECT s.unit_id, s.course_id,
                   COALESCE(gu.unit_name, 'Unit ' || CAST(s.unit_id AS TEXT)),
                   'Default', TRUE,
                   s.unit_id || '|' || s.course_id || '|*|*|*',
                   'system-migration'
            FROM (SELECT DISTINCT unit_id, course_id FROM cat_results WHERE unit_id IS NOT NULL) s
            LEFT JOIN global_units gu ON gu.id = s.unit_id
            WHERE NOT EXISTS (
                SELECT 1 FROM unit_offerings o
                WHERE o.dedupe_key = s.unit_id || '|' || s.course_id || '|*|*|*'
            )
            ON CONFLICT (dedupe_key) DO NOTHING
        `);
        await database.query(`
            UPDATE cat_results SET offering_id = o.id
            FROM unit_offerings o
            WHERE cat_results.offering_id IS NULL
              AND cat_results.unit_id IS NOT NULL
              AND o.dedupe_key = cat_results.unit_id || '|' || cat_results.course_id || '|*|*|*'
        `);
        await database.query(`
            INSERT INTO offering_students (offering_id, student_id)
            SELECT DISTINCT cr.offering_id, cr.student_id
            FROM cat_results cr
            WHERE cr.offering_id IS NOT NULL
            ON CONFLICT (offering_id, student_id) DO NOTHING
        `);
        await database.query(`
            UPDATE global_units SET is_common = TRUE
            WHERE id IN (
                SELECT unit_id FROM program_units
                GROUP BY unit_id HAVING COUNT(DISTINCT course_id) > 1
            )
        `);
        console.log('✅ Unit offerings backfilled from existing units/marks (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ unit offerings backfill warning (PostgreSQL):', e.message);
    }

    // ── PROGRAMME HIERARCHY: Diplomas vs Short Courses ────────────────────────
    // A diploma can cover several streams taught by different lecturers (Cosmetology
    // covers Beauty Therapy + Hairdressing); short courses hang off the discipline
    // that hosts them. Course ids stay the join key, so this only adds structure.
    try {
        await database.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS programme_type TEXT NOT NULL DEFAULT 'Short Course'`);
        await database.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES courses(id) ON DELETE SET NULL`);
        await database.query('CREATE INDEX IF NOT EXISTS idx_courses_programme_type ON courses(programme_type)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_courses_parent ON courses(parent_id)');
        await database.query(`
            CREATE TABLE IF NOT EXISTS diploma_streams (
                diploma_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                sort_order INTEGER DEFAULT 0,
                PRIMARY KEY (diploma_id, course_id)
            )
        `);
        await database.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS registration_type TEXT`);
        await database.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS programme_id TEXT REFERENCES courses(id) ON DELETE SET NULL`);
        await database.query('CREATE INDEX IF NOT EXISTS idx_students_programme ON students(programme_id)');
        console.log('✅ Programme hierarchy columns ensured (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ programme hierarchy migration warning (PostgreSQL):', e.message);
    }

    // The college's real catalogue: three diplomas, short courses parented to the
    // discipline that teaches them. Idempotent — safe to re-run.
    try {
        await database.query(`
            INSERT INTO courses (id, name, department, instructor, duration, capacity, programme_type, parent_id, status)
            SELECT v.id, v.name, 'Cosmetology', COALESCE(h.instructor, 'To be assigned'), v.duration, COALESCE(h.capacity, 30), 'Short Course', v.parent_id, 'Active'
            FROM (VALUES ('SC-10', 'Sista Locks', '3 Months', 'SC-03'), ('SC-11', 'Dreadlocks', '2 Months', 'SC-03'))
                 AS v(id, name, duration, parent_id)
            LEFT JOIN courses h ON h.id = 'SC-03'
            ON CONFLICT (id) DO NOTHING
        `);
        await database.query(`UPDATE courses SET programme_type = 'Diploma' WHERE id IN ('COS 002', 'SC-03', 'SC-06')`);
        await database.query(`
            UPDATE courses SET parent_id = CASE id
                WHEN 'SC-01' THEN 'SC-06'
                WHEN 'SC-02' THEN 'SC-06'
                WHEN 'SC-04' THEN 'SC-03'
                WHEN 'SC-05' THEN 'SC-03'
                WHEN 'SC-10' THEN 'SC-03'
                WHEN 'SC-11' THEN 'SC-03'
                WHEN 'COS 110' THEN 'SC-03'
            END
            WHERE id IN ('SC-01','SC-02','SC-04','SC-05','SC-10','SC-11','COS 110')
        `);
        await database.query(`
            INSERT INTO diploma_streams (diploma_id, course_id, sort_order)
            VALUES ('COS 002', 'SC-06', 1), ('COS 002', 'SC-03', 2)
            ON CONFLICT (diploma_id, course_id) DO NOTHING
        `);
        console.log('✅ Programme catalogue seeded (diplomas, short-course parents, Cosmetology streams) (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ programme catalogue seed warning (PostgreSQL):', e.message);
    }

    // ── Certificates module (PostgreSQL) ──────────────────────────────────────
    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS certificates (
                id SERIAL PRIMARY KEY,
                certificate_number TEXT UNIQUE NOT NULL,
                student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                programme_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
                category TEXT NOT NULL CHECK(category IN ('Diploma','Certificate','Short Course')),
                student_name TEXT NOT NULL,
                course_name TEXT NOT NULL,
                admission_number TEXT,
                completion_date DATE,
                award_date DATE NOT NULL,
                status TEXT NOT NULL DEFAULT 'Issued' CHECK(status IN ('Issued','Revoked')),
                template_version TEXT,
                issued_by TEXT,
                issued_by_name TEXT,
                revoke_reason TEXT,
                revoked_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await database.query('CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id)');
        await database.query('CREATE INDEX IF NOT EXISTS idx_certificates_category ON certificates(category)');
        // One active (non-revoked) certificate per student + programme.
        await database.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_certificates_active ON certificates(student_id, programme_id) WHERE status = 'Issued'`);
        // Per-category, per-year sequence for certificate numbering.
        await database.query(`
            CREATE TABLE IF NOT EXISTS certificate_sequences (
                category TEXT NOT NULL,
                year INTEGER NOT NULL,
                last_number INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (category, year)
            )
        `);
        console.log('✅ Certificates module tables created (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ certificates migration warning (PostgreSQL):', e.message);
    }

    // ── Multi-programme enrolment (PostgreSQL) ────────────────────────────────
    // A student may register for more than one qualification (e.g. a Diploma plus
    // a Short Course). students.programme_id stays the MAIN programme for legacy
    // readers; this junction holds the full set and drives per-qualification certificates.
    try {
        await database.query(`
            CREATE TABLE IF NOT EXISTS student_programmes (
                student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                programme_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (student_id, programme_id)
            )
        `);
        await database.query('CREATE INDEX IF NOT EXISTS idx_student_programmes_programme ON student_programmes(programme_id)');
        await database.query(`
            INSERT INTO student_programmes (student_id, programme_id)
            SELECT id, programme_id FROM students
            WHERE programme_id IS NOT NULL AND programme_id <> ''
            ON CONFLICT (student_id, programme_id) DO NOTHING
        `);
        console.log('✅ student_programmes junction table ensured + backfilled (PostgreSQL)');
    } catch (e) {
        console.warn('⚠️ student_programmes migration warning (PostgreSQL):', e.message);
    }
}


async function runSqliteMigrations(database) {
    try {
        // Migration: Fix clashing trainer_reports table (renaming Academic style to academic_reports)
        const trInfo = await database.all("PRAGMA table_info('trainer_reports')");
        const hasStudentId = trInfo.some(c => c.name === 'student_id');
        const acTable = await database.all("PRAGMA table_info('academic_reports')");
        if (hasStudentId && acTable.length === 0) {
            console.log('🔄 SQLite Migration: Renaming clashing trainer_reports to academic_reports...');
            await database.run('ALTER TABLE trainer_reports RENAME TO academic_reports');
        } else if (hasStudentId && acTable.length > 0) {
            console.log('⚠️ SQLite Conflict: Dropping clashing trainer_reports...');
            await database.run('DROP TABLE trainer_reports');
        }

        // Ensure trainer_reports table exists (may have been dropped by the clash-fix above)
        await database.run(`
            CREATE TABLE IF NOT EXISTS trainer_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trainer_id TEXT NOT NULL,
                trainer_name TEXT NOT NULL,
                week_number TEXT NOT NULL,
                report_date DATE NOT NULL,
                daily_report TEXT NOT NULL,
                record_of_work TEXT NOT NULL,
                course_id TEXT,
                status TEXT DEFAULT 'Submitted',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ trainer_reports table ensured (SQLite)');

        // Check for user_email in audit_logs
        const tableInfo = await database.all("PRAGMA table_info('audit_logs')");
        const hasUserEmail = tableInfo.some(col => col.name === 'user_email');
        const hasUserId = tableInfo.some(col => col.name === 'user_id');

        if (!hasUserEmail) {
            console.log('🔄 Applying SQLite migration: Adding user_email to audit_logs...');
            await database.run('ALTER TABLE audit_logs ADD COLUMN user_email TEXT');
            console.log('✅ user_email column added to SQLite audit_logs');
        }

        // --- Payments Table Migrations ---
        const payInfo = await database.all("PRAGMA table_info('payments')");
        const existingPayCols = payInfo.map(c => c.name);

        if (!existingPayCols.includes('category')) {
            await database.run("ALTER TABLE payments ADD COLUMN category TEXT DEFAULT 'Tuition Fee'");
        }
        if (!existingPayCols.includes('semester')) {
            await database.run("ALTER TABLE payments ADD COLUMN semester TEXT");
        }
        if (!existingPayCols.includes('academic_year')) {
            await database.run("ALTER TABLE payments ADD COLUMN academic_year TEXT");
        }
        if (!existingPayCols.includes('remarks')) {
            await database.run("ALTER TABLE payments ADD COLUMN remarks TEXT");
        }

        // Check for department and level in students
        const studentInfo = await database.all("PRAGMA table_info('students')");
        const hasDept = studentInfo.some(col => col.name === 'department');
        const hasLevel = studentInfo.some(col => col.name === 'level');

        if (!hasDept) {
            console.log('🔄 Applying SQLite migration: Adding department to students...');
            await database.run('ALTER TABLE students ADD COLUMN department TEXT');
            console.log('✅ department column added to SQLite students');
        }
        if (!hasLevel) {
            console.log('🔄 Applying SQLite migration: Adding level to students...');
            await database.run('ALTER TABLE students ADD COLUMN level TEXT DEFAULT \'Module 1\'');
            console.log('✅ level column added to SQLite students');
        }

        // Check for category in faculty
        const facultyInfo = await database.all("PRAGMA table_info('faculty')");
        const hasCategory = facultyInfo.some(col => col.name === 'category');

        if (!hasCategory) {
            console.log('🔄 Applying SQLite migration: Adding category to faculty...');
            await database.run('ALTER TABLE faculty ADD COLUMN category TEXT DEFAULT \'Trainer\'');
            console.log('✅ category column added to SQLite faculty');
        }

        const facultyPhotoInfo = await database.all("PRAGMA table_info('faculty')");
        if (!facultyPhotoInfo.some(col => col.name === 'photo')) {
            await database.run('ALTER TABLE faculty ADD COLUMN photo TEXT');
            console.log('✅ photo column added to SQLite faculty');
        }

        const studentPhotoInfo = await database.all("PRAGMA table_info('students')");
        if (!studentPhotoInfo.some(col => col.name === 'photo')) {
            await database.run('ALTER TABLE students ADD COLUMN photo TEXT');
            console.log('✅ photo column added to SQLite students');
        }

        // Check for last_seen_at in users
        const userInfo = await database.all("PRAGMA table_info('users')");
        if (!userInfo.some(col => col.name === 'last_seen_at')) {
            console.log('🔄 Applying SQLite migration: Adding last_seen_at to users...');
            await database.run('ALTER TABLE users ADD COLUMN last_seen_at TEXT');
            console.log('✅ last_seen_at column added to SQLite users');
        }
        if (!userInfo.some(col => col.name === 'last_login')) {
            console.log('🔄 Applying SQLite migration: Adding last_login to users...');
            await database.run('ALTER TABLE users ADD COLUMN last_login TEXT');
            console.log('✅ last_login column added to SQLite users');
        }
        if (!userInfo.some(col => col.name === 'reset_token')) {
            console.log('🔄 Applying SQLite migration: Adding reset_token to users...');
            await database.run('ALTER TABLE users ADD COLUMN reset_token TEXT');
            await database.run('ALTER TABLE users ADD COLUMN reset_token_expiry TEXT');
            console.log('✅ reset_token columns added to SQLite users');
        }
        if (!userInfo.some(col => col.name === 'can_edit_finance')) {
            console.log('🔄 Applying SQLite migration: Adding can_edit_finance to users...');
            await database.run('ALTER TABLE users ADD COLUMN can_edit_finance INTEGER DEFAULT 0');
            console.log('✅ can_edit_finance column added to SQLite users');
        }
        if (!userInfo.some(col => col.name === 'can_edit_students')) {
            console.log('🔄 Applying SQLite migration: Adding can_edit_students to users...');
            await database.run('ALTER TABLE users ADD COLUMN can_edit_students INTEGER DEFAULT 0');
            console.log('✅ can_edit_students column added to SQLite users');
        }

        // Daily activity reports - add missing columns
        const dailyInfo = await database.all("PRAGMA table_info('daily_activity_reports')");
        const existingDailySQLite = dailyInfo.map(col => col.name);

        if (!existingDailySQLite.includes('disciplinary_cases')) {
            await database.run('ALTER TABLE daily_activity_reports ADD COLUMN disciplinary_cases INTEGER DEFAULT 0');
            console.log('✅ disciplinary_cases column added to daily_activity_reports');
        }
        if (!existingDailySQLite.includes('staff_absent')) {
            await database.run('ALTER TABLE daily_activity_reports ADD COLUMN staff_absent INTEGER DEFAULT 0');
            console.log('✅ staff_absent column added to daily_activity_reports');
        }

        // --- Notifications Table ---
        await database.run(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                type TEXT DEFAULT 'info',
                priority TEXT DEFAULT 'medium',
                is_read INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ notifications table ensured (SQLite)');

        // --- Course Units & Course Unit Assignments (SQLite) ---
        try {
            const cuInfo = await database.all("PRAGMA table_info('course_units')");
            const existingCuCols = cuInfo.map(c => c.name);
            if (!existingCuCols.includes('code')) {
                await database.run("ALTER TABLE course_units ADD COLUMN code TEXT");
            }
            if (!existingCuCols.includes('description')) {
                await database.run("ALTER TABLE course_units ADD COLUMN description TEXT");
            }
            if (!existingCuCols.includes('status')) {
                await database.run("ALTER TABLE course_units ADD COLUMN status TEXT DEFAULT 'Active'");
                await database.run("UPDATE course_units SET status = 'Active' WHERE status IS NULL");
            }
            if (!existingCuCols.includes('updated_at')) {
                await database.run("ALTER TABLE course_units ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP");
            }

            await database.run(`
                CREATE TABLE IF NOT EXISTS course_unit_assignments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    course_id TEXT NOT NULL,
                    unit_id INTEGER NOT NULL,
                    sort_order INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(course_id, unit_id)
                )
            `);
            await database.run(`
                CREATE TABLE IF NOT EXISTS trainer_unit_assignments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    faculty_id TEXT NOT NULL,
                    course_id TEXT NOT NULL,
                    unit_id INTEGER NOT NULL,
                    assigned_by TEXT,
                    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(faculty_id, course_id, unit_id)
                )
            `);
            const tuaCols = (await database.all(`PRAGMA table_info(trainer_unit_assignments)`)).map(r => r.name);
            if (!tuaCols.includes('faculty_id')) {
                const legacyCol = ['teacher_id', 'trainer_id'].find(c => tuaCols.includes(c));
                if (legacyCol) {
                    await database.run(`ALTER TABLE trainer_unit_assignments RENAME COLUMN ${legacyCol} TO faculty_id`);
                    console.log(`✅ trainer_unit_assignments: renamed legacy column ${legacyCol} -> faculty_id (SQLite)`);
                }
            }
            await database.run('CREATE UNIQUE INDEX IF NOT EXISTS uq_tua_unit_course ON trainer_unit_assignments(unit_id, course_id)');
            console.log('✅ course_units, course_unit_assignments & trainer_unit_assignments ensured (SQLite)');
        } catch (e) {
            console.warn('⚠️ course_units SQLite migration warning:', e.message);
        }

        if (!existingDailySQLite.includes('facilities_issues')) {
            await database.run('ALTER TABLE daily_activity_reports ADD COLUMN facilities_issues TEXT');
            console.log('✅ facilities_issues column added to daily_activity_reports');
        }
        if (!existingDailySQLite.includes('equipment_maintenance')) {
            await database.run('ALTER TABLE daily_activity_reports ADD COLUMN equipment_maintenance TEXT');
            console.log('✅ equipment_maintenance column added to daily_activity_reports');
        }

        // New Daily Report Format Columns (SQLite)
        const newDailyColsSQLite = [
            { name: 'department', type: 'TEXT' },
            { name: 'total_students_expected', type: 'INTEGER DEFAULT 0' },
            { name: 'absent_students_list', type: 'TEXT' },
            { name: 'topics_covered', type: 'TEXT' },
            { name: 'practical_sessions', type: 'TEXT' },
            { name: 'meetings_held', type: 'TEXT' },
            { name: 'admissions_registrations', type: 'TEXT' },
            { name: 'fees_collection_summary', type: 'TEXT' },
            { name: 'discipline_issues', type: 'TEXT' },
            { name: 'student_feedback', type: 'TEXT' },
            { name: 'counseling_support', type: 'TEXT' },
            { name: 'cleaning_maintenance', type: 'TEXT' },
            { name: 'internet_ict_status', type: 'TEXT' },
            { name: 'inquiries_received', type: 'INTEGER DEFAULT 0' },
            { name: 'walk_ins', type: 'INTEGER DEFAULT 0' },
            { name: 'social_media_activities', type: 'TEXT' },
            { name: 'challenges_faced', type: 'TEXT' },
            { name: 'actions_taken', type: 'TEXT' },
            { name: 'plans_for_next_day', type: 'TEXT' }
        ];

        for (const col of newDailyColsSQLite) {
            if (!existingDailySQLite.includes(col.name)) {
                console.log(`🔄 SQLite Migration: Adding ${col.name} to daily_activity_reports...`);
                await database.run(`ALTER TABLE daily_activity_reports ADD COLUMN ${col.name} ${col.type}`);
            }
        }

        // course_materials — add file metadata columns (file_name, file_size, mime_type)
        const materialsInfo = await database.all("PRAGMA table_info('course_materials')");
        if (!materialsInfo.some(col => col.name === 'file_name')) {
            console.log('🔄 Applying SQLite migration: Adding metadata columns to course_materials...');
            await database.run('ALTER TABLE course_materials ADD COLUMN file_name TEXT');
            await database.run('ALTER TABLE course_materials ADD COLUMN file_size INTEGER');
            await database.run('ALTER TABLE course_materials ADD COLUMN mime_type TEXT');
            console.log('✅ file_name/file_size/mime_type columns added to course_materials');
        }

        // Migration: Ensure student_daily_reports table exists
        await database.run(`
            CREATE TABLE IF NOT EXISTS student_daily_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                student_name TEXT NOT NULL,
                course TEXT NOT NULL,
                report_date DATE NOT NULL,
                topics_covered TEXT NOT NULL,
                trainer_remarks TEXT,
                trainer_name TEXT NOT NULL,
                trainer_email TEXT NOT NULL,
                lesson_taught INTEGER DEFAULT NULL,
                student_comment TEXT,
                student_commented_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
            )
        `);

        // Migration: Add report_date to academic_reports (SQLite)
        const academicInfo = await database.all("PRAGMA table_info('academic_reports')");
        if (academicInfo.length > 0 && !academicInfo.some(col => col.name === 'report_date')) {
            console.log('🔄 SQLite Migration: Adding report_date to academic_reports...');
            await database.run('ALTER TABLE academic_reports ADD COLUMN report_date DATE');
            console.log('✅ report_date column added to SQLite academic_reports');
        }

        // Migration: Add student comment columns to existing student_daily_reports
        const sdrInfo = await database.all("PRAGMA table_info('student_daily_reports')");
        const existingSdrCols = sdrInfo.map(c => c.name);
        if (!existingSdrCols.includes('lesson_taught')) {
            await database.run('ALTER TABLE student_daily_reports ADD COLUMN lesson_taught INTEGER DEFAULT NULL');
            console.log('✅ lesson_taught column added to student_daily_reports (SQLite)');
        }
        if (!existingSdrCols.includes('student_comment')) {
            await database.run('ALTER TABLE student_daily_reports ADD COLUMN student_comment TEXT');
            console.log('✅ student_comment column added to student_daily_reports (SQLite)');
        }
        if (!existingSdrCols.includes('student_commented_at')) {
            await database.run('ALTER TABLE student_daily_reports ADD COLUMN student_commented_at DATETIME');
            console.log('✅ student_commented_at column added to student_daily_reports (SQLite)');
        }

        // --- Inventory Module Tables ---
        const inventorySchemaPath = path.join(__dirname, '../models/inventory_schema.sql');
        if (fs.existsSync(inventorySchemaPath)) {
            const invSchema = fs.readFileSync(inventorySchemaPath, 'utf-8');
            try {
                await database.exec(invSchema);
                console.log('✅ Inventory schema initialized (SQLite)');
            } catch (e) {
                if (!e.message?.includes('already exists') && !e.message?.includes('UNIQUE constraint')) {
                    console.warn('⚠️ Inventory schema warning:', e.message);
                }
            }
        }

        // Migration: Procurement Wishlist
        await database.run(`
            CREATE TABLE IF NOT EXISTS inv_procurement_wishlist (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_name TEXT NOT NULL,
                description TEXT,
                quantity INTEGER NOT NULL,
                estimated_unit_price REAL DEFAULT 0.0,
                priority TEXT DEFAULT 'Medium' CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')),
                requested_by TEXT NOT NULL,
                requested_by_name TEXT NOT NULL,
                department TEXT NOT NULL,
                status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Approved', 'Purchased', 'Rejected')),
                rejection_reason TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Procurement wishlist table ensured (SQLite)');

        // --- Activity Report Summary Tables (Weekly & Monthly) ---
        await database.run(`
            CREATE TABLE IF NOT EXISTS weekly_summary_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                week_start_date DATE NOT NULL,
                week_end_date DATE NOT NULL,
                reported_by TEXT NOT NULL,
                total_classes_conducted INTEGER DEFAULT 0,
                average_attendance REAL DEFAULT 0,
                total_assessments INTEGER DEFAULT 0,
                active_students INTEGER DEFAULT 0,
                avg_student_attendance REAL DEFAULT 0,
                disciplinary_cases INTEGER DEFAULT 0,
                courses_completed INTEGER DEFAULT 0,
                new_enrollments INTEGER DEFAULT 0,
                key_achievements TEXT,
                challenges_faced TEXT,
                action_items TEXT,
                revenue_collected REAL DEFAULT 0,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ weekly_summary_reports table ensured (SQLite)');

        await database.run(`
            CREATE TABLE IF NOT EXISTS monthly_summary_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                month TEXT,
                month_start_date DATE,
                month_end_date DATE,
                reported_by TEXT NOT NULL,
                total_students INTEGER DEFAULT 0,
                new_enrollments INTEGER DEFAULT 0,
                graduations INTEGER DEFAULT 0,
                dropouts INTEGER DEFAULT 0,
                total_classes INTEGER DEFAULT 0,
                average_attendance REAL DEFAULT 0,
                total_assessments INTEGER DEFAULT 0,
                average_pass_rate REAL DEFAULT 0,
                total_faculty INTEGER DEFAULT 0,
                new_hires INTEGER DEFAULT 0,
                faculty_departures INTEGER DEFAULT 0,
                revenue REAL DEFAULT 0,
                expenses REAL DEFAULT 0,
                major_achievements TEXT,
                challenges TEXT,
                strategic_initiatives TEXT,
                goals_next_month TEXT,
                additional_notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ monthly_summary_reports table ensured (SQLite)');

    } catch (error) {
        console.error('⚠️ SQLite migration warning:', error.message);
    }

    // Migration: Monthly Fee Tracking Module (SQLite)
    try {
        await database.run(`
            CREATE TABLE IF NOT EXISTS monthly_fee_tracking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                month_label TEXT NOT NULL,
                amount_due REAL DEFAULT 0.0,
                amount_paid REAL DEFAULT 0.0,
                balance REAL DEFAULT 0.0,
                status TEXT DEFAULT 'Not Paid' CHECK(status IN ('Paid', 'Not Paid', 'Partial')),
                due_date DATE,
                paid_date DATETIME,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
                UNIQUE(student_id, year, month)
            )
        `);
        console.log('✅ monthly_fee_tracking table ensured (SQLite)');
    } catch (e) {
        console.warn('⚠️ monthly_fee_tracking migration warning (SQLite):', e.message);
    }

    try {
        await database.run(`
            CREATE TABLE IF NOT EXISTS monthly_fee_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                notification_type TEXT NOT NULL,
                sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                message TEXT NOT NULL,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ monthly_fee_notifications table ensured (SQLite)');
    } catch (e) {
        console.warn('⚠️ monthly_fee_notifications migration warning (SQLite):', e.message);
    }

    // Performance indexes (SQLite)
    try {
        await database.run('CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_student_daily_reports_student_id ON student_daily_reports(student_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_student_daily_reports_trainer_email ON student_daily_reports(trainer_email)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_sessions_teacher_email ON sessions(teacher_email)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_students_email ON students(email)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_faculty_email ON faculty(email)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_grades_student_id ON grades(student_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_academic_reports_student_id ON academic_reports(student_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_academic_reports_trainer_email ON academic_reports(trainer_email)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_student_unit_marks_student_id ON student_unit_marks(student_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_student_fees_student_id ON student_fees(student_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_monthly_fee_tracking_student_id ON monthly_fee_tracking(student_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_course_units_course_id ON course_units(course_id)');
        console.log('✅ Performance indexes ensured (SQLite)');
    } catch (e) {
        console.warn('⚠️ Performance indexes migration warning (SQLite):', e.message);
    }

    // Migration: Course Units (competency-based grading)
    try {
        await database.run(`
            CREATE TABLE IF NOT EXISTS course_units (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                course_id TEXT NOT NULL,
                name TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ course_units table ensured (SQLite)');
    } catch (e) {
        console.warn('⚠️ course_units migration warning (SQLite):', e.message);
    }

    // Migration: Extend course_units for Unit Coverage Tracking
    try {
        const cuInfo = await database.all("PRAGMA table_info('course_units')");
        const cuCols = cuInfo.map(c => c.name);
        if (!cuCols.includes('description')) {
            await database.run('ALTER TABLE course_units ADD COLUMN description TEXT');
            console.log('✅ description column added to course_units (SQLite)');
        }
        if (!cuCols.includes('expected_duration')) {
            await database.run('ALTER TABLE course_units ADD COLUMN expected_duration TEXT');
            console.log('✅ expected_duration column added to course_units (SQLite)');
        }
        if (!cuCols.includes('unit_remarks')) {
            await database.run('ALTER TABLE course_units ADD COLUMN unit_remarks TEXT');
            console.log('✅ unit_remarks column added to course_units (SQLite)');
        }
        if (!cuCols.includes('is_archived')) {
            await database.run('ALTER TABLE course_units ADD COLUMN is_archived INTEGER DEFAULT 0');
            console.log('✅ is_archived column added to course_units (SQLite)');
        }
    } catch (e) {
        console.warn('⚠️ course_units extension migration warning (SQLite):', e.message);
    }

    // Migration: Student Unit Marks (competency-based grading)
    try {
        await database.run(`
            CREATE TABLE IF NOT EXISTS student_unit_marks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                course_id TEXT NOT NULL,
                unit_id INTEGER NOT NULL,
                unit_name TEXT NOT NULL,
                marks REAL NOT NULL,
                grade TEXT NOT NULL CHECK(grade IN ('Distinction', 'Credit', 'Pass', 'Fail')),
                lecturer TEXT,
                recorded_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
                FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
                FOREIGN KEY (unit_id) REFERENCES course_units(id) ON DELETE CASCADE,
                UNIQUE(student_id, course_id, unit_id)
            )
        `);
        console.log('✅ student_unit_marks table ensured (SQLite)');
    } catch (e) {
        console.warn('⚠️ student_unit_marks migration warning (SQLite):', e.message);
    }

    // ── Unit Coverage Tracking Tables (SQLite) ────────────────────────────────
    try {
        await database.run(`
            CREATE TABLE IF NOT EXISTS unit_coverage_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                course_id TEXT NOT NULL,
                unit_id INTEGER NOT NULL,
                teacher_id TEXT NOT NULL,
                teacher_name TEXT NOT NULL,
                academic_period TEXT,
                date_covered DATE NOT NULL,
                time_covered TEXT,
                remarks TEXT,
                material_urls TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (unit_id) REFERENCES course_units(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ unit_coverage_logs table ensured (SQLite)');
    } catch (e) {
        console.warn('⚠️ unit_coverage_logs migration warning (SQLite):', e.message);
    }

    try {
        await database.run(`
            CREATE TABLE IF NOT EXISTS unit_coverage_confirmations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                coverage_log_id INTEGER NOT NULL,
                student_id TEXT NOT NULL,
                student_name TEXT NOT NULL,
                response TEXT NOT NULL CHECK(response IN ('Yes', 'Partially', 'No')),
                comment TEXT,
                confirmed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(coverage_log_id, student_id),
                FOREIGN KEY (coverage_log_id) REFERENCES unit_coverage_logs(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ unit_coverage_confirmations table ensured (SQLite)');

        await database.run('CREATE INDEX IF NOT EXISTS idx_ucl_course_id ON unit_coverage_logs(course_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_ucl_unit_id ON unit_coverage_logs(unit_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_ucc_coverage_log_id ON unit_coverage_confirmations(coverage_log_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_ucc_student_id ON unit_coverage_confirmations(student_id)');
    } catch (e) {
        console.warn('⚠️ unit_coverage_confirmations migration warning (SQLite):', e.message);
    }

    // Migration: Add student_id to unit_coverage_logs for per-student tracking (SQLite)
    try {
        const uclCols = await database.all('PRAGMA table_info(unit_coverage_logs)');
        const uclColNames = uclCols.map(c => c.name);
        if (!uclColNames.includes('student_id')) {
            await database.run('ALTER TABLE unit_coverage_logs ADD COLUMN student_id TEXT');
            await database.run('CREATE INDEX IF NOT EXISTS idx_ucl_student_id ON unit_coverage_logs(student_id)');
            await database.run('CREATE INDEX IF NOT EXISTS idx_ucl_student_course ON unit_coverage_logs(student_id, course_id, unit_id)');
            console.log('✅ student_id added to unit_coverage_logs (SQLite)');
        }
    } catch (e) {
        console.warn('⚠️ unit_coverage_logs student_id migration warning (SQLite):', e.message);
    }

    // ── CAT Results Module Tables (SQLite) ────────────────────────────────────
    try {
        await database.run(`
            CREATE TABLE IF NOT EXISTS cat_periods (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                academic_year TEXT NOT NULL,
                term_name TEXT NOT NULL,
                cat_name TEXT NOT NULL,
                month TEXT,
                max_marks REAL DEFAULT 100,
                start_date DATE,
                end_date DATE,
                status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Closed', 'Draft')),
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ cat_periods table ensured (SQLite)');
    } catch (e) {
        console.warn('⚠️ cat_periods migration warning (SQLite):', e.message);
    }

    try {
        await database.run(`
            CREATE TABLE IF NOT EXISTS cat_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                course_id TEXT NOT NULL,
                unit_id INTEGER,
                unit_name TEXT NOT NULL,
                cat_period_id INTEGER NOT NULL,
                marks REAL,
                percentage REAL,
                grade TEXT CHECK(grade IN ('Distinction','Credit','Pass','Fail')),
                status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending','Present','Absent','Exempted')),
                workflow_status TEXT DEFAULT 'Draft' CHECK(workflow_status IN ('Draft','Submitted','Approved','Published')),
                entered_by TEXT,
                trainer_name TEXT,
                remarks TEXT,
                submitted_at DATETIME,
                approved_at DATETIME,
                approved_by TEXT,
                published_at DATETIME,
                published_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, unit_id, cat_period_id)
            )
        `);
        await database.run('CREATE INDEX IF NOT EXISTS idx_cat_results_student ON cat_results(student_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_cat_results_course ON cat_results(course_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_cat_results_period ON cat_results(cat_period_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_cat_results_workflow ON cat_results(workflow_status)');
        console.log('✅ cat_results table ensured (SQLite)');
    } catch (e) {
        console.warn('⚠️ cat_results migration warning (SQLite):', e.message);
    }

    try {
        await database.run(`
            CREATE TABLE IF NOT EXISTS result_audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                result_id INTEGER,
                student_id TEXT,
                unit_name TEXT,
                cat_period_id INTEGER,
                action TEXT NOT NULL,
                previous_marks REAL,
                new_marks REAL,
                previous_status TEXT,
                new_status TEXT,
                changed_by TEXT NOT NULL,
                changed_by_name TEXT,
                reason TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ result_audit_logs table ensured (SQLite)');
    } catch (e) {
        console.warn('⚠️ result_audit_logs migration warning (SQLite):', e.message);
    }

    // ── New Academic Structure Tables (SQLite) ────────────────────────────────
    try {
        await database.run(`
            CREATE TABLE IF NOT EXISTS global_units (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                unit_code TEXT UNIQUE NOT NULL,
                unit_name TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'Active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ global_units table ensured (SQLite)');
    } catch (e) {
        console.warn('⚠️ global_units migration warning (SQLite):', e.message);
    }

    try {
        await database.run(`
            CREATE TABLE IF NOT EXISTS program_units (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                course_id TEXT NOT NULL,
                unit_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(course_id, unit_id)
            )
        `);
        console.log('✅ program_units table ensured (SQLite)');
    } catch (e) {
        console.warn('⚠️ program_units migration warning (SQLite):', e.message);
    }

    try {
        await database.run(`
            CREATE TABLE IF NOT EXISTS assessments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                course_id TEXT NOT NULL,
                unit_id INTEGER NOT NULL,
                assessment_name TEXT NOT NULL,
                assessment_type TEXT NOT NULL,
                max_marks REAL NOT NULL,
                weight REAL NOT NULL,
                term TEXT,
                academic_year TEXT,
                status TEXT DEFAULT 'Active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ assessments table ensured (SQLite)');
    } catch (e) {
        console.warn('⚠️ assessments migration warning (SQLite):', e.message);
    }

    try {
        await database.run(`
            CREATE TABLE IF NOT EXISTS assessment_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                course_id TEXT NOT NULL,
                unit_id INTEGER NOT NULL,
                assessment_id INTEGER NOT NULL,
                marks REAL NOT NULL,
                grade TEXT,
                entered_by TEXT,
                status TEXT DEFAULT 'Submitted',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(student_id, course_id, unit_id, assessment_id)
            )
        `);
        console.log('✅ assessment_results table ensured (SQLite)');
    } catch (e) {
        console.warn('⚠️ assessment_results migration warning (SQLite):', e.message);
    }

    // ── UNIT OFFERINGS (SQLite mirror) ────────────────────────────────────────
    try {
        await database.run(`
            CREATE TABLE IF NOT EXISTS unit_offerings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                unit_id INTEGER NOT NULL,
                course_id TEXT,
                offering_name TEXT NOT NULL,
                faculty_id TEXT,
                faculty_name TEXT,
                group_label TEXT DEFAULT 'Default',
                academic_year TEXT,
                term TEXT,
                is_default INTEGER DEFAULT 0,
                status TEXT DEFAULT 'Active',
                dedupe_key TEXT UNIQUE NOT NULL,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await database.run('CREATE INDEX IF NOT EXISTS idx_offerings_unit ON unit_offerings(unit_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_offerings_course ON unit_offerings(course_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_offerings_faculty ON unit_offerings(faculty_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_offerings_status ON unit_offerings(status)');
        console.log('✅ unit_offerings table ensured (SQLite)');
    } catch (e) {
        console.warn('⚠️ unit_offerings migration warning (SQLite):', e.message);
    }

    try {
        await database.run(`
            CREATE TABLE IF NOT EXISTS offering_students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                offering_id INTEGER NOT NULL,
                student_id TEXT NOT NULL,
                enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(offering_id, student_id)
            )
        `);
        await database.run('CREATE INDEX IF NOT EXISTS idx_off_students_offering ON offering_students(offering_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_off_students_student ON offering_students(student_id)');
        console.log('✅ offering_students table ensured (SQLite)');
    } catch (e) {
        console.warn('⚠️ offering_students migration warning (SQLite):', e.message);
    }

    try {
        const crCols = await database.all(`PRAGMA table_info(cat_results)`);
        if (!crCols.some(c => c.name === 'offering_id')) {
            await database.run('ALTER TABLE cat_results ADD COLUMN offering_id INTEGER');
        }
        await database.run('CREATE INDEX IF NOT EXISTS idx_cat_results_offering ON cat_results(offering_id)');
        await database.run(`
            CREATE UNIQUE INDEX IF NOT EXISTS uq_cat_results_offering
            ON cat_results(student_id, offering_id, cat_period_id)
            WHERE offering_id IS NOT NULL
        `);
        console.log('✅ cat_results.offering_id ensured (SQLite)');
    } catch (e) {
        console.warn('⚠️ cat_results.offering_id migration warning (SQLite):', e.message);
    }

    try {
        const guCols = await database.all(`PRAGMA table_info(global_units)`);
        if (!guCols.some(c => c.name === 'is_common')) {
            await database.run('ALTER TABLE global_units ADD COLUMN is_common INTEGER DEFAULT 0');
        }
    } catch (e) {
        console.warn('⚠️ global_units.is_common migration warning (SQLite):', e.message);
    }

    try {
        await database.run(`
            INSERT OR IGNORE INTO unit_offerings (unit_id, course_id, offering_name, faculty_id, faculty_name, group_label, is_default, dedupe_key, created_by)
            SELECT pu.unit_id, pu.course_id,
                   COALESCE(gu.unit_name, 'Unit ' || CAST(pu.unit_id AS TEXT)),
                   tua.faculty_id, f.name, 'Default', 1,
                   pu.unit_id || '|' || pu.course_id || '|*|*|*',
                   'system-migration'
            FROM program_units pu
            JOIN global_units gu ON gu.id = pu.unit_id
            LEFT JOIN trainer_unit_assignments tua
                   ON tua.unit_id = pu.unit_id AND tua.course_id = pu.course_id
            LEFT JOIN faculty f ON f.id = tua.faculty_id
        `);
        await database.run(`
            INSERT OR IGNORE INTO unit_offerings (unit_id, course_id, offering_name, group_label, is_default, dedupe_key, created_by)
            SELECT s.unit_id, s.course_id,
                   COALESCE(gu.unit_name, 'Unit ' || CAST(s.unit_id AS TEXT)),
                   'Default', 1,
                   s.unit_id || '|' || s.course_id || '|*|*|*',
                   'system-migration'
            FROM (SELECT DISTINCT unit_id, course_id FROM cat_results WHERE unit_id IS NOT NULL) s
            LEFT JOIN global_units gu ON gu.id = s.unit_id
            WHERE NOT EXISTS (
                SELECT 1 FROM unit_offerings o
                WHERE o.dedupe_key = s.unit_id || '|' || s.course_id || '|*|*|*'
            )
        `);
        await database.run(`
            UPDATE cat_results SET offering_id = (
                SELECT o.id FROM unit_offerings o
                WHERE o.dedupe_key = cat_results.unit_id || '|' || cat_results.course_id || '|*|*|*'
            )
            WHERE cat_results.offering_id IS NULL AND cat_results.unit_id IS NOT NULL
        `);
        await database.run(`
            INSERT OR IGNORE INTO offering_students (offering_id, student_id)
            SELECT DISTINCT cr.offering_id, cr.student_id
            FROM cat_results cr
            WHERE cr.offering_id IS NOT NULL
        `);
        await database.run(`
            UPDATE global_units SET is_common = 1
            WHERE id IN (
                SELECT unit_id FROM program_units
                GROUP BY unit_id HAVING COUNT(DISTINCT course_id) > 1
            )
        `);
        console.log('✅ Unit offerings backfilled from existing units/marks (SQLite)');
    } catch (e) {
        console.warn('⚠️ unit offerings backfill warning (SQLite):', e.message);
    }

    // ── PROGRAMME HIERARCHY: Diplomas vs Short Courses (SQLite) ──────────────
    try {
        const courseCols = await database.all("PRAGMA table_info('courses')");
        if (!courseCols.some(c => c.name === 'programme_type')) {
            await database.run(`ALTER TABLE courses ADD COLUMN programme_type TEXT NOT NULL DEFAULT 'Short Course'`);
        }
        if (!courseCols.some(c => c.name === 'parent_id')) {
            await database.run('ALTER TABLE courses ADD COLUMN parent_id TEXT');
        }
        const studentCols = await database.all("PRAGMA table_info('students')");
        if (!studentCols.some(c => c.name === 'registration_type')) {
            await database.run('ALTER TABLE students ADD COLUMN registration_type TEXT');
        }
        if (!studentCols.some(c => c.name === 'programme_id')) {
            await database.run('ALTER TABLE students ADD COLUMN programme_id TEXT');
        }
        await database.run('CREATE INDEX IF NOT EXISTS idx_courses_programme_type ON courses(programme_type)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_courses_parent ON courses(parent_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_students_programme ON students(programme_id)');
        await database.run(`
            CREATE TABLE IF NOT EXISTS diploma_streams (
                diploma_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                sort_order INTEGER DEFAULT 0,
                PRIMARY KEY (diploma_id, course_id)
            )
        `);
        console.log('✅ Programme hierarchy columns ensured (SQLite)');
    } catch (e) {
        console.warn('⚠️ programme hierarchy migration warning (SQLite):', e.message);
    }

    try {
        const seedShort = async (id, name, duration, parentId) => {
            await database.run(`
                INSERT INTO courses (id, name, department, instructor, duration, capacity, programme_type, parent_id, status)
                SELECT ?, ?, 'Cosmetology', COALESCE((SELECT instructor FROM courses WHERE id = 'SC-03'), 'To be assigned'),
                       ?, COALESCE((SELECT capacity FROM courses WHERE id = 'SC-03'), 30), 'Short Course', ?, 'Active'
                WHERE NOT EXISTS (SELECT 1 FROM courses WHERE id = ?)
            `, [id, name, duration, parentId, id]);
        };
        await seedShort('SC-10', 'Sista Locks', '3 Months', 'SC-03');
        await seedShort('SC-11', 'Dreadlocks', '2 Months', 'SC-03');
        await database.run(`UPDATE courses SET programme_type = 'Diploma' WHERE id IN ('COS 002', 'SC-03', 'SC-06')`);
        await database.run(`
            UPDATE courses SET parent_id = CASE id
                WHEN 'SC-01' THEN 'SC-06' WHEN 'SC-02' THEN 'SC-06'
                WHEN 'SC-04' THEN 'SC-03' WHEN 'SC-05' THEN 'SC-03'
                WHEN 'SC-10' THEN 'SC-03' WHEN 'SC-11' THEN 'SC-03'
                WHEN 'COS 110' THEN 'SC-03'
            END
            WHERE id IN ('SC-01','SC-02','SC-04','SC-05','SC-10','SC-11','COS 110')
        `);
        await database.run(`
            INSERT OR IGNORE INTO diploma_streams (diploma_id, course_id, sort_order)
            VALUES ('COS 002', 'SC-06', 1), ('COS 002', 'SC-03', 2)
        `);
        console.log('✅ Programme catalogue seeded (diplomas, short-course parents, Cosmetology streams) (SQLite)');
    } catch (e) {
        console.warn('⚠️ programme catalogue seed warning (SQLite):', e.message);
    }

    // ── Certificates module (SQLite) ──────────────────────────────────────────
    try {
        await database.run(`
            CREATE TABLE IF NOT EXISTS certificates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                certificate_number TEXT UNIQUE NOT NULL,
                student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                programme_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
                category TEXT NOT NULL CHECK(category IN ('Diploma','Certificate','Short Course')),
                student_name TEXT NOT NULL,
                course_name TEXT NOT NULL,
                admission_number TEXT,
                completion_date DATE,
                award_date DATE NOT NULL,
                status TEXT NOT NULL DEFAULT 'Issued' CHECK(status IN ('Issued','Revoked')),
                template_version TEXT,
                issued_by TEXT,
                issued_by_name TEXT,
                revoke_reason TEXT,
                revoked_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await database.run('CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_certificates_category ON certificates(category)');
        await database.run(`CREATE UNIQUE INDEX IF NOT EXISTS uq_certificates_active ON certificates(student_id, programme_id) WHERE status = 'Issued'`);
        await database.run(`
            CREATE TABLE IF NOT EXISTS certificate_sequences (
                category TEXT NOT NULL,
                year INTEGER NOT NULL,
                last_number INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (category, year)
            )
        `);
        console.log('✅ Certificates module tables created (SQLite)');
    } catch (e) {
        console.warn('⚠️ certificates migration warning (SQLite):', e.message);
    }

    // ── Multi-programme enrolment (SQLite) ────────────────────────────────────
    try {
        await database.run(`
            CREATE TABLE IF NOT EXISTS student_programmes (
                student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
                programme_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (student_id, programme_id)
            )
        `);
        await database.run('CREATE INDEX IF NOT EXISTS idx_student_programmes_programme ON student_programmes(programme_id)');
        await database.run(`
            INSERT OR IGNORE INTO student_programmes (student_id, programme_id)
            SELECT id, programme_id FROM students
            WHERE programme_id IS NOT NULL AND programme_id <> ''
        `);
        console.log('✅ student_programmes junction table ensured + backfilled (SQLite)');
    } catch (e) {
        console.warn('⚠️ student_programmes migration warning (SQLite):', e.message);
    }

    // ── Inventory Requisition System (SQLite) ─────────────────────────────────
    try {
        await database.run(`
            CREATE TABLE IF NOT EXISTS inv_requisitions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                requisition_number TEXT UNIQUE NOT NULL,
                requester_id TEXT NOT NULL,
                requester_email TEXT NOT NULL,
                requester_name TEXT NOT NULL,
                department TEXT NOT NULL,
                purpose TEXT,
                priority TEXT DEFAULT 'Normal' CHECK(priority IN ('Normal', 'Urgent')),
                required_date DATE,
                status TEXT DEFAULT 'DRAFT' CHECK(status IN (
                    'DRAFT','PENDING','APPROVED','REJECTED',
                    'MODIFICATION_REQUIRED','PARTIALLY_ISSUED','ISSUED','COMPLETED','CANCELLED'
                )),
                approved_by TEXT,
                approved_by_name TEXT,
                approved_at DATETIME,
                approval_comments TEXT,
                rejected_by TEXT,
                rejected_by_name TEXT,
                rejected_at DATETIME,
                rejection_reason TEXT,
                modification_requested_by TEXT,
                modification_requested_by_name TEXT,
                modification_note TEXT,
                modification_requested_at DATETIME,
                issued_by TEXT,
                issued_by_name TEXT,
                issued_at DATETIME,
                confirmed_by TEXT,
                confirmed_by_name TEXT,
                confirmed_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await database.run(`
            CREATE TABLE IF NOT EXISTS inv_requisition_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                requisition_id INTEGER NOT NULL,
                item_id INTEGER,
                item_name TEXT NOT NULL,
                category_name TEXT,
                requested_qty INTEGER NOT NULL,
                approved_qty INTEGER DEFAULT 0,
                issued_qty INTEGER DEFAULT 0,
                unit_type TEXT DEFAULT 'Piece',
                purpose_remarks TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (requisition_id) REFERENCES inv_requisitions(id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES inv_items(id)
            )
        `);
        await database.run(`
            CREATE TABLE IF NOT EXISTS inv_stock_reservations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_id INTEGER NOT NULL,
                requisition_id INTEGER NOT NULL,
                requisition_item_id INTEGER NOT NULL,
                reserved_qty INTEGER NOT NULL,
                status TEXT DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','RELEASED','FULFILLED')),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (item_id) REFERENCES inv_items(id),
                FOREIGN KEY (requisition_id) REFERENCES inv_requisitions(id) ON DELETE CASCADE,
                FOREIGN KEY (requisition_item_id) REFERENCES inv_requisition_items(id) ON DELETE CASCADE
            )
        `);
        await database.run(`
            CREATE TABLE IF NOT EXISTS inv_audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                user_email TEXT,
                user_name TEXT,
                action TEXT NOT NULL,
                module TEXT DEFAULT 'inventory',
                record_type TEXT,
                record_id TEXT,
                previous_value TEXT,
                new_value TEXT,
                ip_address TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Indexes
        await database.run('CREATE INDEX IF NOT EXISTS idx_inv_req_status ON inv_requisitions(status)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_inv_req_requester ON inv_requisitions(requester_email)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_inv_req_dept ON inv_requisitions(department)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_inv_req_created ON inv_requisitions(created_at)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_inv_req_items_req ON inv_requisition_items(requisition_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_inv_req_items_item ON inv_requisition_items(item_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_inv_reservations_item ON inv_stock_reservations(item_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_inv_reservations_req ON inv_stock_reservations(requisition_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_inv_reservations_status ON inv_stock_reservations(status)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_inv_audit_record ON inv_audit_logs(record_type, record_id)');
        await database.run('CREATE INDEX IF NOT EXISTS idx_inv_audit_user ON inv_audit_logs(user_email)');
        console.log('✅ Inventory requisition system tables ensured (SQLite)');
    } catch (e) {
        console.warn('⚠️ Inventory requisition migration warning (SQLite):', e.message);
    }

    // ── inv_items image_url column (SQLite parity with Postgres schema) ─────
    try {
        const invItemsCols = await database.all("PRAGMA table_info('inv_items')");
        const invItemsColNames = invItemsCols.map(c => c.name);
        if (!invItemsColNames.includes('image_url')) {
            await database.run('ALTER TABLE inv_items ADD COLUMN image_url TEXT');
            console.log('✅ image_url column added to inv_items (SQLite)');
        }
    } catch (e) {
        console.warn('⚠️ inv_items image_url migration warning (SQLite):', e.message);
    }

    // ── notifications link_data column ───────────────────────────────────────
    try {
        const notifCols = await database.all("PRAGMA table_info('notifications')");
        const notifColNames = notifCols.map(c => c.name);
        if (!notifColNames.includes('link_data')) {
            await database.run('ALTER TABLE notifications ADD COLUMN link_data TEXT');
            console.log('✅ link_data column added to notifications (SQLite)');
        }
        if (!notifColNames.includes('notification_category')) {
            await database.run("ALTER TABLE notifications ADD COLUMN notification_category TEXT DEFAULT 'system'");
            console.log('✅ notification_category column added to notifications (SQLite)');
        }
    } catch (e) {
        console.warn('⚠️ notifications columns migration warning (SQLite):', e.message);
    }
}

/**
 * Creates high-performance database indexes on core tables for fast queries.
 */
export async function ensureHighPerformanceIndexes(database) {
    const isPostgres = !!getProcessedDatabaseUrl();
    const isMongo = !!process.env.MONGODB_URI;
    if (isMongo) return;

    const indexQueries = [
        'CREATE INDEX IF NOT EXISTS idx_students_email ON students(email)',
        'CREATE INDEX IF NOT EXISTS idx_students_status ON students(status)',
        'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
        'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)',
        'CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date)',
        'CREATE INDEX IF NOT EXISTS idx_attendance_course ON attendance(course)',
        'CREATE INDEX IF NOT EXISTS idx_cat_results_student ON cat_results(student_id)',
        'CREATE INDEX IF NOT EXISTS idx_cat_results_period_unit ON cat_results(cat_period_id, unit_id)',
        'CREATE INDEX IF NOT EXISTS idx_cat_results_workflow ON cat_results(workflow_status)',
        'CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id)',
        'CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date)',
        'CREATE INDEX IF NOT EXISTS idx_student_fees_student ON student_fees(student_id)',
        'CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key)'
    ];

    try {
        for (const sql of indexQueries) {
            if (isPostgres) {
                await database.query(sql).catch(() => {});
            } else {
                await database.run(sql).catch(() => {});
            }
        }
        console.log('⚡ High-performance database indexes verified & active');

        // Self-healing: Repair any legacy records where teacher/lecturer was erroneously stored as 'Admin'
        try {
            if (isPostgres) {
                await database.query(`
                    UPDATE unit_coverage_logs ucl
                    SET teacher_name = c.instructor
                    FROM courses c
                    WHERE ucl.course_id = c.id
                      AND (ucl.teacher_name ILIKE '%admin%' OR ucl.teacher_name = 'Unknown' OR ucl.teacher_name IS NULL)
                      AND c.instructor IS NOT NULL AND c.instructor != ''
                `).catch(() => {});

                await database.query(`
                    UPDATE student_unit_marks sum
                    SET lecturer = c.instructor
                    FROM courses c
                    WHERE sum.course_id = c.id
                      AND (sum.lecturer ILIKE '%admin%' OR sum.lecturer = 'Unknown' OR sum.lecturer IS NULL)
                      AND c.instructor IS NOT NULL AND c.instructor != ''
                `).catch(() => {});

                await database.query(`
                    UPDATE cat_results cr
                    SET trainer_name = c.instructor
                    FROM courses c
                    WHERE cr.course_id = c.id
                      AND (cr.trainer_name ILIKE '%admin%' OR cr.trainer_name = 'Unknown' OR cr.trainer_name IS NULL)
                      AND c.instructor IS NOT NULL AND c.instructor != ''
                `).catch(() => {});
            } else {
                await database.run(`
                    UPDATE unit_coverage_logs
                    SET teacher_name = (SELECT instructor FROM courses WHERE courses.id = unit_coverage_logs.course_id)
                    WHERE (LOWER(teacher_name) LIKE '%admin%' OR teacher_name = 'Unknown' OR teacher_name IS NULL)
                      AND EXISTS (SELECT 1 FROM courses WHERE courses.id = unit_coverage_logs.course_id AND instructor IS NOT NULL AND instructor != '')
                `).catch(() => {});

                await database.run(`
                    UPDATE student_unit_marks
                    SET lecturer = (SELECT instructor FROM courses WHERE courses.id = student_unit_marks.course_id)
                    WHERE (LOWER(lecturer) LIKE '%admin%' OR lecturer = 'Unknown' OR lecturer IS NULL)
                      AND EXISTS (SELECT 1 FROM courses WHERE courses.id = student_unit_marks.course_id AND instructor IS NOT NULL AND instructor != '')
                `).catch(() => {});

                await database.run(`
                    UPDATE cat_results
                    SET trainer_name = (SELECT instructor FROM courses WHERE courses.id = cat_results.course_id)
                    WHERE (LOWER(trainer_name) LIKE '%admin%' OR trainer_name = 'Unknown' OR trainer_name IS NULL)
                      AND EXISTS (SELECT 1 FROM courses WHERE courses.id = cat_results.course_id AND instructor IS NOT NULL AND instructor != '')
                `).catch(() => {});
            }
        } catch (repairErr) {
            console.warn('⚠️ Legacy teacher assignment repair warning:', repairErr.message);
        }
    } catch (err) {
        console.warn('⚠️ High-performance index check warning:', err.message);
    }
}


/**
 * Translate SQLite-specific functions to PostgreSQL equivalents
 */
export const translateSqlForPostgres = (sql) => {
    let pgSql = sql;
    // Handle date('now') -> CURRENT_DATE
    pgSql = pgSql.replace(/date\('now'\)/gi, 'CURRENT_DATE');
    // Handle date('now', '+30 days') or date('now', '-30 days') -> CURRENT_DATE + INTERVAL '30 days'
    pgSql = pgSql.replace(/date\('now',\s*'([+-])\s*(\d+)\s+days'\)/gi, "CURRENT_DATE $1 INTERVAL '$2 days'");
    // Handle datetime('now') -> CURRENT_TIMESTAMP
    pgSql = pgSql.replace(/datetime\('now'\)/gi, 'CURRENT_TIMESTAMP');
    return pgSql;
};

/**
 * Resolve the SQL executor for the current call. Inside an active Postgres
 * transaction this returns the transaction's dedicated client so every statement
 * shares one connection (real atomicity); otherwise the normal pool/connection.
 */
async function getExecutor() {
    const tx = txStore.getStore();
    if (tx?.client) return tx.client;
    return getDb();
}

/**
 * Generic query function
 */
export async function query(sql, params = []) {
    const database = await getExecutor();
    const sanitizedParams = (params || []).map(p => p === undefined ? null : p);
    if (getProcessedDatabaseUrl()) {
        let paramCount = 0;
        let pgSql = translateSqlForPostgres(sql).replace(/\?/g, () => `$${++paramCount}`);
        try {
            const result = await database.query(pgSql, sanitizedParams);
            return result.rows;
        } catch (err) {
            console.error('🐘 Postgres Query Error:', err.message);
            console.error('SQL:', pgSql);
            console.error('Params:', sanitizedParams);
            throw err;
        }
    }
    return database.all(sql, sanitizedParams);
}

/**
 * Generic query one function
 */
export async function queryOne(sql, params = []) {
    const database = await getExecutor();
    const sanitizedParams = (params || []).map(p => p === undefined ? null : p);
    if (getProcessedDatabaseUrl()) {
        let paramCount = 0;
        let pgSql = translateSqlForPostgres(sql).replace(/\?/g, () => `$${++paramCount}`);
        try {
            const result = await database.query(pgSql, sanitizedParams);
            return result.rows[0];
        } catch (err) {
            console.error('🐘 Postgres QueryOne Error:', err.message);
            console.error('SQL:', pgSql);
            throw err;
        }
    }
    return database.get(sql, sanitizedParams);
}

/**
 * Generic run function for write operations
 */
export async function run(sql, params = []) {
    const database = await getExecutor();
    const sanitizedParams = (params || []).map(p => p === undefined ? null : p);
    if (getProcessedDatabaseUrl()) {
        let paramCount = 0;
        let pgSql = translateSqlForPostgres(sql).replace(/\?/g, () => `$${++paramCount}`);

        pgSql = pgSql.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO');

        // NOTE: Do NOT add implicit ON CONFLICT rewrites here. A previous rewrite
        // turned every `INSERT INTO users` into an upsert that overwrote the
        // password/status of any existing account with the same email — an
        // account-takeover primitive and a divergence from SQLite behavior.
        // Conflicts must surface as unique-violation errors; callers that want
        // upsert semantics write an explicit ON CONFLICT clause.

        // Add RETURNING id if it's an INSERT statement and doesn't have one
        // Skip for tables that have no 'id' column (composite-key / junction tables)
        const noIdTables = ['student_fees', 'system_settings', 'diploma_streams', 'student_programmes'];
        const tableNameMatch = pgSql.match(/INSERT\s+INTO\s+(\w+)/i);
        const tableName = tableNameMatch ? tableNameMatch[1].toLowerCase() : '';

        if (pgSql.trim().toUpperCase().startsWith('INSERT') &&
            !pgSql.toUpperCase().includes('RETURNING') &&
            !noIdTables.includes(tableName)) {
            pgSql += ' RETURNING id';
        }

        try {
            const result = await database.query(pgSql, sanitizedParams);
            // For Postgres, the result of RETURNING id is in result.rows[0].id
            const lastID = (result.rows && result.rows[0]) ? (result.rows[0].id || result.rows[0].ID) : null;
            return { lastID, changes: result.rowCount };
        } catch (err) {
            console.error('🐘 Postgres Run Error:', err.message);
            console.error('SQL:', pgSql);
            console.error('Params:', sanitizedParams);
            throw err;
        }
    }
    return database.run(sql, sanitizedParams);
}

/**
 * Executes a callback function inside a database transaction.
 * Automatically handles BEGIN, COMMIT, and ROLLBACK for SQLite, PostgreSQL, and MongoDB.
 */
export async function withTransaction(fn) {
    const database = await getDb();
    const isPostgres = !!getProcessedDatabaseUrl();
    const isMongo = !!process.env.MONGODB_URI;

    if (isMongo) {
        const session = await mongoose.startSession().catch(() => null);
        if (session) {
            try {
                session.startTransaction();
                const result = await fn(session);
                await session.commitTransaction();
                session.endSession();
                return result;
            } catch (err) {
                await session.abortTransaction().catch(() => {});
                session.endSession();
                throw err;
            }
        }
        return await fn(null);
    }

    if (isPostgres) {
        // Check out ONE dedicated client so BEGIN, every inner statement, and
        // COMMIT all run on the same connection. Inner query/run/queryOne calls
        // pick this up via txStore (see getExecutor).
        const client = await database.connect();
        try {
            await client.query('BEGIN');
            const result = await txStore.run({ client }, () => fn(client));
            await client.query('COMMIT');
            return result;
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    } else {
        await database.run('BEGIN IMMEDIATE');
        try {
            const result = await fn();
            await database.run('COMMIT');
            return result;
        } catch (err) {
            await database.run('ROLLBACK').catch(() => {});
            throw err;
        }
    }
}


/**
 * Seed all default system setting keys if they are not already set.
 */
export async function seedNewSettings(database) {
    const settings = {
        college_name: 'Beautex Technical Training College',
        college_motto: 'Empowering Minds. Shaping Futures.',
        college_address: 'Main Campus, Nairobi, Kenya',
        college_phone: '+254 700 000000',
        college_email: 'info@beautex.edu',
        college_website: 'www.beautex.edu',
        college_socials: '{}',
        college_reg_number: 'TVETA/001/2026',
        college_kra_pin: 'P051234567A',
        college_principal: 'Dr. Jane Doe',
        college_stamp: '',
        college_signature: '',
        intake_jan_status: 'open',
        intake_jan_capacity: '100',
        intake_may_status: 'open',
        intake_may_capacity: '100',
        intake_sept_status: 'open',
        intake_sept_capacity: '100',
        intake_rolling_status: 'open',
        intake_rolling_capacity: '100',
        intake_online_app_enabled: 'true',
        admission_number_format: 'BTC/2026/001',
        student_categories: 'Full-Time, Part-Time, Weekend, Online, Short Course',
        student_statuses: 'Active, Completed, Graduated, Deferred, Suspended, Expelled',
        student_portal_results: 'true',
        student_portal_fees: 'true',
        student_portal_timetables: 'true',
        student_portal_materials: 'true',
        student_portal_certificates: 'true',
        student_portal_attendance: 'true',
        assessment_types: 'CAT, Practical Assessment, Mid-Term Exam, End-Term Exam, Final Examination',
        grading_distinction_min: '70',
        grading_credit_min: '60',
        grading_pass_min: '50',
        grading_fail_min: '0',
        attendance_mode: 'daily',
        attendance_status_types: 'Present, Absent, Late, Sick, Excused',
        fee_categories: 'Registration Fee, Tuition Fee, Practical Fee, Examination Fee, Graduation Fee, Accommodation Fee',
        payment_methods: 'M-Pesa, Bank Deposit, Bank Transfer, Cash, Card Payments',
        finance_penalty_rate: '0',
        finance_discount_rate: '0',
        finance_scholarship_types: 'Need-based, Merit-based, Sport',
        finance_installments_allowed: 'true',
        sms_admission_confirm: 'true',
        sms_fee_reminder: 'true',
        sms_cat_notify: 'true',
        sms_exam_notify: 'true',
        sms_grad_notify: 'true',
        whatsapp_integration: 'false',
        staff_categories: 'Lecturers, Trainers, ICT Administrators, Finance Officers, Registrars, Support Staff',
        staff_roles: 'Super Admin, Admin, Registrar, Accountant, Lecturer, Trainer',
        certificate_short_course_template: 'standard',
        certificate_award_template: 'standard',
        certificate_diploma_template: 'standard',
        certificate_no_format: 'CERT/2026/{ID}',
        graduation_no_format: 'GRAD/2026/{ID}',
        qr_verification_enabled: 'true',
        digital_signatures_enabled: 'true',
        lms_assignments_enabled: 'true',
        lms_materials_enabled: 'true',
        lms_online_exams_enabled: 'true',
        lms_online_classes_enabled: 'true',
        lms_discussions_enabled: 'true',
        password_policy_min_len: '8',
        password_policy_require_special: 'true',
        two_factor_auth: 'false',
        session_timeout: '30',
        failed_login_attempts: '5',
        activity_monitoring_enabled: 'true',
        backup_interval: 'daily',
        backup_types: 'database,files,full',
        login_banner_url: '',
        portal_theme_colors: '#800000',
        sidebar_colors: '#7a0000',
        academic_term_name: 'Term 2 2026',
        academic_term_start: '2026-05-04',
        academic_term_end: '2026-07-31',
        academic_exam_start: '2026-07-20',
        academic_exam_end: '2026-07-30',
        academic_holiday_start: '2026-08-01',
        academic_holiday_end: '2026-08-31',
        template_admission_sms: 'Dear {name}, welcome to BTTC. Your Admission No is {admission_no}. Classes start on {start_date}.',
        template_fee_reminder_sms: 'Dear Parent/Guardian, a fee balance of KES {balance} remains for {name}. Please clear before {due_date}.',
        template_results_sms: 'Dear Student, Term results have been published. GPA: {gpa}. Check the student portal for details.',
        template_absentee_sms: 'Dear Parent/Guardian, {name} was marked absent today {date} without permission.',
        inventory_low_stock_threshold: '10',
        inventory_auto_alert_enabled: 'true',
        inventory_depreciation_method: 'straight_line',
        inventory_default_store: 'Main Store',
        report_header_text: 'BEAUTEX TECHNICAL TRAINING COLLEGE\nOfficial Academic Transcript',
        report_footer_text: 'This is a computer generated document. For verification, scan the QR code.',
        report_show_grading_scale: 'true',
        report_signature_title: 'Registrar of Academic Affairs',
        portal_maintenance_mode: 'false',
        portal_announcement_banner: 'Welcome to the new portal! Semester registration deadline extended to June 30th.',
        portal_support_email: 'support@beautex.edu',
        portal_support_phone: '+254 711 000000'
    };

    try {
        const isPostgres = getActiveDbEngine() === 'postgres';
        let existingKeys = [];
        if (isPostgres) {
            const res = await database.query('SELECT key FROM system_settings');
            existingKeys = res.rows.map(r => r.key || r.KEY);
        } else {
            const res = await database.all('SELECT key FROM system_settings');
            existingKeys = res.map(r => r.key || r.KEY);
        }
        const existingSet = new Set(existingKeys.map(k => String(k).trim()));

        // Filter keys that are missing
        const missingSettings = Object.entries(settings).filter(([key]) => !existingSet.has(key));

        if (missingSettings.length > 0) {
            console.log(`🌱 Seeding ${missingSettings.length} missing system settings...`);
            if (isPostgres) {
                await database.query('BEGIN');
                try {
                    for (const [key, val] of missingSettings) {
                        await database.query('INSERT INTO system_settings (key, value) VALUES ($1, $2)', [key, val]);
                    }
                    await database.query('COMMIT');
                } catch (err) {
                    await database.query('ROLLBACK');
                    throw err;
                }
            } else {
                await database.run('BEGIN');
                try {
                    for (const [key, val] of missingSettings) {
                        await database.run('INSERT INTO system_settings (key, value) VALUES (?, ?)', [key, val]);
                    }
                    await database.run('COMMIT');
                } catch (err) {
                    await database.run('ROLLBACK');
                    throw err;
                }
            }
        }
        console.log('🌱 Settings parameters check/sync complete.');
    } catch (e) {
        console.error('⚠️ seedNewSettings error:', e.message);
    }
}

export default { getDb, query, queryOne, run, withTransaction, seedNewSettings };
