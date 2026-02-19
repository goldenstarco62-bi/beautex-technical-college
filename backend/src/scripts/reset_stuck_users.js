import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function resetPasswords() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const knownPassword = 'TempPass123!';
        const hashed = await bcrypt.hash(knownPassword, 10);

        // Update ALL users with must_change_password = TRUE to a known password
        const updateResult = await pool.query(
            'UPDATE users SET password = $1 WHERE must_change_password = TRUE',
            [hashed]
        );

        console.log('Updated ' + updateResult.rowCount + ' users to password: ' + knownPassword);

        // List the affected users
        const result = await pool.query(
            'SELECT id, email, name, role, must_change_password FROM users ORDER BY id'
        );

        console.log('\nAll users in database:');
        for (const u of result.rows) {
            console.log('  id=' + u.id + ' email=' + u.email + ' role=' + u.role + ' must_change=' + u.must_change_password + ' name=' + u.name);
        }

        // Verify the password works
        const testUser = await pool.query('SELECT password FROM users WHERE must_change_password = TRUE LIMIT 1');
        if (testUser.rows.length > 0) {
            const isMatch = await bcrypt.compare(knownPassword, testUser.rows[0].password);
            console.log('\nPassword verification test: ' + (isMatch ? 'PASS' : 'FAIL'));
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

resetPasswords();
