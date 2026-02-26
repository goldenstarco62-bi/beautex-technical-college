import { getDb, query, queryOne, run } from '../config/database.js';
import { sendWelcomeEmail } from '../services/emailService.js';
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
        if (await isMongo()) {
            const Faculty = (await import('../models/mongo/Faculty.js')).default;
            let faculty = await Faculty.find().sort({ name: 1 }).lean();
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

        const faculty = await query('SELECT * FROM faculty ORDER BY name');
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

            // Create faculty record
            await run(
                'INSERT INTO faculty (id, name, email, department, position, specialization, courses, contact, id_number, photo, status, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, name, email, department, position, specialization, coursesStr, contact, idNumber, photo, status || 'Active', category || 'Trainer']
            );

            // Create user account for login
            await run(
                `INSERT INTO users (name, email, password, role, status, photo, must_change_password)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [name, email, hashedPassword, 'teacher', 'Active', photo, true]
            );

            savedFaculty = await queryOne('SELECT * FROM faculty WHERE id = ?', [id]);
        }

        // Send email notification
        try {
            console.log(`📡 Attempting to send welcome email to: ${email}`);
            await sendWelcomeEmail(email, 'teacher', temporaryPassword);
        } catch (emailError) {
            console.error('❌ Failed to send welcome email:', emailError);
        }

        // Send SMS notification if contact is provided
        if (contact) {
            try {
                console.log(`📡 Attempting to send SMS to: ${contact}`);
                await sendLoginCredentials(contact, email, temporaryPassword, 'teacher');
            } catch (smsError) {
                console.error('❌ Failed to send SMS:', smsError);
            }
        }

        res.status(201).json(savedFaculty);
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
        if (await isMongo()) {
            const Faculty = (await import('../models/mongo/Faculty.js')).default;
            const updatedFaculty = await Faculty.findOneAndUpdate(
                { id: req.params.id },
                { $set: { ...req.body, updated_at: new Date() } },
                { new: true, runValidators: true }
            );
            if (!updatedFaculty) return res.status(404).json({ error: 'Faculty not found' });
            return res.json(updatedFaculty);
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
                return String(req.body[f] || '').toLowerCase().trim();
            }
            return req.body[f];
        });
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        values.push(req.params.id);

        await run(`UPDATE faculty SET ${setClause} WHERE id = ?`, values);
        const faculty = await queryOne('SELECT * FROM faculty WHERE id = ?', [req.params.id]);
        if (!faculty) return res.status(404).json({ error: 'Faculty not found' });
        res.json(faculty);
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
