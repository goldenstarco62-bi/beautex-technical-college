import 'dotenv/config';
import { query, queryOne } from './src/config/database.js';

async function debugFaculty() {
    try {
        console.log('🔍 Debugging Faculty & Courses...');

        // Use correct columns based on schema
        const faculty = await query('SELECT id, name, email, courses, position FROM faculty');
        console.log('\n--- Faculty Records ---');
        console.table(faculty);

        const courses = await query('SELECT id, name, instructor FROM courses');
        console.log('\n--- Course Records ---');
        console.table(courses);

        if (faculty.length > 0) {
            for (const f of faculty) {
                console.log(`\nTesting retrieval for: ${f.email} (${f.name})`);

                let facultyCourses = [];
                try {
                    // Try to handle both JSON array string and comma-separated string if that's what's happening
                    if (f.courses && f.courses.startsWith('[')) {
                        facultyCourses = JSON.parse(f.courses);
                    } else if (f.courses) {
                        facultyCourses = f.courses.split(',').map(s => s.trim());
                    }
                } catch (e) {
                    console.log('Failed to parse courses:', f.courses);
                }

                console.log('Parsed Assigned Courses:', facultyCourses);

                const placeholders = facultyCourses.length > 0 ? facultyCourses.map(() => '?').join(',') : "''";
                const sql = `
                    SELECT name, instructor FROM courses 
                    WHERE (instructor = ? OR name IN (${placeholders}))
                    AND status = 'Active'
                `;
                const foundCourses = await query(sql, [f.name, ...facultyCourses]);
                console.log('SQL Results:', foundCourses);
            }
        }

    } catch (err) {
        console.error('Debug failed:', err);
    }
    process.exit(0);
}

debugFaculty();
