import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
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
                });
                pgPool.on('error', (err) => {
                    console.error('Unexpected error on idle Postgres client', err);
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
                console.log('ℹ️ Base tables present. Running safe schema patch...');
                const supabaseSchemaPath = path.join(__dirname, '../models/supabase_schema.sql');
                if (fs.existsSync(supabaseSchemaPath)) {
                    const supabaseSchema = fs.readFileSync(supabaseSchemaPath, 'utf-8');
                    await database.query(supabaseSchema);
                    console.log('✅ PostgreSQL schema check/update complete.');
                }
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
}

/**
 * Translate SQLite-specific functions to PostgreSQL equivalents
 */
const translateSqlForPostgres = (sql) => {
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
 * Generic query function
 */
export async function query(sql, params = []) {
    const database = await getDb();
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
    const database = await getDb();
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
    const database = await getDb();
    const sanitizedParams = (params || []).map(p => p === undefined ? null : p);
    if (getProcessedDatabaseUrl()) {
        let paramCount = 0;
        let pgSql = translateSqlForPostgres(sql).replace(/\?/g, () => `$${++paramCount}`);

        pgSql = pgSql.replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO');

        if (pgSql.trim().toUpperCase().startsWith('INSERT') && !pgSql.toLowerCase().includes('on conflict')) {
            const lowerPgSql = pgSql.toLowerCase();
            const insertTableMatch = lowerPgSql.match(/insert\s+into\s+([\w.]+)/);
            const targetTable = insertTableMatch ? insertTableMatch[1].replace(/['"`]/g, '') : '';

            if (targetTable === 'users' || targetTable.endsWith('.users')) {
                pgSql += ' ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, must_change_password = EXCLUDED.must_change_password, status = EXCLUDED.status';
            }
        }

        // Add RETURNING id if it's an INSERT statement and doesn't have one
        // Skip for tables known to not have an 'id' column (e.g. student_fees)
        const noIdTables = ['student_fees', 'system_settings'];
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

export default { getDb, query, queryOne, run };
