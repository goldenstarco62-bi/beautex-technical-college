import pg from 'pg';
import bcrypt from 'bcryptjs';
import { sendWelcomeEmail } from '../services/emailService.js';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Generate random password
function generatePassword(length = 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

async function fixTempPasswords() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // Find all users who still need to change their password (never successfully logged in)
        const result = await pool.query(
            "SELECT id, email, name, role FROM users WHERE must_change_password = TRUE"
        );

        console.log(`\n🔍 Found ${result.rows.length} users who still need to change their password:\n`);

        if (result.rows.length === 0) {
            console.log('✅ No users need password fixes.');
            process.exit(0);
        }

        for (const user of result.rows) {
            console.log(`  📧 ${user.email} (${user.role}) - Name: ${user.name || 'N/A'}`);
        }

        console.log('\n🔄 Generating new temporary passwords and updating database...\n');

        for (const user of result.rows) {
            const tempPassword = generatePassword();
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            // Update the password in the database
            await pool.query(
                'UPDATE users SET password = $1 WHERE id = $2',
                [hashedPassword, user.id]
            );

            console.log(`  ✅ ${user.email} → New temp password: ${tempPassword}`);

            // Try to send email
            try {
                await sendWelcomeEmail(user.email, user.role, tempPassword);
                console.log(`     📧 Welcome email re-sent to ${user.email}`);
            } catch (emailErr) {
                console.log(`     ⚠️ Could not send email to ${user.email}: ${emailErr.message}`);
            }
        }

        console.log('\n🎉 All temporary passwords have been regenerated and saved.');
        console.log('   Users can now log in with their new temporary passwords.');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

fixTempPasswords();
