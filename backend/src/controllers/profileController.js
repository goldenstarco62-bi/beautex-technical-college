import { getDb, query, queryOne, run } from '../config/database.js';

export async function getProfile(req, res) {
    try {
        const { email, role } = req.user;

        let profileData = {};

        if (role === 'student') {
            profileData = await queryOne('SELECT * FROM students WHERE email = ?', [email]);
        } else if (role === 'teacher') {
            profileData = await queryOne('SELECT * FROM faculty WHERE email = ?', [email]);
        } else {
            profileData = await queryOne('SELECT id, email, role, status, photo FROM users WHERE email = ?', [email]);
        }

        if (!profileData) {
            // Fallback to user table if not found in specific tables
            profileData = await queryOne('SELECT id, email, role, status, photo FROM users WHERE email = ?', [email]);
        }

        res.json(profileData);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
}

export async function updateProfile(req, res) {
    try {
        const { email, role } = req.user;
        const updates = req.body;

        // Remove sensitive or non-updatable fields
        delete updates.id;
        delete updates.email;
        delete updates.role;
        delete updates.created_at;

        const fields = Object.keys(updates);
        if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => updates[f]);
        values.push(email);

        if (role === 'student') {
            await run(`UPDATE students SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE email = ?`, values);
        } else if (role === 'teacher') {
            await run(`UPDATE faculty SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE email = ?`, values);
        }

        // Always update the core users table too if the field exists there (e.g., photo)
        if (fields.includes('photo')) {
            await run('UPDATE users SET photo = ? WHERE email = ?', [updates.photo, email]);
        }

        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
}
