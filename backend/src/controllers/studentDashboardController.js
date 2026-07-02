/**
 * studentDashboardController.js
 *
 * Consolidated endpoint that replaces the 9 individual API calls the student
 * dashboard was making. All queries run in parallel server-side via Promise.all,
 * then a single JSON payload is returned to the client.
 */
import { query, queryOne } from '../config/database.js';

const isMongo = async () => !!process.env.MONGODB_URI;

export async function getStudentDashboard(req, res) {
    try {
        const mongo = await isMongo();
        const userRole = String(req.user?.role || '').toLowerCase().trim();

        // Only students may hit this endpoint
        if (userRole !== 'student') {
            return res.status(403).json({ error: 'Access denied: students only' });
        }

        const effectiveStudentId = String(req.user?.student_id || req.user?.id || '').trim();
        if (!effectiveStudentId) {
            return res.status(400).json({ error: 'Student ID not found on token' });
        }

        if (mongo) {
            return await getStudentDashboardMongo(req, res, effectiveStudentId);
        }

        return await getStudentDashboardSQL(req, res, effectiveStudentId);
    } catch (err) {
        console.error('Student dashboard error:', err);
        res.status(500).json({ error: 'Failed to load student dashboard' });
    }
}

// ─── MongoDB Implementation ───────────────────────────────────────────────────

async function getStudentDashboardMongo(req, res, studentId) {
    const [
        Student,
        Course,
        Announcement,
        Grade,
        Attendance,
        StudentFee,
        Payment,
        StudentDailyReport,
        MonthlyFeeTracking,
    ] = await Promise.all([
        import('../models/mongo/Student.js').then(m => m.default),
        import('../models/mongo/Course.js').then(m => m.default),
        import('../models/mongo/Announcement.js').then(m => m.default).catch(() => null),
        import('../models/mongo/Grade.js').then(m => m.default),
        import('../models/mongo/Attendance.js').then(m => m.default),
        import('../models/mongo/StudentFee.js').then(m => m.default).catch(() => null),
        import('../models/mongo/Payment.js').then(m => m.default).catch(() => null),
        import('../models/mongo/StudentDailyReport.js').then(m => m.default).catch(() => null),
        import('../models/mongo/MonthlyFeeTracking.js').then(m => m.default).catch(() => null),
    ]);

    const [
        profile,
        courses,
        announcements,
        grades,
        attendance,
        studentFee,
        recentPayments,
        dailyReports,
        monthlyFees,
    ] = await Promise.all([
        Student.findOne({ id: studentId }).lean().catch(() => null),
        Course.find().lean().catch(() => []),
        Announcement
            ? Announcement.find().sort({ created_at: -1 }).limit(3).lean().catch(() => [])
            : Promise.resolve([]),
        Grade.find({ student_id: studentId }).sort({ created_at: -1 }).lean().catch(() => []),
        Attendance.find({ student_id: studentId }).lean().catch(() => []),
        StudentFee ? StudentFee.findOne({ student_id: studentId }).lean().catch(() => null) : Promise.resolve(null),
        Payment
            ? Payment.find({ student_id: studentId }).sort({ payment_date: -1 }).limit(5).lean().catch(() => [])
            : Promise.resolve([]),
        StudentDailyReport
            ? StudentDailyReport.find({ student_id: studentId }).sort({ report_date: -1 }).limit(5).lean().catch(() => [])
            : Promise.resolve([]),
        MonthlyFeeTracking
            ? MonthlyFeeTracking.find({ student_id: studentId }).sort({ year: -1, month: -1 }).lean().catch(() => [])
            : Promise.resolve([]),
    ]);

    return res.json({
        profile,
        courses,
        announcements,
        grades,
        attendance,
        studentFee,
        recentPayments,
        dailyReports,
        monthlyFees,
    });
}

// ─── SQL Implementation ───────────────────────────────────────────────────────

async function getStudentDashboardSQL(req, res, studentId) {
    const [
        profileRow,
        courses,
        announcements,
        grades,
        attendance,
        studentFee,
        recentPayments,
        dailyReports,
        monthlyFees,
    ] = await Promise.all([
        // Profile
        queryOne('SELECT * FROM students WHERE id = ?', [studentId]).catch(() => null),

        // All courses (needed to match the student's enrolled course)
        query('SELECT * FROM courses').catch(() => []),

        // Last 3 announcements (newest first)
        query('SELECT * FROM announcements ORDER BY id DESC LIMIT 3').catch(() => []),

        // Units Covered / Marks for this student (replacing CAT grades)
        query(
            `SELECT sum.marks AS score,
                    100 AS max_score,
                    sum.unit_name AS assignment,
                    c.name AS course,
                    sum.recorded_date AS created_at,
                    sum.recorded_date AS month,
                    sum.grade AS grade,
                    sum.lecturer AS remarks,
                    s.name AS student_name
             FROM student_unit_marks sum
             LEFT JOIN students s ON sum.student_id = s.id
             LEFT JOIN courses c ON sum.course_id = c.id
             WHERE sum.student_id = ?
             ORDER BY sum.id DESC`,
            [studentId]
        ).catch(() => []),

        // Attendance for this student
        query('SELECT * FROM attendance WHERE student_id = ?', [studentId]).catch(() => []),

        // Student fee record
        queryOne('SELECT * FROM student_fees WHERE student_id = ?', [studentId]).catch(() => null),

        // Last 5 payments
        query(
            'SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC LIMIT 5',
            [studentId]
        ).catch(() => []),

        // Last 5 daily reports
        query(
            'SELECT * FROM student_daily_reports WHERE student_id = ? ORDER BY report_date DESC LIMIT 5',
            [studentId]
        ).catch(() => []),

        // Monthly fee tracking (all records for this student, newest first)
        query(
            'SELECT * FROM monthly_fee_tracking WHERE student_id = ? ORDER BY year DESC, month DESC',
            [studentId]
        ).catch(() => []),
    ]);

    return res.json({
        profile: profileRow || null,
        courses,
        announcements,
        grades,
        attendance,
        studentFee: studentFee || null,
        recentPayments,
        dailyReports,
        monthlyFees,
    });
}
