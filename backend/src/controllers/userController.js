import bcrypt from 'bcryptjs';
import { getDb, query, queryOne, run } from '../config/database.js';

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

        const users = await query('SELECT id, email, role, status FROM users ORDER BY email');
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
        const { password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        if (await isMongo()) {
            const User = (await import('../models/mongo/User.js')).default;
            const user = await User.findByIdAndUpdate(req.params.id, { password: hashedPassword }, { new: true }).select('-password');
            if (!user) return res.status(404).json({ error: 'User not found' });
            return res.json({ message: 'Password reset successfully' });
        }

        const result = await run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.params.id]);
        if (result.changes === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'Password reset successfully' });
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
            return res.json({ message: 'Audit logs not implemented for MongoDB' });
        }

        const logs = await query(`
            SELECT a.*, u.email as user_email 
            FROM audit_logs a 
            LEFT JOIN users u ON a.user_id = u.id 
            ORDER BY a.created_at DESC 
            LIMIT 100
        `);
        res.json(logs);
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
}

