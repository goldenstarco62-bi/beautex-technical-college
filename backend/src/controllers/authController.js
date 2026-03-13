import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb, query, queryOne, run } from '../config/database.js';
import { logActivity } from '../services/auditService.js';
import { sendAdminResetPasswordEmail } from '../services/emailService.js';


// Dynamic user lookup that works with both MongoDB and SQLite
async function findUserByEmail(email) {
    await getDb();
    const normalizedEmail = String(email || '').toLowerCase().trim();

    // Check if we're using MongoDB (Mongoose connection)
    if (!!process.env.MONGODB_URI) {
        const User = (await import('../models/mongo/User.js')).default;
        return await User.findOne({ email: normalizedEmail });
    }

    // SQLite / PostgreSQL query
    return await queryOne('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [normalizedEmail]);
}

/**
 * Validates password complexity requirements.
 * Minimum 8 characters, at least one number, and one special character.
 */
function validatePasswordStrength(password) {
    if (!password || password.length < 8) {
        return { valid: false, error: 'Password must be at least 8 characters long.' };
    }
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    if (!hasNumber) {
        return { valid: false, error: 'Password must contain at least one number.' };
    }
    if (!hasSpecial) {
        return { valid: false, error: 'Password must contain at least one special character (!@#$%^&* etc.).' };
    }
    return { valid: true };
}

const SALT_ROUNDS = 12; // Increased from 10 for better security

async function findUserById(id) {
    await getDb();

    if (!!process.env.MONGODB_URI) {
        const User = (await import('../models/mongo/User.js')).default;
        return await User.findById(id).select('-password');
    }

    return await queryOne('SELECT id, email, role, status, name, photo, phone, address, bio, can_edit_finance FROM users WHERE id = ?', [id]);
}

async function createUser(email, hashedPassword, role) {
    await getDb();

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
        const { email, password, role } = req.body;

        if (!email || !password || !role) {
            return res.status(400).json({ error: 'Email, password, and role are required' });
        }

        const existingUser = await findUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ error: 'User already exists' });
        }

        const strength = validatePasswordStrength(password);
        if (!strength.valid) {
            return res.status(400).json({ error: strength.error });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
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

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await findUserByEmail(email);

        // Padding against timing attacks
        if (!user) {
            await bcrypt.compare(password, '$2b$10$abcdefghijklmnopqrstuv');
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // FIX: Check account status BEFORE issuing any token to prevent
        // Inactive users with must_change_password=true from bypassing restrictions.
        if (user.status === 'Inactive') {
            return res.status(403).json({ error: 'Account restricted. Contact superadmin.' });
        }

        // Check System Settings for Portal Access (SQL only)
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

        const userId = user._id || user.id;

        // Fetch student_id if role is student
        let student_id = null;
        if (user.role === 'student') {
            if (!!process.env.MONGODB_URI) {
                const Student = (await import('../models/mongo/Student.js')).default;
                // FIX: Case-insensitive email lookup in case stored email has different casing
                const emailRegex = new RegExp(`^${user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
                const studentProfile = await Student.findOne({ email: { $regex: emailRegex } });
                student_id = studentProfile ? studentProfile.id : null;
            } else {
                const student = await queryOne('SELECT id FROM students WHERE LOWER(email) = LOWER(?)', [user.email]);
                student_id = student ? student.id : null;
            }
        }

        const token = jwt.sign(
            {
                id: userId,
                email: user.email,
                role: user.role,
                status: user.status,
                name: user.name,
                student_id,
                can_edit_finance: !!user.can_edit_finance
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Check if password change is required (AFTER status checks, token is now safe to issue)
        if (user.must_change_password) {
            console.log('⚠️ Password change required. Providing temporary token.');
            return res.json({
                requirePasswordChange: true,
                token,
                user: { id: userId, email: user.email, role: user.role, student_id }
            });
        }

        // FIX: Log activity and update DB BEFORE sending response
        // so errors are caught by the try/catch and don't become unhandled rejections.
        const now = new Date();
        try {
            if (!!process.env.MONGODB_URI) {
                const User = (await import('../models/mongo/User.js')).default;
                await User.findByIdAndUpdate(userId, { last_login: now, last_active: now });
            } else {
                await run('UPDATE users SET last_login = ?, last_seen_at = ? WHERE id = ?', [now.toISOString(), now.toISOString(), userId]);
            }
            await logActivity({
                userEmail: user.email,
                action: 'Login',
                resource: 'Auth',
                details: `User logged in with role: ${user.role}`,
                ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress
            });
        } catch (logErr) {
            // Non-fatal — log but continue
            console.error('⚠️ Login side-effect error (non-fatal):', logErr.message);
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
                can_edit_finance: !!user.can_edit_finance,
                student_id
            }
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

        if (user.role === 'student') {
            if (!!process.env.MONGODB_URI) {
                const Student = (await import('../models/mongo/Student.js')).default;
                // FIX: Case-insensitive email lookup
                const emailRegex = new RegExp(`^${user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
                const studentProfile = await Student.findOne({ email: { $regex: emailRegex } });
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
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!newPassword) {
            return res.status(400).json({ error: 'New password is required' });
        }
        
        const strength = validatePasswordStrength(newPassword);
        if (!strength.valid) {
            return res.status(400).json({ error: strength.error });
        }

        let user;
        if (!!process.env.MONGODB_URI) {
            const User = (await import('../models/mongo/User.js')).default;
            user = await User.findById(userId);
        } else {
            user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Only check current password if NOT a forced change
        if (!user.must_change_password) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'Current password is required' });
            }
            const validPassword = await bcrypt.compare(currentPassword, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Invalid current password' });
            }
        }

        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

        if (!!process.env.MONGODB_URI) {
            user.password = hashedPassword;
            user.must_change_password = false;
            await user.save();
        } else {
            await run('UPDATE users SET password = ?, must_change_password = ? WHERE id = ?', [hashedPassword, false, userId]);
        }

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
}

/**
 * Forgot Password — generates a reset token, saves it hashed in the DB,
 * and emails the user the reset link.
 */
export async function forgotPassword(req, res) {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Always send the same response for security (don't reveal if email exists)
        const genericResponse = { message: 'If an account exists with that email, a password reset link has been dispatched.' };

        const user = await findUserByEmail(email);
        if (!user) {
            console.log(`🛡️ Password reset requested for non-existent user: ${email}`);
            return res.json(genericResponse);
        }

        // Generate a cryptographically secure token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Save hashed token and expiry to the user record
        if (!!process.env.MONGODB_URI) {
            const User = (await import('../models/mongo/User.js')).default;
            await User.findByIdAndUpdate(user._id, {
                reset_token: resetTokenHash,
                reset_token_expiry: resetTokenExpiry
            });
        } else {
            await run(
                'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
                [resetTokenHash, resetTokenExpiry.toISOString(), user.id]
            );
        }

        // Send reset email
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetLink = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

        try {
            await sendAdminResetPasswordEmail(email, `Your password reset link:\n${resetLink}\n\nThis link expires in 1 hour.`);
            console.log(`📧 Password reset email sent to ${email}`);
        } catch (emailErr) {
            console.error('❌ Failed to send reset email:', emailErr.message);
            // Fall through — still return generic response for security
        }

        res.json(genericResponse);
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'An error occurred processing the request' });
    }
}

/**
 * Reset Password — verifies token, updates password, invalidates token.
 */
export async function resetPassword(req, res) {
    try {
        const { token, email, newPassword } = req.body;

        if (!token || !email || !newPassword) {
            return res.status(400).json({ error: 'Token, email, and new password are required' });
        }

        const strength = validatePasswordStrength(newPassword);
        if (!strength.valid) {
            return res.status(400).json({ error: strength.error });
        }

        // Hash the incoming token to compare with stored hash
        const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

        let user;
        if (!!process.env.MONGODB_URI) {
            const User = (await import('../models/mongo/User.js')).default;
            user = await User.findOne({
                email,
                reset_token: resetTokenHash,
                reset_token_expiry: { $gt: new Date() }
            });
        } else {
            user = await queryOne(
                'SELECT * FROM users WHERE email = ? AND reset_token = ? AND reset_token_expiry > ?',
                [email, resetTokenHash, new Date().toISOString()]
            );
        }

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token. Please request a new one.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

        if (!!process.env.MONGODB_URI) {
            user.password = hashedPassword;
            user.reset_token = null;
            user.reset_token_expiry = null;
            user.must_change_password = false;
            await user.save();
        } else {
            await run(
                'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL, must_change_password = ? WHERE id = ?',
                [hashedPassword, false, user.id]
            );
        }

        res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
}
