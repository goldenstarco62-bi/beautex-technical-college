/**
 * Student, Course & Faculty Routes
 */
import express from 'express';
import * as studentController from '../controllers/studentController.js';
import * as courseController from '../controllers/courseController.js';
import * as facultyController from '../controllers/facultyController.js';
import * as studentDashboardController from '../controllers/studentDashboardController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = express.Router();

// ── Student Dashboard (consolidated — replaces 9 individual calls) ───────────
router.get('/student-dashboard', authenticateToken, authorizeRoles('student'), studentDashboardController.getStudentDashboard);

// ── Students ──────────────────────────────────────────────────────────────────
router.get('/students', authenticateToken, studentController.getAllStudents);
router.get('/students/search', authenticateToken, studentController.searchStudents);
router.put('/students/bulk-status', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('BULK_UPDATE_STUDENT_STATUS', 'students'), studentController.bulkUpdateStatus);
router.get('/students/:id', authenticateToken, studentController.getStudent);
router.post('/students', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('CREATE_STUDENT', 'students'), studentController.createStudent);
router.put('/students/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('UPDATE_STUDENT', 'students'), studentController.updateStudent);
router.delete('/students/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('DELETE_STUDENT', 'students'), studentController.deleteStudent);

// ── Courses ───────────────────────────────────────────────────────────────────
router.get('/courses', authenticateToken, courseController.getAllCourses);
router.get('/courses/:id', authenticateToken, courseController.getCourse);
router.post('/courses', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('CREATE_COURSE', 'courses'), courseController.createCourse);
router.put('/courses/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('UPDATE_COURSE', 'courses'), courseController.updateCourse);
router.delete('/courses/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('DELETE_COURSE', 'courses'), courseController.deleteCourse);

// ── Faculty ───────────────────────────────────────────────────────────────────
router.get('/faculty', authenticateToken, facultyController.getAllFaculty);
router.get('/faculty/:id', authenticateToken, facultyController.getFaculty);
router.post('/faculty', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('CREATE_FACULTY', 'faculty'), facultyController.createFaculty);
router.put('/faculty/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('UPDATE_FACULTY', 'faculty'), facultyController.updateFaculty);
router.delete('/faculty/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('DELETE_FACULTY', 'faculty'), facultyController.deleteFaculty);

export default router;
