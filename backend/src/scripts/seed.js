import { getDb, initializeDatabase, query, queryOne, run } from '../config/database.js';
import bcrypt from 'bcryptjs';

async function seed() {
    try {
        const db = await getDb();

        // 1. Check for existing users first
        const existingUsers = await query('SELECT COUNT(*) as count FROM users');
        const count = parseInt(existingUsers[0]?.count || 0);

        if (count > 0) {
            console.log(`⚠️ Database already contains ${count} users. Skipping destructive seeding.`);
            console.log('💡 If you want to force a reset, manually drop the tables in your database.');
            process.exit(0);
        }

        console.log('🐘 Initializing database schema...');
        await initializeDatabase();

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
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
    process.exit(0);
}

seed();
