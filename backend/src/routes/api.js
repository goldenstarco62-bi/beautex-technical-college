import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as authController from '../controllers/authController.js';
import * as studentController from '../controllers/studentController.js';
import * as courseController from '../controllers/courseController.js';
import * as facultyController from '../controllers/facultyController.js';
import * as attendanceController from '../controllers/attendanceController.js';
import * as gradeController from '../controllers/gradeController.js';
import * as announcementController from '../controllers/announcementController.js';
import notificationController from '../controllers/notificationController.js';
import * as sessionController from '../controllers/sessionController.js';
import * as userController from '../controllers/userController.js';
import * as reportController from '../controllers/reportController.js';
import * as activityReportController from '../controllers/activityReportController.js';
import * as settingsController from '../controllers/settingsController.js';
import * as statsController from '../controllers/statsController.js';
import * as financeController from '../controllers/financeController.js';
import * as academicController from '../controllers/academicController.js';
import * as materialController from '../controllers/materialController.js';
import * as profileController from '../controllers/profileController.js';
import { authorizeRoles } from '../middleware/auth.js';


import { logAudit } from '../middleware/audit.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Auth routes (public)
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/change-password', authenticateToken, authController.changePassword);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);
router.get('/auth/me', authenticateToken, authController.getMe);

// Student routes (protected)
router.get('/students', authenticateToken, studentController.getAllStudents);
router.get('/students/search', authenticateToken, studentController.searchStudents);
router.get('/students/:id', authenticateToken, studentController.getStudent);
router.get('/students/:id', authenticateToken, studentController.getStudent);
router.post('/students', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('CREATE_STUDENT', 'students'), studentController.createStudent);
router.put('/students/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('UPDATE_STUDENT', 'students'), studentController.updateStudent);
router.delete('/students/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('DELETE_STUDENT', 'students'), studentController.deleteStudent);


// Course routes (protected)
router.get('/courses', authenticateToken, courseController.getAllCourses);
router.get('/courses/:id', authenticateToken, courseController.getCourse);
router.post('/courses', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('CREATE_COURSE', 'courses'), courseController.createCourse);
router.put('/courses/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('UPDATE_COURSE', 'courses'), courseController.updateCourse);
router.delete('/courses/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('DELETE_COURSE', 'courses'), courseController.deleteCourse);


// Faculty routes (protected)
router.get('/faculty', authenticateToken, facultyController.getAllFaculty);
router.get('/faculty/:id', authenticateToken, facultyController.getFaculty);
router.post('/faculty', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('CREATE_FACULTY', 'faculty'), facultyController.createFaculty);
router.put('/faculty/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('UPDATE_FACULTY', 'faculty'), facultyController.updateFaculty);
router.delete('/faculty/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), logAudit('DELETE_FACULTY', 'faculty'), facultyController.deleteFaculty);


// Attendance routes (protected)
router.get('/attendance', authenticateToken, attendanceController.getAllAttendance);
router.post('/attendance', authenticateToken, attendanceController.markAttendance);
router.put('/attendance/:id', authenticateToken, attendanceController.updateAttendance);

// Grade routes (protected)
router.get('/grades', authenticateToken, gradeController.getAllGrades);
router.post('/grades', authenticateToken, gradeController.createGrade);
router.put('/grades/:id', authenticateToken, gradeController.updateGrade);
router.delete('/grades/:id', authenticateToken, gradeController.deleteGrade);

// Announcement routes (protected)
router.get('/announcements', authenticateToken, announcementController.getAllAnnouncements);
router.post('/announcements', authenticateToken, authorizeRoles('admin', 'superadmin'), announcementController.createAnnouncement);
router.put('/announcements/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), announcementController.updateAnnouncement);
router.delete('/announcements/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), announcementController.deleteAnnouncement);

// Notification routes (protected)
router.get('/notifications', authenticateToken, notificationController.getAll);
router.put('/notifications/:id/read', authenticateToken, notificationController.markRead);

// Session (Schedule) routes (protected)
router.get('/sessions', authenticateToken, sessionController.getAllSessions);
router.post('/sessions', authenticateToken, authorizeRoles('admin', 'superadmin'), sessionController.createSession);
router.delete('/sessions/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), sessionController.deleteSession);

// Profile Routes (All Authenticated Users)
router.get('/profile', authenticateToken, profileController.getProfile);
router.put('/profile', authenticateToken, profileController.updateProfile);

// User Management routes (Admin & Superadmin)
router.get('/users', authenticateToken, authorizeRoles('admin', 'superadmin'), userController.getAllUsers);
router.put('/users/:id/role', authenticateToken, authorizeRoles('superadmin'), userController.updateUserRole);
router.put('/users/:id/status', authenticateToken, authorizeRoles('admin', 'superadmin'), userController.toggleUserStatus);
router.put('/users/:id/password', authenticateToken, authorizeRoles('admin', 'superadmin'), userController.resetUserPassword);
router.post('/users/reset-by-email', authenticateToken, authorizeRoles('admin', 'superadmin'), userController.resetPasswordByEmail);
router.delete('/users/:id', authenticateToken, authorizeRoles('superadmin'), userController.deleteUser);
router.get('/audit-logs', authenticateToken, authorizeRoles('superadmin'), userController.getAuditLogs);


// Academic Reports (Trainers/Admin/Superadmin)
router.get('/reports', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), reportController.getAllReports);
router.get('/reports/student/:studentId', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), reportController.getStudentReports);
router.post('/reports', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), reportController.createReport);
router.put('/reports/:id', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), reportController.updateReport);
router.delete('/reports/:id', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), reportController.deleteReport);

// Activity Reports (Admin/Superadmin Only)
// Daily Reports
router.get('/activity-reports/daily', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getAllDailyReports);
router.get('/activity-reports/daily/:date', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getDailyReport);
router.post('/activity-reports/daily', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.createDailyReport);
router.put('/activity-reports/daily/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.updateDailyReport);
router.delete('/activity-reports/daily/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.deleteDailyReport);

// Weekly Reports
router.get('/activity-reports/weekly', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getAllWeeklyReports);
router.get('/activity-reports/weekly/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getWeeklyReport);
router.post('/activity-reports/weekly', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.createWeeklyReport);
router.put('/activity-reports/weekly/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.updateWeeklyReport);
router.delete('/activity-reports/weekly/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.deleteWeeklyReport);

// Monthly Reports
router.get('/activity-reports/monthly', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getAllMonthlyReports);
router.get('/activity-reports/monthly/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getMonthlyReport);
router.post('/activity-reports/monthly', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.createMonthlyReport);
router.put('/activity-reports/monthly/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.updateMonthlyReport);
router.delete('/activity-reports/monthly/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.deleteMonthlyReport);

// Reports Summary
router.get('/activity-reports/summary', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getReportsSummary);


// Dashboard Stats
router.get('/stats/dashboard', authenticateToken, statsController.getDashboardStats);

// Finance Routes
router.get('/finance/fees', authenticateToken, authorizeRoles('admin', 'superadmin'), financeController.getFeeStructures);
router.post('/finance/fees', authenticateToken, authorizeRoles('admin', 'superadmin'), financeController.createFeeStructure);
router.get('/finance/student-fees', authenticateToken, authorizeRoles('admin', 'superadmin'), financeController.getAllStudentFees);
router.get('/finance/student-fees/:studentId', authenticateToken, financeController.getStudentFees);
router.post('/finance/payments', authenticateToken, authorizeRoles('admin', 'superadmin'), financeController.recordPayment);
router.get('/finance/payments', authenticateToken, authorizeRoles('admin', 'superadmin'), financeController.getPayments);
router.get('/finance/analytics', authenticateToken, authorizeRoles('admin', 'superadmin'), financeController.getFinanceAnalytics);

// Academic Master Routes
router.get('/academic/departments', authenticateToken, academicController.getDepartments);
router.post('/academic/departments', authenticateToken, authorizeRoles('admin', 'superadmin'), academicController.createDepartment);
router.get('/academic/periods', authenticateToken, academicController.getAcademicPeriods);
router.post('/academic/periods', authenticateToken, authorizeRoles('admin', 'superadmin'), academicController.createAcademicPeriod);
router.put('/academic/periods/:id/activate', authenticateToken, authorizeRoles('admin', 'superadmin'), academicController.setActivePeriod);
router.post('/academic/promote', authenticateToken, authorizeRoles('admin', 'superadmin'), academicController.promoteStudents);

// Course Materials Routes
router.get('/materials', authenticateToken, materialController.getMaterials);
router.post('/materials', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), upload.single('file'), materialController.uploadMaterial);
router.delete('/materials/:id', authenticateToken, materialController.deleteMaterial);


// Settings Routes (Admin & Superadmin)
router.get('/settings', authenticateToken, authorizeRoles('admin', 'superadmin'), settingsController.getSettings);
router.put('/settings', authenticateToken, authorizeRoles('admin', 'superadmin'), settingsController.updateSettings);
router.get('/settings/backup', authenticateToken, authorizeRoles('superadmin'), settingsController.downloadBackup);

// Multer error handler (file size & type errors)
router.use((err, req, res, next) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File is too large. Maximum size is 50 MB.' });
    }
    if (err && err.message && err.message.startsWith('File type not allowed')) {
        return res.status(415).json({ error: err.message });
    }
    next(err);
});

export default router;
