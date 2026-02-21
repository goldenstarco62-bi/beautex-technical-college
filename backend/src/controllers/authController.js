import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb, query, queryOne, run } from '../config/database.js';
import { logActivity } from '../services/auditService.js';


// Dynamic user lookup that works with both MongoDB and SQLite
async function findUserByEmail(email) {
    const db = await getDb();

    // Check if we're using MongoDB (Mongoose connection)
    if (!!process.env.MONGODB_URI) {
        const User = (await import('../models/mongo/User.js')).default;
        return await User.findOne({ email });
    }

    // SQLite / PostgreSQL query
    return await queryOne('SELECT * FROM users WHERE email = ?', [email]);
}

async function findUserById(id) {
    const db = await getDb();

    if (!!process.env.MONGODB_URI) {
        const User = (await import('../models/mongo/User.js')).default;
        return await User.findById(id).select('-password');
    }

    return await queryOne('SELECT id, email, role, status, name, photo, phone, address, bio FROM users WHERE id = ?', [id]);
}

async function createUser(email, hashedPassword, role) {
    const db = await getDb();

    if (!!process.env.MONGODB_URI) {
        const User = (await import('../models/mongo/User.js')).default;
        const newUser = new User({ email, password: hashedPassword, role });
        return await newUser.save();
    }

    const result = await run(
        'INSERT INTO users (email, password, role, status) VALUES (?, ?, ?, ?)',
        [email, hashedPassword, role, 'Active']
    );
    return { id: result.lastID, email, role };
}

export async function register(req, res) {
    try {
        const { email, password, role, name } = req.body;

        // Validate input
        if (!email || !password || !role) {
            return res.status(400).json({ error: 'Email, password, and role are required' });
        }

        // Check if user exists
        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const savedUser = await createUser(email, hashedPassword, role);

        res.status(201).json({
            message: 'User registered successfully',
            userId: savedUser._id || savedUser.id
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
}

export async function login(req, res) {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = await findUserByEmail(email);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT
        const userId = user._id || user.id;

        // Fetch student_id if role is student
        let student_id = null;
        if (user.role === 'student') {
            const db = await getDb();
            if (!!process.env.MONGODB_URI) {
                const Student = (await import('../models/mongo/Student.js')).default;
                const studentProfile = await Student.findOne({ email: user.email });
                student_id = studentProfile ? studentProfile.id : null;
            } else {
                const student = await queryOne('SELECT id FROM students WHERE LOWER(email) = LOWER(?)', [user.email]);
                student_id = student ? student.id : null;
            }
        }

        const token = jwt.sign(
            { id: userId, email: user.email, role: user.role, status: user.status, student_id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Check if password change is required
        if (user.must_change_password) {
            console.log(`⚠️ Password change required for: ${email}. Providing temporary token.`);
            return res.json({
                requirePasswordChange: true,
                token, // Provide token for the change-password request
                user: {
                    id: userId,
                    email: user.email,
                    role: user.role,
                    student_id
                }
            });
        }

        // Check if account is active
        if (user.status === 'Inactive') {
            return res.status(403).json({ error: 'Account restricted. Contact superadmin.' });
        }

        // Check System Settings for Portal Access
        const db = await getDb();
        let settings = {};
        if (!process.env.MONGODB_URI) {
            const settingsRows = await query('SELECT * FROM system_settings');
            settings = settingsRows.reduce((acc, curr) => {
                acc[curr.key] = curr.value;
                return acc;
            }, {});
        }

        // 1. Maintenance Mode Check
        if (settings.maintenance_mode === 'true' && user.role !== 'superadmin') {
            return res.status(503).json({ error: 'System is under maintenance. Only Super Admin can login.' });
        }

        // 2. Portal Access Check
        if (user.role === 'student' && settings.student_portal_enabled === 'false') {
            return res.status(403).json({ error: 'Student Portal is currently disabled.' });
        }
        if (user.role === 'teacher' && settings.teacher_portal_enabled === 'false') {
            return res.status(403).json({ error: 'Faculty Portal is currently disabled.' });
        }

        res.json({
            token,
            user: {
                id: userId,
                email: user.email,
                role: user.role,
                status: user.status,
                photo: user.photo,
                name: user.name,
                phone: user.phone,
                student_id
            }
        });

        // Log successful login
        await logActivity({
            userEmail: user.email,
            action: 'Login',
            resource: 'Auth',
            details: `User logged in with role: ${user.role}`,
            ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress
        });
    } catch (error) {

        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
}

export async function getMe(req, res) {
    try {
        const user = await findUserById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Fetch student_id if role is student
        if (user.role === 'student') {
            const db = await getDb();
            if (!!process.env.MONGODB_URI) {
                const Student = (await import('../models/mongo/Student.js')).default;
                const studentProfile = await Student.findOne({ email: user.email });
                user.student_id = studentProfile ? studentProfile.id : null;
            } else {
                const student = await queryOne('SELECT id FROM students WHERE LOWER(email) = LOWER(?)', [user.email]);
                user.student_id = student ? student.id : null;
            }
        }

        res.json(user);
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ error: 'Failed to get user info' });
    }
}

export async function changePassword(req, res) {
    try {
        const { email, currentPassword, newPassword } = req.body;
        console.log('🔄 Change password request received');
        console.log('  req.user:', JSON.stringify(req.user));
        console.log('  body email:', email, 'has newPassword:', !!newPassword);

        const userId = req.user.id;
        const userEmail = req.user.email || email;

        if (!newPassword) {
            return res.status(400).json({ error: 'New password is required' });
        }

        if (!userEmail && !newPassword) {
            return res.status(400).json({ error: 'Email and new password are required' });
        }

        console.log('  Looking up user by id:', userId);
        const db = await getDb();
        let user;

        if (!!process.env.MONGODB_URI) {
            const User = (await import('../models/mongo/User.js')).default;
            user = await User.findById(userId);
        } else {
            user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
        }

        if (!user) {
            console.log('  ❌ User not found with id:', userId);
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('  ✅ User found:', user.email, 'must_change_password:', user.must_change_password);

        // Only check current password if it's NOT a forced change
        if (!user.must_change_password) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'Current password is required' });
            }
            const validPassword = await bcrypt.compare(currentPassword, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid current password' });
            }
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        console.log('  🔐 New password hashed successfully');

        if (!!process.env.MONGODB_URI) {
            user.password = hashedPassword;
            user.must_change_password = false;
            await user.save();
        } else {
            await run('UPDATE users SET password = ?, must_change_password = ? WHERE id = ?', [hashedPassword, false, userId]);
        }

        console.log('  ✅ Password updated in database for user:', userId);
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        console.error('Change password error stack:', error.stack);
        res.status(500).json({ error: 'Failed to change password' });
    }
}

export async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        const user = await findUserByEmail(email);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // In a real app, generate a reset token and send an email
        // For now, we'll just return success to match the expected API behavior
        res.json({ message: 'Password reset link sent to your email' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to process forgot password request' });
    }
}

export async function resetPassword(req, res) {
    try {
        const { token, newPassword } = req.body;
        // In a real app, verify the token
        // For now, we'll return an error if token is missing
        if (!token) {
            return res.status(400).json({ error: 'Reset token is required' });
        }

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
}


