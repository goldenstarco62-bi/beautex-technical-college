import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb, query, queryOne, run } from '../config/database.js';
import { sendAdminResetPasswordEmail } from '../services/emailService.js';

const isMongo = async () => !!process.env.MONGODB_URI;

/**
 * Compute presence based on last_seen_at timestamp.
 * Online  = seen within the last 5 minutes
 * Away    = seen within the last 30 minutes
 * Offline = seen before but not in the last 30 minutes
 * Never   = has never accessed the portal
 */
function computeOnlineStatus(lastSeenAt) {
    if (!lastSeenAt) return 'Never';
    const diffMs = Date.now() - new Date(lastSeenAt).getTime();
    const diffMin = diffMs / 60000;
    if (diffMin < 5) return 'Online';
    if (diffMin < 30) return 'Away';
    return 'Offline';
}

export async function getAllUsers(req, res) {
    try {
        if (await isMongo()) {
            const User = (await import('../models/mongo/User.js')).default;
            const users = await User.find().select('-password').sort({ email: 1 });
            const enriched = users.map(u => ({
                ...u.toObject(),
                online_status: computeOnlineStatus(u.last_seen_at),
            }));
            return res.json(enriched);
        }

        const users = await query(
            'SELECT id, email, role, status, name, photo, created_at, last_seen_at, can_edit_finance, can_edit_students FROM users ORDER BY email'
        );

        const enriched = users.map(u => ({
            ...u,
            online_status: computeOnlineStatus(u.last_seen_at),
        }));

        res.json(enriched);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
}

export async function updateUserRole(req, res) {
    try {
        const { role } = req.body;

        if (await isMongo()) {
            const User = (await import('../models/mongo/User.js')).default;
            const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
            if (!user) return res.status(404).json({ error: 'User not found' });
            return res.json(user);
        }

        await run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
        const user = await queryOne('SELECT id, email, role, status FROM users WHERE id = ?', [req.params.id]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        console.error('Update user role error:', error);
        res.status(500).json({ error: 'Failed to update user role' });
    }
}

export async function updateUserStatus(req, res) {
    try {
        const { status } = req.body;
        if (!status) return res.status(400).json({ error: 'Status is required' });

        if (await isMongo()) {
            const User = (await import('../models/mongo/User.js')).default;
            const user = await User.findById(req.params.id);
            if (!user) return res.status(404).json({ error: 'User not found' });
            user.status = status;
            await user.save();
            return res.json({ id: user._id, email: user.email, role: user.role, status: user.status });
        }

        const user = await queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Security check: if not superadmin, can only update students (and must have can_edit_students)
        if (req.user.role !== 'superadmin' && user.role !== 'student') {
            return res.status(403).json({ error: 'Access denied. You can only update status for student accounts.' });
        }

        await run('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ id: user.id, email: user.email, role: user.role, status });
    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
}

export async function resetUserPassword(req, res) {
    try {
        const userId = req.params.id;
        const tempPassword = crypto.randomBytes(4).toString('hex'); // 8 hex chars
        const hashedPassword = await bcrypt.hash(tempPassword, 12);

        if (await isMongo()) {
            const User = (await import('../models/mongo/User.js')).default;
            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ error: 'User not found' });

            // Security check: if not superadmin, can only reset students
            if (req.user.role !== 'superadmin' && user.role !== 'student') {
                return res.status(403).json({ error: 'Access denied. You can only reset passwords for student accounts.' });
            }

            user.password = hashedPassword;
            user.must_change_password = true;
            await user.save();

            await sendAdminResetPasswordEmail(user.email, tempPassword);
            return res.json({ message: 'Password reset — temporary credentials emailed' });
        }

        const user = await queryOne('SELECT id, email, role FROM users WHERE id = ?', [userId]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Security check: if not superadmin, can only reset students
        if (req.user.role !== 'superadmin' && user.role !== 'student') {
            return res.status(403).json({ error: 'Access denied. You can only reset passwords for student accounts.' });
        }

        await run('UPDATE users SET password = ?, must_change_password = ? WHERE id = ?', [hashedPassword, true, userId]);

        const emailSent = await sendAdminResetPasswordEmail(user.email, tempPassword);
        if (!emailSent) {
            console.warn('⚠️ Email delivery failed for password reset.');
        }

        res.json({ message: 'Password reset — temporary credentials emailed' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
}

export async function deleteUser(req, res) {
    try {
        if (await isMongo()) {
            const User = (await import('../models/mongo/User.js')).default;
            const result = await User.findByIdAndDelete(req.params.id);
            if (!result) return res.status(404).json({ error: 'User not found' });
            return res.json({ message: 'User deleted successfully' });
        }

        const result = await run('DELETE FROM users WHERE id = ?', [req.params.id]);
        if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
}

export async function getAuditLogs(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        if (await isMongo()) {
            const AuditLog = (await import('../models/mongo/AuditLog.js')).default;
            const total = await AuditLog.countDocuments();
            const logs = await AuditLog.find().sort({ created_at: -1 }).skip(offset).limit(limit);
            return res.json({
                logs,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit)
                }
            });
        }

        const totalRes = await queryOne('SELECT COUNT(*) as count FROM audit_logs');
        const total = totalRes ? totalRes.count : 0;
        const logs = await query(`
            SELECT * FROM audit_logs 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        res.json({
            logs,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
}

export async function resetPasswordByEmail(req, res) {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const tempPassword = crypto.randomBytes(4).toString('hex'); // 8 hex chars
        const hashedPassword = await bcrypt.hash(tempPassword, 12);

        if (await isMongo()) {
            const User = (await import('../models/mongo/User.js')).default;
            const user = await User.findOne({ email: email.toLowerCase() });
            if (!user) return res.status(404).json({ error: 'No account found with that email address' });

            // Security check: if not superadmin, can only reset students
            if (req.user.role !== 'superadmin' && user.role !== 'student') {
                return res.status(403).json({ error: 'Access denied. You can only reset passwords for student accounts.' });
            }

            user.password = hashedPassword;
            user.must_change_password = true;
            await user.save();

            await sendAdminResetPasswordEmail(user.email, tempPassword);
            return res.json({ message: 'Password reset — temporary credentials emailed' });
        }

        const user = await queryOne('SELECT id, email, role FROM users WHERE id = ?', [email]);
        if (!user) return res.status(404).json({ error: 'No account found with that email address' });

        // Security check: if not superadmin, can only reset students
        if (req.user.role !== 'superadmin' && user.role !== 'student') {
            return res.status(403).json({ error: 'Access denied. You can only reset passwords for student accounts.' });
        }

        await run('UPDATE users SET password = ?, must_change_password = ? WHERE id = ?', [hashedPassword, true, user.id]);

        const emailSent = await sendAdminResetPasswordEmail(user.email, tempPassword);
        if (!emailSent) {
            console.warn('⚠️ Email delivery failed for password reset by email.');
        }

        res.json({ message: 'Password reset — temporary credentials emailed' });
    } catch (error) {
        console.error('Reset password by email error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
}

/**
 * Grant or revoke Finance editing permission for a user.
 * Only accessible by superadmin.
 */
export async function updateFinancePermission(req, res) {
    try {
        const { can_edit_finance } = req.body;
        const userId = req.params.id;

        if (typeof can_edit_finance === 'undefined') {
            return res.status(400).json({ error: 'can_edit_finance field is required' });
        }

        const flag = can_edit_finance ? true : false;

        if (await isMongo()) {
            const User = (await import('../models/mongo/User.js')).default;
            const user = await User.findByIdAndUpdate(userId, { can_edit_finance: flag }, { new: true }).select('-password');
            if (!user) return res.status(404).json({ error: 'User not found' });
            return res.json({ message: 'Finance permission updated', can_edit_finance: flag });
        }

        const user = await queryOne('SELECT id, role FROM users WHERE id = ?', [userId]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Only admins can be granted finance editing rights
        if (!['admin', 'superadmin'].includes(user.role)) {
            return res.status(400).json({ error: 'Finance editing rights can only be granted to admins' });
        }

        await run('UPDATE users SET can_edit_finance = ? WHERE id = ?', [flag, userId]);
        res.json({ message: `Finance editing ${flag ? 'granted' : 'revoked'} successfully`, can_edit_finance: flag });
    } catch (error) {
        console.error('Update finance permission error:', error);
        res.status(500).json({ error: 'Failed to update finance permission' });
    }
}

/**
 * Grant or revoke Student account management permission for a user.
 * Only accessible by superadmin.
 */
export async function updateStudentPermission(req, res) {
    try {
        const { can_edit_students } = req.body;
        const userId = req.params.id;

        if (typeof can_edit_students === 'undefined') {
            return res.status(400).json({ error: 'can_edit_students field is required' });
        }

        const flag = can_edit_students ? true : false;

        if (await isMongo()) {
            const User = (await import('../models/mongo/User.js')).default;
            const user = await User.findByIdAndUpdate(userId, { can_edit_students: flag }, { new: true }).select('-password');
            if (!user) return res.status(404).json({ error: 'User not found' });
            return res.json({ message: 'Student registry permission updated', can_edit_students: flag });
        }

        const user = await queryOne('SELECT id, role FROM users WHERE id = ?', [userId]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Only admins can be granted student editing rights
        if (!['admin', 'superadmin'].includes(user.role)) {
            return res.status(400).json({ error: 'Student management rights can only be granted to admins' });
        }

        await run('UPDATE users SET can_edit_students = ? WHERE id = ?', [flag, userId]);
        res.json({ message: `Student management ${flag ? 'granted' : 'revoked'} successfully`, can_edit_students: flag });
    } catch (error) {
        console.error('Update student permission error:', error);
        res.status(500).json({ error: 'Failed to update student permission' });
    }
}
