import dotenv from 'dotenv';
dotenv.config();

import { getDb, query } from '../config/database.js';

async function debugGrades() {
    try {
        const db = await getDb();
        const isMongo = db.constructor.name === 'NativeConnection';

        console.log(`Connected to database type: ${isMongo ? 'MongoDB' : 'SQLite/Postgres'}`);

        if (isMongo) {
            console.log('Skipping SQLite debug as MongoDB is active.');
            process.exit(0);
        }

        const grades = await query('SELECT * FROM grades');
        const students = await query('SELECT * FROM students');

        console.log(`Found ${grades.length} grades and ${students.length} students.`);

        for (const grade of grades) {
            const student = students.find(s => s.id === grade.student_id);
            if (student) {
                console.log(`✅ MATCH: Grade ${grade.id} (student_id: ${grade.student_id}, month: ${grade.month || 'MISSING'}) -> Student ${student.name}`);
            } else {
                console.error(`❌ NO MATCH: Grade ${grade.id} (student_id: ${grade.student_id}) -> No student found!`);
            }
        }

        // Output raw first grade and student for inspection
        if (grades.length > 0) console.log('Sample Grade:', grades[0]);
        if (students.length > 0) console.log('Sample Student:', students[0]);

        process.exit(0);
    } catch (error) {
        console.error('Debug failed:', error);
        process.exit(1);
    }
}

debugGrades();
