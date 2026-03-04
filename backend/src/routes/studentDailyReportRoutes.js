import express from 'express';
import { getAllDailyReports, createDailyReport, deleteDailyReport, addStudentComment } from '../controllers/studentDailyReportController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getAllDailyReports);
router.post('/', authorize('teacher', 'admin', 'superadmin'), createDailyReport);
router.patch('/:id/student-comment', authorize('student'), addStudentComment);
router.delete('/:id', authorize('teacher', 'admin', 'superadmin'), deleteDailyReport);

export default router;
