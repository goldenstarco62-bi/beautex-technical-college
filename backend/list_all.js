import 'dotenv/config';
import { query } from './src/config/database.js';

async function listAll() {
    try {
        const courses = await query('SELECT id, name, status, instructor FROM courses');
        console.log('COURSES_START');
        console.log(JSON.stringify(courses, null, 2));
        console.log('COURSES_END');

        const faculty = await query('SELECT id, name, email, courses FROM faculty');
        console.log('FACULTY_START');
        console.log(JSON.stringify(faculty, null, 2));
        console.log('FACULTY_END');
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

listAll();
