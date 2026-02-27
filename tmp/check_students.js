
import { query } from '../backend/src/config/database.js';

async function checkStudents() {
    try {
        const students = await query("SELECT COUNT(*) as count FROM students");
        console.log('Total Students:', students[0].count);

        const courses = await query("SELECT COUNT(*) as count FROM courses");
        console.log('Total Courses:', courses[0].count);

        const faculty = await query("SELECT COUNT(*) as count FROM faculty");
        console.log('Total Faculty:', faculty[0].count);

        if (students[0].count > 0) {
            const first = await query("SELECT * FROM students LIMIT 1");
            console.log('First Student:', JSON.stringify(first[0], null, 2));
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

checkStudents();
