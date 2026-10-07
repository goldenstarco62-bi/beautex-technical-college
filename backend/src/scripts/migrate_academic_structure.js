import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { getDb, getActiveDbEngine } from '../config/database.js';

async function runMigration() {
    console.log('🚀 Starting Academic Structure Migration...');
    const db = await getDb();
    const engine = getActiveDbEngine();
    console.log(`📂 Connected to engine: ${engine}`);
    
    try {
        if (engine === 'postgres') {
            await migratePostgres(db);
        } else {
            await migrateSqlite(db);
        }
        console.log('✅ Academic Structure Migration Completed Successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration Failed:', error);
        process.exit(1);
    }
}

async function migratePostgres(db) {
    // 1. Create new tables
    await db.query(`
        CREATE TABLE IF NOT EXISTS global_units (
            id SERIAL PRIMARY KEY,
            unit_code TEXT UNIQUE NOT NULL,
            unit_name TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS program_units (
            id SERIAL PRIMARY KEY,
            course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            unit_id INTEGER NOT NULL REFERENCES global_units(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(course_id, unit_id)
        );

        CREATE TABLE IF NOT EXISTS assessments (
            id SERIAL PRIMARY KEY,
            course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            unit_id INTEGER NOT NULL REFERENCES global_units(id) ON DELETE CASCADE,
            assessment_name TEXT NOT NULL,
            assessment_type TEXT NOT NULL,
            max_marks DECIMAL NOT NULL,
            weight DECIMAL NOT NULL,
            term TEXT,
            academic_year TEXT,
            status TEXT DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS assessment_results (
            id SERIAL PRIMARY KEY,
            student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
            course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
            unit_id INTEGER NOT NULL REFERENCES global_units(id) ON DELETE CASCADE,
            assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
            marks DECIMAL NOT NULL,
            grade TEXT,
            entered_by TEXT,
            status TEXT DEFAULT 'Submitted',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(student_id, course_id, unit_id, assessment_id)
        );
        
        CREATE TABLE IF NOT EXISTS trainer_unit_assignments (
            id SERIAL PRIMARY KEY,
            trainer_id TEXT NOT NULL,
            course_id TEXT NOT NULL,
            unit_id INTEGER NOT NULL REFERENCES global_units(id) ON DELETE CASCADE,
            class_id TEXT,
            academic_year TEXT,
            term TEXT,
            status TEXT DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(trainer_id, course_id, unit_id)
        );
    `);

    // We keep course_units, student_unit_marks, grades intact for now as backup, 
    // but the system will be switched to use global_units, program_units, assessments, assessment_results.

    // 2. Extract unique units from old course_units
    const oldUnits = await db.query('SELECT DISTINCT name FROM course_units');
    for (const row of oldUnits.rows) {
        const unitName = row.name.trim();
        const unitCode = unitName.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 1000);
        await db.query(
            'INSERT INTO global_units (unit_code, unit_name) VALUES ($1, $2) ON CONFLICT (unit_code) DO NOTHING',
            [unitCode, unitName]
        );
    }

    // 3. Migrate fake courses to global_units
    const fakeCourses = ['Business Skills', 'Communication Skills', 'Life Skills'];
    for (const fc of fakeCourses) {
        const check = await db.query('SELECT * FROM courses WHERE name ILIKE $1', [`%${fc}%`]);
        if (check.rows.length > 0) {
            console.log(`Found fake course: ${fc}. Moving to global_units...`);
            const unitCode = fc.substring(0, 3).toUpperCase() + '101';
            await db.query(
                'INSERT INTO global_units (unit_code, unit_name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [unitCode, fc]
            );
            // Optionally, delete from courses if no students depend on it as their main course.
            // But we should leave it to avoid breaking FK constraints if there are any.
        }
    }
}

async function migrateSqlite(db) {
    // Similar implementation for SQLite
    await db.exec(`
        CREATE TABLE IF NOT EXISTS global_units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unit_code TEXT UNIQUE NOT NULL,
            unit_name TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'Active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS program_units (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            course_id TEXT NOT NULL,
            unit_id INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (unit_id) REFERENCES global_units(id) ON DELETE CASCADE,
            UNIQUE(course_id, unit_id)
        );

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
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (unit_id) REFERENCES global_units(id) ON DELETE CASCADE
        );

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
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
            FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
            FOREIGN KEY (unit_id) REFERENCES global_units(id) ON DELETE CASCADE,
            FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE,
            UNIQUE(student_id, course_id, unit_id, assessment_id)
        );

        CREATE TABLE IF NOT EXISTS trainer_unit_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trainer_id TEXT NOT NULL,
            course_id TEXT NOT NULL,
            unit_id INTEGER NOT NULL,
            class_id TEXT,
            academic_year TEXT,
            term TEXT,
            status TEXT DEFAULT 'Active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (unit_id) REFERENCES global_units(id) ON DELETE CASCADE,
            UNIQUE(trainer_id, course_id, unit_id)
        );
    `);
    
    // 2. Extract unique units from old course_units
    const oldUnits = await db.all('SELECT DISTINCT name FROM course_units');
    for (const row of oldUnits) {
        const unitName = row.name.trim();
        const unitCode = unitName.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 1000);
        await db.run(
            'INSERT OR IGNORE INTO global_units (unit_code, unit_name) VALUES (?, ?)',
            [unitCode, unitName]
        );
    }
}

runMigration();
