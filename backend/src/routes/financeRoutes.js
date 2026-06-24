/**
 * Finance Routes — Fees, Payments, M-Pesa, Monthly Tracking
 */
import express from 'express';
import * as financeController from '../controllers/financeController.js';
import * as monthlyFeeController from '../controllers/monthlyFeeController.js';
import { authenticateToken, authorizeRoles, authorizeFinanceEdit } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    next();
};

const paymentValidation = [
    body('student_id').notEmpty().withMessage('Student ID is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be a positive number'),
    body('method').notEmpty().withMessage('Payment method is required'),
    validate,
];

const feeValidation = [
    body('course_id').notEmpty().withMessage('Course ID is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a non-negative number'),
    validate,
];

// ── Fee Structures ────────────────────────────────────────────────────────────
router.post('/finance/sync', authenticateToken, authorizeFinanceEdit, financeController.syncAllFees);
router.get('/finance/fees', authenticateToken, authorizeRoles('admin', 'superadmin'), financeController.getFeeStructures);
router.post('/finance/fees', authenticateToken, authorizeFinanceEdit, feeValidation, financeController.createFeeStructure);
router.put('/finance/fees/:id', authenticateToken, authorizeFinanceEdit, financeController.updateFeeStructure);
router.delete('/finance/fees/:id', authenticateToken, authorizeFinanceEdit, financeController.deleteFeeStructure);

// ── Student Fees ──────────────────────────────────────────────────────────────
router.get('/finance/student-fees', authenticateToken, authorizeRoles('admin', 'superadmin'), financeController.getAllStudentFees);
router.get('/finance/student-fees/:studentId', authenticateToken, financeController.getStudentFees);
router.put('/finance/student-fees/:id', authenticateToken, authorizeFinanceEdit, financeController.updateStudentFee);

// ── Payments ──────────────────────────────────────────────────────────────────
router.post('/finance/payments', authenticateToken, authorizeRoles('admin', 'superadmin'), paymentValidation, financeController.recordPayment);
// Students can read their own payments — IDOR is enforced inside the controller
router.get('/finance/payments', authenticateToken, financeController.getPayments);
router.put('/finance/payments/:id', authenticateToken, authorizeFinanceEdit, financeController.updatePayment);
router.delete('/finance/payments/:id', authenticateToken, authorizeFinanceEdit, financeController.deletePayment);

// ── M-Pesa ────────────────────────────────────────────────────────────────────
// TODO: Add Safaricom IP whitelist / signature validation for production security
router.post('/finance/mpesa-callback', financeController.mpesaCallback);

// ── Analytics ────────────────────────────────────────────────────────────────
router.get('/finance/analytics', authenticateToken, authorizeRoles('admin', 'superadmin'), financeController.getFinanceAnalytics);

// ── Monthly Fee Tracking ──────────────────────────────────────────────────────
router.get('/finance/monthly-tracking', authenticateToken, authorizeRoles('admin', 'superadmin'), monthlyFeeController.getAllMonthlyTracking);
router.get('/finance/monthly-tracking/status', authenticateToken, authorizeRoles('admin', 'superadmin'), monthlyFeeController.getCurrentMonthStatus);
router.get('/finance/monthly-tracking/:sid', authenticateToken, monthlyFeeController.getStudentMonthlyTracking);
router.post('/finance/monthly-tracking/record', authenticateToken, authorizeRoles('admin', 'superadmin'), monthlyFeeController.recordMonthlyPayment);
router.post('/finance/monthly-tracking/init', authenticateToken, authorizeRoles('admin', 'superadmin'), monthlyFeeController.initializeMonthlyRecords);
router.get('/finance/monthly-alerts', authenticateToken, authorizeRoles('admin', 'superadmin'), monthlyFeeController.getAdminAlerts);
router.get('/finance/monthly-report', authenticateToken, authorizeRoles('admin', 'superadmin'), monthlyFeeController.getMonthlyReport);
router.get('/finance/monthly-export', authenticateToken, authorizeRoles('admin', 'superadmin'), monthlyFeeController.exportReport);

export default router;
