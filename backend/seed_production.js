import pkg from 'pg';
const { Client } = pkg;
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function seedProductionDatabase() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('🔌 Connecting to production database...');
        await client.connect();
        console.log('✅ Connected to Supabase');

        // Check if users already exist
        const checkResult = await client.query('SELECT COUNT(*) as count FROM users');
        const userCount = parseInt(checkResult.rows[0].count);

        if (userCount > 0) {
            console.log(`ℹ️  Database already has ${userCount} user(s)`);
            console.log('   Skipping seed to avoid duplicates.');
            return;
        }

        console.log('🌱 Seeding production database with admin account...');

        // Hash the password
        const hashedPassword = await bcrypt.hash('Beautex@2026', 10);

        // Insert the super admin user
        await client.query(
            `INSERT INTO users (email, password, role, status, must_change_password, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            ['beautexcollege01@gmail.com', hashedPassword, 'superadmin', 'Active', false]
        );

        console.log('✅ Super admin account created successfully!');
        console.log('');
        console.log('📧 Email: beautexcollege01@gmail.com');
        console.log('🔑 Password: Beautex@2026');
        console.log('');
        console.log('🎉 You can now sign in to your production site!');

    } catch (error) {
        console.error('❌ Error seeding database:', error.message);
        console.error('');
        console.error('Make sure:');
        console.error('1. DATABASE_URL is set in your .env file');
        console.error('2. The Supabase database is accessible');
        console.error('3. The users table exists');
    } finally {
        await client.end();
    }
}

seedProductionDatabase();
