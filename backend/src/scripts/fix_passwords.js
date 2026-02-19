import { getDb } from '../config/database.js';
import bcrypt from 'bcryptjs';

async function fixPasswords() {
    console.log('🔒 Fixing passwords...');
    const db = await getDb();

    // Hash passwords
    const adminPass = await bcrypt.hash('admin123', 10);
    const userPass = await bcrypt.hash('password123', 10);

    // 1. Fix Admin
    console.log('   Resetting Admin password to: admin123');
    await db.run('UPDATE users SET password = ? WHERE email = ?', [adminPass, 'admin@beautex.edu']);

    // 2. Fix Superadmin
    console.log('   Resetting Superadmin password to: admin123');
    await db.run('UPDATE users SET password = ? WHERE email = ?', [adminPass, 'superadmin@beautex.edu']);

    // 3. Fix Students & Faculty
    console.log('   Resetting Student/Faculty passwords to: password123');
    await db.run('UPDATE users SET password = ? WHERE role IN (?, ?)', [userPass, 'student', 'teacher']);

    console.log('✅ Passwords updated successfully!');
}

fixPasswords()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
