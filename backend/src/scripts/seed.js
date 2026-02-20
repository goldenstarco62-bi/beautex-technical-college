import 'dotenv/config';
import { getDb, initializeDatabase, query, queryOne, run } from '../config/database.js';
import bcrypt from 'bcryptjs';

async function seed() {
    try {
        const db = await getDb();

        console.log('🐘 Initializing database schema...');
        await initializeDatabase();

        // 1. Check for existing users first
        let count = 0;
        try {
            const existingUsers = await query('SELECT COUNT(*) as count FROM users');
            count = parseInt(existingUsers[0]?.count || 0);
        } catch (e) {
            console.log('ℹ️ Users table not ready or empty.');
        }

        if (count > 0) {
            console.log(`⚠️ Database already contains ${count} users. Skipping destructive seeding.`);
            console.log('💡 If you want to force a reset, manually drop the tables in your database.');
            process.exit(0);
        }

        console.log('🌱 Seeding essential accounts only...');
        const hashedPassword = await bcrypt.hash('Beautex@2026', 10);

        // ONLY seed the primary superadmin if it doesn't exist
        await run(
            'INSERT INTO users (email, password, role, status, must_change_password) VALUES (?, ?, ?, ?, ?)',
            ['beautexcollege01@gmail.com', hashedPassword, 'superadmin', 'Active', false]
        );

        console.log('✅ Base superadmin account created: beautexcollege01@gmail.com');
        console.log('🎉 System is now ready.');

    } catch (error) {
        console.error('❌ Seeding failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
    process.exit(0);
}

seed();
