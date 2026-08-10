import { getDb, query, queryOne, run } from '../config/database.js';
import { sendWelcomeEmail, sendAdminResetPasswordEmail } from '../services/emailService.js';
import { sendLoginCredentials } from '../services/smsService.js';
import bcrypt from 'bcryptjs';

import crypto from 'crypto';

// Generate random password
function generatePassword(length = 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return password;
}
const isMongo = async () => !!process.env.MONGODB_URI;

export async function getAllFaculty(req, res) {
    try {
        const { role } = req.user;
        const limit = req.query.limit ? parseInt(req.query.limit) : null;
        if (await isMongo()) {
            const Faculty = (await import('../models/mongo/Faculty.js')).default;
            let q = Faculty.find().sort({ name: 1 });
            if (limit) q = q.limit(limit);
            let faculty = await q.lean();
            if (role === 'student') {
                faculty = faculty.map(f => ({
                    id: f.id,
                    name: f.name,
                    department: f.department,
                    photo: f.photo,
                    bio: f.bio,
                    category: f.category
                }));
            }
            return res.json(faculty);
        }

        let sql = 'SELECT * FROM faculty ORDER BY name';
        const params = [];
        if (limit) {
            sql += ' LIMIT ?';
            params.push(limit);
        }
        const faculty = await query(sql, params);
        if (role === 'student') {
            return res.json(faculty.map(f => ({
                id: f.id,
                name: f.name,
                department: f.department,
                photo: f.photo,
                bio: f.bio,
                category: f.category
            })));
        }
        res.json(faculty);
    } catch (error) {
        console.error('Get faculty error:', error);
        res.status(500).json({ error: 'Failed to fetch faculty' });
    }
}

export async function getFaculty(req, res) {
    try {
        if (await isMongo()) {
            const Faculty = (await import('../models/mongo/Faculty.js')).default;
            const faculty = await Faculty.findOne({ id: req.params.id });
            if (!faculty) return res.status(404).json({ error: 'Faculty not found' });
            return res.json(faculty);
        }

        const faculty = await queryOne('SELECT * FROM faculty WHERE id = ?', [req.params.id]);
        if (!faculty) return res.status(404).json({ error: 'Faculty not found' });
        res.json(faculty);
    } catch (error) {
        console.error('Get faculty error:', error);
        res.status(500).json({ error: 'Failed to fetch faculty' });
    }
}

export async function createFaculty(req, res) {
    try {
        const { id, name, department, position, specialization, courses, contact, passport, id_number, photo, status, category } = req.body;
        const email = String(req.body.email || '').toLowerCase().trim();
        const idNumber = id_number || passport; // Support both field names

        if (!id || !name || !email || !department) {
            return res.status(400).json({ error: 'ID, name, email, and department are required' });
        }

        // Generate temporary password for the faculty
        const temporaryPassword = generatePassword();
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

        let savedFaculty;
        if (await isMongo()) {
            const Faculty = (await import('../models/mongo/Faculty.js')).default;
            const User = (await import('../models/mongo/User.js')).default;

            const newFaculty = new Faculty({
                id, name, email, department, position, specialization, courses, contact, photo, id_number: idNumber, status: status || 'Active', category: category || 'Trainer'
            });
            savedFaculty = await newFaculty.save();

            // Create user account
            const newUser = new User({
                name,
                email,
                password: hashedPassword,
                role: 'teacher',
                status: 'Active',
                photo,
                must_change_password: true
            });
            await newUser.save();
        } else {
            const coursesStr = typeof courses === 'string' ? courses : JSON.stringify(courses || []);

            // Run both inserts in parallel — faculty and users tables are independent
            await Promise.all([
                run(
                    'INSERT INTO faculty (id, name, email, department, position, specialization, courses, contact, id_number, photo, status, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [id, name, email, department, position, specialization, coursesStr, contact, idNumber, photo, status || 'Active', category || 'Trainer']
                ),
                run(
                    `INSERT INTO users (name, email, password, role, status, photo, must_change_password)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [name, email, hashedPassword, 'teacher', 'Active', photo, true]
                )
            ]);

            // Build response from known data — avoids an extra SELECT round-trip
            savedFaculty = {
                id, name, email, department, position, specialization,
                courses: courses || [], contact, id_number: idNumber, photo,
                status: status || 'Active', category: category || 'Trainer',
                created_at: new Date().toISOString()
            };
        }

        // Respond immediately — notifications are fire-and-forget (non-blocking)
        res.status(201).json(savedFaculty);

        // Send email notification asynchronously (does not block the response)
        sendWelcomeEmail(email, 'teacher', temporaryPassword)
            .then(() => console.log(`[faculty] Welcome email dispatched to: ${email}`))
            .catch(err => console.error('[faculty] Failed to send welcome email:', err.message));

        // Send SMS notification asynchronously if contact is provided
        if (contact) {
            sendLoginCredentials(contact, email, temporaryPassword, 'teacher')
                .then(() => console.log(`[faculty] SMS dispatched to: ${contact}`))
                .catch(err => console.error('[faculty] Failed to send SMS:', err.message));
        }
    } catch (error) {
        console.error('Create faculty error:', error);
        if (error.code === 'SQLITE_CONSTRAINT' || error.code === 23505 || error.code === 11000) {
            return res.status(400).json({ error: 'A faculty member with this ID or email already exists.' });
        }
        res.status(500).json({ error: `Server Error: ${error.message}` });
    }
}

export async function updateFaculty(req, res) {
    try {
        const facultyId = req.params.id;
        const newEmail = req.body.email ? String(req.body.email).toLowerCase().trim() : null;

        if (await isMongo()) {
            const Faculty = (await import('../models/mongo/Faculty.js')).default;
            const User = (await import('../models/mongo/User.js')).default;

            const oldFaculty = await Faculty.findOne({ id: facultyId });
            if (!oldFaculty) return res.status(404).json({ error: 'Faculty not found' });

            const oldEmail = oldFaculty.email ? String(oldFaculty.email).toLowerCase().trim() : null;
            const isEmailChanged = Boolean(newEmail && oldEmail && newEmail !== oldEmail);

            if (isEmailChanged) {
                const existingUser = await User.findOne({ email: newEmail });
                if (existingUser && existingUser.email !== oldEmail) {
                    return res.status(400).json({ error: 'The email address is already in use by another account.' });
                }
            }

            const updatePayload = { ...req.body, updated_at: new Date() };
            if (newEmail) updatePayload.email = newEmail;

            const updatedFaculty = await Faculty.findOneAndUpdate(
                { id: facultyId },
                { $set: updatePayload },
                { new: true, runValidators: true }
            );

            let passwordResetSent = false;
            if (isEmailChanged) {
                const tempPassword = generatePassword();
                const hashedPassword = await bcrypt.hash(tempPassword, 10);

                const user = await User.findOne({ email: oldEmail });
                if (user) {
                    user.email = newEmail;
                    user.password = hashedPassword;
                    user.must_change_password = true;
                    if (req.body.name) user.name = req.body.name;
                    await user.save();
                } else {
                    const newUser = new User({
                        name: updatedFaculty.name || req.body.name,
                        email: newEmail,
                        password: hashedPassword,
                        role: 'teacher',
                        status: 'Active',
                        must_change_password: true
                    });
                    await newUser.save();
                }

                sendAdminResetPasswordEmail(newEmail, tempPassword)
                    .then(() => console.log(`[faculty] Password reset email sent to new address: ${newEmail}`))
                    .catch(err => console.error('[faculty] Failed to send reset email to new address:', err.message));
                passwordResetSent = true;
            }

            return res.json({
                ...updatedFaculty.toObject(),
                password_reset_sent: passwordResetSent,
                message: isEmailChanged ? 'Faculty updated and password reset email sent to new address.' : 'Faculty updated successfully.'
            });
        }

        // SQL Mode (SQLite / PostgreSQL)
        const oldFaculty = await queryOne('SELECT * FROM faculty WHERE id = ?', [facultyId]);
        if (!oldFaculty) return res.status(404).json({ error: 'Faculty not found' });

        const oldEmail = oldFaculty.email ? String(oldFaculty.email).toLowerCase().trim() : null;
        const isEmailChanged = Boolean(newEmail && oldEmail && newEmail !== oldEmail);

        if (isEmailChanged) {
            const existingUser = await queryOne('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [newEmail]);
            if (existingUser) {
                return res.status(400).json({ error: 'The email address is already in use by another account.' });
            }
        }

        const allowedFields = [
            'name', 'email', 'department', 'position', 'specialization', 'courses', 'contact', 'photo', 'passport', 'status'
        ];
        const fields = Object.keys(req.body).filter(k => allowedFields.includes(k));
        if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

        const values = fields.map(f => {
            if (f === 'courses' && typeof req.body[f] !== 'string') {
                return JSON.stringify(req.body[f]);
            }
            if (f === 'email') {
                return newEmail;
            }
            return req.body[f];
        });
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        values.push(facultyId);

        const result = await run(`UPDATE faculty SET ${setClause} WHERE id = ?`, values);
        if (result.changes === 0) return res.status(404).json({ error: 'Faculty not found' });

        let passwordResetSent = false;
        if (isEmailChanged) {
            const tempPassword = generatePassword();
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            const user = await queryOne('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [oldEmail]);
            if (user) {
                await run('UPDATE users SET email = ?, password = ?, must_change_password = ? WHERE id = ?', [newEmail, hashedPassword, 1, user.id]);
            } else {
                await run('INSERT INTO users (name, email, password, role, status, must_change_password) VALUES (?, ?, ?, ?, ?, ?)', [req.body.name || oldFaculty.name, newEmail, hashedPassword, 'teacher', 'Active', 1]);
            }

            sendAdminResetPasswordEmail(newEmail, tempPassword)
                .then(() => console.log(`[faculty] Password reset email sent to new address: ${newEmail}`))
                .catch(err => console.error('[faculty] Failed to send reset email to new address:', err.message));
            passwordResetSent = true;
        }

        const updatedFields = {};
        fields.forEach(f => { updatedFields[f] = f === 'email' ? newEmail : req.body[f]; });

        res.json({
            id: facultyId,
            ...updatedFields,
            password_reset_sent: passwordResetSent,
            message: isEmailChanged ? 'Faculty updated and password reset email sent to new address.' : 'Faculty updated successfully.'
        });
    } catch (error) {
        console.error('Update faculty error:', error);
        res.status(500).json({ error: 'Failed to update faculty' });
    }
}

export async function deleteFaculty(req, res) {
    try {
        const facultyId = req.params.id;

        if (await isMongo()) {
            const Faculty = (await import('../models/mongo/Faculty.js')).default;
            const User = (await import('../models/mongo/User.js')).default;

            const faculty = await Faculty.findOne({ id: facultyId });
            if (!faculty) return res.status(404).json({ error: 'Faculty not found' });

            // Delete user account
            await User.findOneAndDelete({ email: faculty.email });
            // Delete faculty profile
            await Faculty.findOneAndDelete({ id: facultyId });

            return res.json({ message: 'Faculty and associated user account deleted successfully' });
        }

        const faculty = await queryOne('SELECT email FROM faculty WHERE id = ?', [facultyId]);
        if (!faculty) return res.status(404).json({ error: 'Faculty not found' });

        // Delete user account
        await run('DELETE FROM users WHERE email = ?', [faculty.email]);
        // Delete faculty profile
        const result = await run('DELETE FROM faculty WHERE id = ?', [facultyId]);

        if (result.changes === 0) return res.status(404).json({ error: 'Faculty not found' });
        res.json({ message: 'Faculty and associated user account deleted successfully' });
    } catch (error) {
        console.error('Delete faculty error:', error);
        res.status(500).json({ error: 'Failed to delete faculty' });
    }
}
