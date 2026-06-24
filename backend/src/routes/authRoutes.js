/**
 * Auth & Profile Routes
 */
import express from 'express';
import * as authController from '../controllers/authController.js';
import * as profileController from '../controllers/profileController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
    next();
};

const loginValidation = [
    body('email').isEmail().withMessage('Please enter a valid email address'),
    body('password').notEmpty().withMessage('Password is required'),
    validate,
];

const registerValidation = [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/\d/).withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
    body('role').isIn(['superadmin', 'admin', 'teacher', 'student']).withMessage('Invalid role'),
    validate,
];

// Registration — superadmin only
router.post('/auth/register', authenticateToken, authorizeRoles('superadmin'), registerValidation, authController.register);
router.post('/auth/login', loginValidation, authController.login);
router.post('/auth/change-password', authenticateToken, authController.changePassword);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);
router.get('/auth/me', authenticateToken, authController.getMe);
// Lightweight heartbeat — triggers authenticateToken (which updates last_seen_at) without fetching the full user record
router.get('/auth/ping', authenticateToken, (_req, res) => res.json({ ok: true }));

// Profile (all authenticated users)
router.get('/profile', authenticateToken, profileController.getProfile);
router.put('/profile', authenticateToken, profileController.updateProfile);

export default router;
