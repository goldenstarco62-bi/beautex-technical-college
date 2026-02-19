import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { run, query } from './config/database.js';

async function addCustomAdmin() {
    try {
        // Check if custom admin already exists
        const existing = await query("SELECT * FROM users WHERE email = 'beautexcollege01@gmail.com'");

        if (existing.length > 0) {
            console.log('✅ Custom admin already exists:', existing[0]);
            process.exit(0);
        }

        // Add custom admin
        const hashedPassword = await bcrypt.hash('Beautex@2026', 10);
        await run(
            'INSERT INTO users (email, password, role, status, must_change_password) VALUES (?, ?, ?, ?, ?)',
            ['beautexcollege01@gmail.com', hashedPassword, 'superadmin', 'Active', false]
        );

        console.log('✅ Custom admin created: beautexcollege01@gmail.com');

        // Verify
        const newUser = await query("SELECT id, email, role FROM users WHERE email = 'beautexcollege01@gmail.com'");
        console.table(newUser);

    } catch (err) {
        console.error('❌ Error:', err);
    }
    process.exit(0);
}

addCustomAdmin();
