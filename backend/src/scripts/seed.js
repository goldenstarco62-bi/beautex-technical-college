import 'dotenv/config';
import crypto from 'crypto';
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
            const adminEmail = (process.env.SEED_ADMIN_EMAIL || '').trim();
            if (!adminEmail) {
                throw new Error('SEED_ADMIN_EMAIL is not set — provide the superadmin email before seeding.');
            }
            const usingEnvPassword = !!process.env.SEED_ADMIN_PASSWORD;
            const plainPassword = usingEnvPassword
                ? process.env.SEED_ADMIN_PASSWORD
                : crypto.randomBytes(12).toString('base64url');
            const hashedPassword = await bcrypt.hash(plainPassword, 12);
            await run(
                'INSERT INTO users (email, password, role, status, must_change_password) VALUES (?, ?, ?, ?, ?)',
                [adminEmail, hashedPassword, 'superadmin', 'Active', true]
            );
            console.log(`✅ Base superadmin account created: ${adminEmail} (password change required on first login)`);
            if (!usingEnvPassword) {
                console.log(`🔑 Temporary password (shown once): ${plainPassword}`);
            }
        } else {
            console.log(`ℹ️ skipping user seed: ${userCount} users already exist.`);
        }

        // 2. Seed initial courses
        const sampleCourses = [
            { id: 'SC-01', name: 'Makeup', dept: 'Beauty', dur: '1 Month' },
            { id: 'SC-02', name: 'Nail Technology', dept: 'Beauty', dur: '6 Weeks' },
            { id: 'SC-03', name: 'Hairdressing', dept: 'Hair', dur: '3 Months' },
            { id: 'SC-04', name: 'Barbering', dept: 'Hair', dur: '2 Months' },
            { id: 'SC-05', name: 'Braiding & Weaving', dept: 'Hair', dur: '2 Months' },
            { id: 'SC-06', name: 'Beauty Therapy', dept: 'Beauty', dur: '3 Months' },
            { id: 'SC-07', name: 'Computer Packages', dept: 'ICT', dur: '1 Month' },
            { id: 'SC-08', name: 'Cyber Security', dept: 'ICT', dur: '6 Months' },
            { id: 'SC-09', name: 'Website Development', dept: 'ICT', dur: '4 Months' }
        ];

        console.log('🌱 Synchronizing courses...');
        for (const c of sampleCourses) {
            const exists = await queryOne('SELECT id FROM courses WHERE name = ?', [c.name]);
            if (!exists) {
                await run(
                    'INSERT INTO courses (id, name, department, instructor, duration, capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [c.id, c.name, c.dept, 'TBD', c.dur, 20, 'Active']
                );
                console.log(`   + Added course: ${c.name}`);
            }
        }
        console.log('✅ Course synchronization complete.');

        console.log('🎉 Seeding process complete.');

    } catch (error) {
        console.error('❌ Seeding failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
    process.exit(0);
}

seed();
