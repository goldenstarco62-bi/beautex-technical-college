/**
 * Academic Routes — Attendance, Grades, Sessions, Reports, Materials, Announcements
 */
import express from 'express';
import * as attendanceController from '../controllers/attendanceController.js';
import * as gradeController from '../controllers/gradeController.js';
import * as announcementController from '../controllers/announcementController.js';
import notificationController from '../controllers/notificationController.js';
import * as sessionController from '../controllers/sessionController.js';
import * as reportController from '../controllers/reportController.js';
import * as activityReportController from '../controllers/activityReportController.js';
import * as academicController from '../controllers/academicController.js';
import * as materialController from '../controllers/materialController.js';
import * as trainerReportController from '../controllers/trainerReportController.js';
import * as studentDailyReportController from '../controllers/studentDailyReportController.js';
import * as statsController from '../controllers/statsController.js';
import * as interactionController from '../controllers/interactionController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// ── Dashboard Stats ───────────────────────────────────────────────────────────
router.get('/stats/dashboard', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), statsController.getDashboardStats);
router.get('/stats/search', authenticateToken, statsController.globalSearch);

// ── Attendance ────────────────────────────────────────────────────────────────
router.get('/attendance/summary', authenticateToken, authorizeRoles('admin', 'superadmin', 'teacher'), attendanceController.getAttendanceSummary);
router.get('/attendance', authenticateToken, attendanceController.getAllAttendance);
router.post('/attendance', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), attendanceController.markAttendance);
router.put('/attendance/:id', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), attendanceController.updateAttendance);
router.delete('/attendance/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), attendanceController.deleteAttendance);

// ── Grades ────────────────────────────────────────────────────────────────────
router.get('/grades', authenticateToken, gradeController.getAllGrades);
router.get('/grades/batch-students', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), gradeController.getBatchStudents);
router.post('/grades/batch', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), gradeController.createBatchGrades);
router.post('/grades', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), gradeController.createGrade);
router.put('/grades/:id', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), gradeController.updateGrade);
router.delete('/grades/:id', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), gradeController.deleteGrade);

// ── Announcements ─────────────────────────────────────────────────────────────
router.get('/announcements', authenticateToken, announcementController.getAllAnnouncements);
router.post('/announcements', authenticateToken, authorizeRoles('admin', 'superadmin'), announcementController.createAnnouncement);
router.put('/announcements/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), announcementController.updateAnnouncement);
router.delete('/announcements/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), announcementController.deleteAnnouncement);

// ── Notifications ─────────────────────────────────────────────────────────────
router.get('/notifications', authenticateToken, notificationController.getAll);
router.put('/notifications/:id/read', authenticateToken, notificationController.markRead);

// ── Sessions (Timetable) ──────────────────────────────────────────────────────
router.get('/sessions', authenticateToken, sessionController.getAllSessions);
router.post('/sessions', authenticateToken, authorizeRoles('admin', 'superadmin'), sessionController.createSession);
router.delete('/sessions/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), sessionController.deleteSession);

// ── Academic Master (Departments & Periods) ───────────────────────────────────
router.get('/academic/departments', authenticateToken, academicController.getDepartments);
router.post('/academic/departments', authenticateToken, authorizeRoles('admin', 'superadmin'), academicController.createDepartment);
router.put('/academic/departments/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), academicController.updateDepartment);
router.delete('/academic/departments/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), academicController.deleteDepartment);
router.get('/academic/periods', authenticateToken, academicController.getAcademicPeriods);
router.post('/academic/periods', authenticateToken, authorizeRoles('admin', 'superadmin'), academicController.createAcademicPeriod);
router.put('/academic/periods/:id/activate', authenticateToken, authorizeRoles('admin', 'superadmin'), academicController.setActivePeriod);
router.delete('/academic/periods/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), academicController.deleteAcademicPeriod);
router.post('/academic/promote', authenticateToken, authorizeRoles('admin', 'superadmin'), academicController.promoteStudents);

// ── Academic Reports ──────────────────────────────────────────────────────────
router.get('/reports', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), reportController.getAllReports);
router.get('/reports/student/:studentId', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), reportController.getStudentReports);
router.post('/reports', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), reportController.createReport);
router.put('/reports/:id', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), reportController.updateReport);
router.delete('/reports/:id', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), reportController.deleteReport);

// ── Activity Reports ──────────────────────────────────────────────────────────
// Daily
router.get('/activity-reports/daily', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getAllDailyReports);
// FIX: Specific routes must come before parameterized wildcard routes to avoid shadowing
router.get('/activity-reports/daily/id/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getDailyReportById);
router.get('/activity-reports/daily/:date', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getDailyReport);
router.post('/activity-reports/daily', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.createDailyReport);
router.put('/activity-reports/daily/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.updateDailyReport);
router.delete('/activity-reports/daily/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.deleteDailyReport);
// Weekly
router.get('/activity-reports/weekly', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getAllWeeklyReports);
router.get('/activity-reports/weekly/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getWeeklyReport);
router.post('/activity-reports/weekly', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.createWeeklyReport);
router.put('/activity-reports/weekly/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.updateWeeklyReport);
router.delete('/activity-reports/weekly/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.deleteWeeklyReport);
// Monthly
router.get('/activity-reports/monthly', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getAllMonthlyReports);
router.get('/activity-reports/monthly/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getMonthlyReport);
router.post('/activity-reports/monthly', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.createMonthlyReport);
router.put('/activity-reports/monthly/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.updateMonthlyReport);
router.delete('/activity-reports/monthly/:id', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.deleteMonthlyReport);
// Summary & auto-capture
router.get('/activity-reports/summary', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getReportsSummary);
router.get('/activity-reports/auto-capture', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getAutoCaptureStats);
router.get('/activity-reports/consolidated', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getConsolidatedReport);
router.get('/activity-reports/consolidated-dept', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getDepartmentalConsolidatedReport);
router.get('/activity-reports/academic-summary', authenticateToken, authorizeRoles('admin', 'superadmin'), activityReportController.getAcademicSummary);
// Attendance PDF reports
router.post('/activity-reports/generate-daily-attendance', authenticateToken, authorizeRoles('admin', 'superadmin'), reportController.generateDailyAttendanceReport);
router.get('/activity-reports/attendance-list', authenticateToken, authorizeRoles('admin', 'superadmin'), reportController.listAttendanceReports);
router.get('/activity-reports/attendance-download/:fileName', authenticateToken, authorizeRoles('admin', 'superadmin'), reportController.downloadAttendanceReport);

// ── Trainer Reports ───────────────────────────────────────────────────────────
router.get('/trainer-reports', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), trainerReportController.getAllReports);
router.post('/trainer-reports', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), trainerReportController.createReport);
router.delete('/trainer-reports/:id', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), trainerReportController.deleteReport);

// ── Student Daily Progress Reports ────────────────────────────────────────────
router.get('/student-daily-reports', authenticateToken, studentDailyReportController.getAllDailyReports);
router.post('/student-daily-reports', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), studentDailyReportController.createDailyReport);
router.patch('/student-daily-reports/:id/student-comment', authenticateToken, authorizeRoles('student'), studentDailyReportController.addStudentComment);
router.delete('/student-daily-reports/:id', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), studentDailyReportController.deleteDailyReport);

// ── Study Materials ───────────────────────────────────────────────────────────
router.get('/materials', authenticateToken, materialController.getMaterials);
router.get('/materials/:id/download', authenticateToken, materialController.downloadMaterial);
router.post('/materials', authenticateToken, authorizeRoles('teacher', 'admin', 'superadmin'), upload.single('file'), materialController.uploadMaterial);
router.delete('/materials/:id', authenticateToken, materialController.deleteMaterial);

// ── Interactions (Comments & Reactions) ──────────────────────────────────────
router.get('/interactions', authenticateToken, interactionController.getInteractions);
router.post('/interactions', authenticateToken, interactionController.createInteraction);
router.post('/interactions/:id/react', authenticateToken, interactionController.toggleReaction);
router.delete('/interactions/:id', authenticateToken, interactionController.deleteInteraction);

export default router;
