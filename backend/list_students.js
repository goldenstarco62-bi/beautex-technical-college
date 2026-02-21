import 'dotenv/config';
import { query } from './src/config/database.js';

async function listStudents() {
    try {
        const students = await query('SELECT id, name, email FROM students');
        console.log(JSON.stringify(students, null, 2));
    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}

listStudents();
