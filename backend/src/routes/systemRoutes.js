/**
 * System, Users, Settings & Audit Log Routes (Superadmin/Admin level)
 */
import express from 'express';
import * as userController from '../controllers/userController.js';
import * as settingsController from '../controllers/settingsController.js';
import { authenticateToken, authorizeRoles, authorizeStudentEdit } from '../middleware/auth.js';

const router = express.Router();

// Debug Route (secured — superadmin only)
router.get('/debug/schema/:table', authenticateToken, authorizeRoles('superadmin'), async (req, res) => {
    try {
        const { table } = req.params;
        const { query } = await import('../config/database.js');
        if (process.env.DATABASE_URL) {
            const cols = await query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = ?`, [table]);
            return res.json({ type: 'postgres', table, columns: cols });
        } else {
            const cols = await query(`PRAGMA table_info(${table})`);
            return res.json({ type: 'sqlite', table, columns: cols });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// User Management routes (Admin & Superadmin / Superadmin strictly where applicable)
router.get('/users', authenticateToken, authorizeRoles('superadmin'), userController.getAllUsers);
router.put('/users/:id/role', authenticateToken, authorizeRoles('superadmin'), userController.updateUserRole);
router.put('/users/:id/status', authenticateToken, authorizeStudentEdit, userController.updateUserStatus);
router.put('/users/:id/password', authenticateToken, authorizeStudentEdit, userController.resetUserPassword);
router.post('/users/reset-by-email', authenticateToken, authorizeStudentEdit, userController.resetPasswordByEmail);
router.delete('/users/:id', authenticateToken, authorizeRoles('superadmin'), userController.deleteUser);
router.get('/audit-logs', authenticateToken, authorizeRoles('superadmin'), userController.getAuditLogs);
router.put('/users/:id/finance-permission', authenticateToken, authorizeRoles('superadmin'), userController.updateFinancePermission);
router.put('/users/:id/student-permission', authenticateToken, authorizeRoles('superadmin'), userController.updateStudentPermission);

// Settings Routes (Superadmin only)
router.get('/settings', authenticateToken, authorizeRoles('superadmin'), settingsController.getSettings);
router.put('/settings', authenticateToken, authorizeRoles('superadmin'), settingsController.updateSettings);
router.get('/settings/backup', authenticateToken, authorizeRoles('superadmin'), settingsController.downloadBackup);

export default router;
