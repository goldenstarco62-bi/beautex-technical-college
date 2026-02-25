import { getDb, query, queryOne, run } from '../config/database.js';

const ALLOWED_PROFILE_FIELDS = ['name', 'phone', 'address', 'photo', 'bio'];

export async function getProfile(req, res) {
    try {
        const { email, role } = req.user;
        const db = await getDb();
        const isMongo = !!process.env.MONGODB_URI;

        let profileData = {};

        const userEmail = String(email || '').toLowerCase().trim();

        if (isMongo) {
            if (role === 'student') {
                const Student = (await import('../models/mongo/Student.js')).default;
                profileData = await Student.findOne({ email: userEmail });
            } else if (role === 'teacher') {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                profileData = await Faculty.findOne({ email: userEmail });
            } else {
                const User = (await import('../models/mongo/User.js')).default;
                profileData = await User.findOne({ email: userEmail }).select('-password');
            }
        } else {
            if (role === 'student') {
                profileData = await queryOne('SELECT * FROM students WHERE LOWER(email) = LOWER(?)', [userEmail]);
            } else if (role === 'teacher') {
                profileData = await queryOne('SELECT * FROM faculty WHERE LOWER(email) = LOWER(?)', [userEmail]);
            } else {
                profileData = await queryOne('SELECT id, email, role, status, name, photo, phone, address, bio FROM users WHERE LOWER(email) = LOWER(?)', [userEmail]);
            }

            // Fallback to user table
            if (!profileData) {
                profileData = await queryOne('SELECT id, email, role, status, name, photo, phone, address, bio FROM users WHERE LOWER(email) = LOWER(?)', [userEmail]);
            }
        }

        res.json(profileData || {});
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
}

export async function updateProfile(req, res) {
    try {
        const { email, role } = req.user;
        const isMongo = !!process.env.MONGODB_URI;

        // Whitelist safe fields only
        const updates = {};
        for (const key of ALLOWED_PROFILE_FIELDS) {
            if (req.body[key] !== undefined) {
                updates[key] = req.body[key];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        // Schema Mapping: Often 'phone' in user/frontend is 'contact' in student/faculty tables
        if (updates.phone && !updates.contact) {
            updates.contact = updates.phone;
        } else if (updates.contact && !updates.phone) {
            updates.phone = updates.contact;
        }

        const userEmail = String(email || '').toLowerCase().trim();

        if (isMongo) {
            const query = { email: userEmail };
            const options = { new: true };

            if (role === 'student') {
                const Student = (await import('../models/mongo/Student.js')).default;
                await Student.findOneAndUpdate(query, { $set: updates }, options);
            } else if (role === 'teacher') {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                await Faculty.findOneAndUpdate(query, { $set: updates }, options);
            }

            // Always sync name/photo/phone/address/bio to User model
            const User = (await import('../models/mongo/User.js')).default;
            await User.findOneAndUpdate(query, { $set: updates }, options);
        } else {
            const fields = Object.keys(updates);
            const setClause = fields.map(f => `${f} = ?`).join(', ');
            const values = [...fields.map(f => updates[f]), userEmail];

            if (role === 'student') {
                // Check if contact column exists in addition to phone
                await run(`UPDATE students SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = LOWER(?)`, values).catch(() => { });
            } else if (role === 'teacher') {
                await run(`UPDATE faculty SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE LOWER(email) = LOWER(?)`, values).catch(() => { });
            }

            // Sync all updatable fields to users table
            await run(`UPDATE users SET ${setClause} WHERE LOWER(email) = LOWER(?)`, values);
        }

        res.json({ message: 'Profile updated successfully', updates });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
}
