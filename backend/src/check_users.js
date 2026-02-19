import 'dotenv/config';
import { queryOne, query } from './config/database.js';

async function checkUsers() {
    try {
        // Check all users
        const users = await query('SELECT id, email, role, status FROM users ORDER BY role');
        console.log('\n📊 All Users in Database:\n');
        console.table(users);

        // Check student users
        const students = await query("SELECT id, email, role FROM users WHERE role = 'student' LIMIT 5");
        console.log(`\n👨‍🎓 Sample Student Users (${students.length}):`);
        console.table(students);

        // Check teacher users
        const teachers = await query("SELECT id, email, role FROM users WHERE role = 'teacher' LIMIT 5");
        console.log(`\n👨‍🏫 Sample Teacher Users (${teachers.length}):`);
        console.table(teachers);

    } catch (err) {
        console.error('Error:', err);
    }
    process.exit(0);
}

checkUsers();
