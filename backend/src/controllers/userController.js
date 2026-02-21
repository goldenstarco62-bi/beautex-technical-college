import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb, query, queryOne, run } from '../config/database.js';
import { sendAdminResetPasswordEmail } from '../services/emailService.js';

async function isMongo() {
    const db = await getDb();
    return db.constructor.name === 'NativeConnection';
}

export async function getAllUsers(req, res) {
    try {
        if (await isMongo()) {
            const User = (await import('../models/mongo/User.js')).default;
            const users = await User.find().select('-password').sort({ email: 1 });
            return res.json(users);
        }

        const users = await query('SELECT id, email, role, status, name, created_at FROM users ORDER BY email');
        res.json(users);
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

export async function toggleUserStatus(req, res) {
    try {
        if (await isMongo()) {
            const User = (await import('../models/mongo/User.js')).default;
            const user = await User.findById(req.params.id);
            if (!user) return res.status(404).json({ error: 'User not found' });
            user.status = user.status === 'Active' ? 'Inactive' : 'Active';
            await user.save();
            return res.json({ id: user._id, email: user.email, role: user.role, status: user.status });
        }

        const user = await queryOne('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
        await run('UPDATE users SET status = ? WHERE id = ?', [newStatus, req.params.id]);
        res.json({ id: user.id, email: user.email, role: user.role, status: newStatus });
    } catch (error) {
        console.error('Toggle user status error:', error);
        res.status(500).json({ error: 'Failed to toggle user status' });
    }
}

export async function resetUserPassword(req, res) {
    try {
        const userId = req.params.id;
        const tempPassword = crypto.randomBytes(4).toString('hex'); // 8 hex chars
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        if (await isMongo()) {
            const User = (await import('../models/mongo/User.js')).default;
            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ error: 'User not found' });

            user.password = hashedPassword;
            user.must_change_password = true;
            await user.save();

            await sendAdminResetPasswordEmail(user.email, tempPassword);
            return res.json({ message: 'Password reset — temporary credentials emailed' });
        }

        const user = await queryOne('SELECT email FROM users WHERE id = ?', [userId]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        await run('UPDATE users SET password = ?, must_change_password = true WHERE id = ?', [hashedPassword, userId]);

        const emailSent = await sendAdminResetPasswordEmail(user.email, tempPassword);
        if (!emailSent) {
            console.warn('⚠️ Email delivery failed but password was reset. Temp password:', tempPassword);
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
        if (await isMongo()) {
            const AuditLog = (await import('../models/mongo/AuditLog.js')).default;
            const logs = await AuditLog.find().sort({ created_at: -1 }).limit(100);
            return res.json(logs);
        }

        const logs = await query(`
            SELECT * FROM audit_logs 
            ORDER BY created_at DESC 
            LIMIT 100
        `);
        res.json(logs);
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
        const hashedPassword = await bcrypt.hash(tempPassword, 10);

        if (await isMongo()) {
            const User = (await import('../models/mongo/User.js')).default;
            const user = await User.findOne({ email: email.toLowerCase() });
            if (!user) return res.status(404).json({ error: 'No account found with that email address' });

            user.password = hashedPassword;
            user.must_change_password = true;
            await user.save();

            await sendAdminResetPasswordEmail(user.email, tempPassword);
            return res.json({ message: 'Password reset — temporary credentials emailed' });
        }

        const user = await queryOne('SELECT id, email FROM users WHERE LOWER(email) = LOWER(?)', [email]);
        if (!user) return res.status(404).json({ error: 'No account found with that email address' });

        await run('UPDATE users SET password = ?, must_change_password = true WHERE id = ?', [hashedPassword, user.id]);

        const emailSent = await sendAdminResetPasswordEmail(user.email, tempPassword);
        if (!emailSent) {
            console.warn('⚠️ Email delivery failed but password was reset. Temp password:', tempPassword);
        }

        res.json({ message: 'Password reset — temporary credentials emailed' });
    } catch (error) {
        console.error('Reset password by email error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
}
