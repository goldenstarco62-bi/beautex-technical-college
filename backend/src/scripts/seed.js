import 'dotenv/config';
import { getDb, initializeDatabase, query, queryOne, run } from '../config/database.js';
import bcrypt from 'bcryptjs';

async function seed() {
    try {
        const db = await getDb();

        console.log('🐘 Initializing database schema...');
        await initializeDatabase();

        // 1. Seed Super Admin
        let userCount = 0;
        try {
            const userCountResult = await query('SELECT COUNT(*) as count FROM users');
            userCount = parseInt(userCountResult[0]?.count || 0);
        } catch (e) {
            console.log('ℹ️ Users table check failed, attempting to continue...');
        }

        if (userCount === 0) {
            console.log('🌱 Seeding superadmin account...');
            const hashedPassword = await bcrypt.hash('Beautex@2026', 10);
            await run(
                'INSERT INTO users (email, password, role, status, must_change_password) VALUES (?, ?, ?, ?, ?)',
                ['beautexcollege01@gmail.com', hashedPassword, 'superadmin', 'Active', false]
            );
            console.log('✅ Base superadmin account created: beautexcollege01@gmail.com');
        } else {
            console.log(`ℹ️ skipping user seed: ${userCount} users already exist.`);
        }

        // 2. Seed initial courses
        let courseCount = 0;
        try {
            const courseCountResult = await query('SELECT COUNT(*) as count FROM courses');
            courseCount = parseInt(courseCountResult[0]?.count || 0);
        } catch (e) {
            console.log('ℹ️ Courses table check failed.');
        }

        if (courseCount === 0) {
            console.log('🌱 Seeding sample courses...');
            const sampleCourses = [
                { id: 'SC-01', name: 'Makeup', dept: 'Beauty', dur: '1 Month' },
                { id: 'SC-02', name: 'Nail Technology', dept: 'Beauty', dur: '6 Weeks' },
                { id: 'SC-03', name: 'Hairdressing', dept: 'Hair', dur: '3 Months' },
                { id: 'SC-04', name: 'Barbering', dept: 'Hair', dur: '2 Months' },
                { id: 'SC-05', name: 'Braiding & Weaving', dept: 'Hair', dur: '2 Months' }
            ];

            for (const c of sampleCourses) {
                await run(
                    'INSERT INTO courses (id, name, department, instructor, duration, capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [c.id, c.name, c.dept, 'TBD', c.dur, 20, 'Active']
                );
            }
            console.log(`✅ Seeded ${sampleCourses.length} sample courses.`);
        } else {
            console.log(`ℹ️ skipping course seed: ${courseCount} courses already exist.`);
        }

        console.log('🎉 Seeding process complete.');

    } catch (error) {
        console.error('❌ Seeding failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
    process.exit(0);
}

seed();
