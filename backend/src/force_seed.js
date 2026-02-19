import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { getDb, run, query } from './config/database.js';

async function seed() {
    try {
        console.log('🚀 Starting Safe Force Seed...');
        const db = await getDb();

        // ONLY seed the primary superadmin requested by the user
        const adminEmail = 'beautexcollege01@gmail.com';
        const hashedPassword = await bcrypt.hash('Beautex@2026', 10);

        await run(`
            INSERT INTO users (email, password, role, status, must_change_password) 
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (email) DO UPDATE SET 
                password = EXCLUDED.password,
                role = EXCLUDED.role,
                status = EXCLUDED.status,
                must_change_password = EXCLUDED.must_change_password
        `, [adminEmail, hashedPassword, 'superadmin', 'Active', false]);

        console.log(`✅ Verified admin user: ${adminEmail}`);
        console.log('✨ Safe seeding complete!');
    } catch (err) {
        console.error('❌ Seeding failed:', err);
    }
    process.exit(0);
}

seed();
