import { getDb, query, queryOne, run } from '../config/database.js';
import { parseCoursesField } from '../utils/courseParser.js';
import {
    getAttendanceConfig,
    normalizeStatus,
    resolvePeriodForDate,
    getPeriodRange,
    attendanceRate,
    attendanceBand,
    emptyCounts,
    countStatus,
    toDateOnly,
} from '../utils/attendance.js';
import notificationService from '../services/notificationService.js';

const isMongo = async () => !!process.env.MONGODB_URI;

// Helper to parse faculty courses list robustly
function parseFacultyCourses(coursesField) {
    return parseCoursesField(coursesField);
}

const dateOnly = toDateOnly;

// SQL-only helper shared by batch marking and alerts.
async function resolveTeacherCourses(email) {
    const fac = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [String(email || '').toLowerCase().trim()]);
    if (!fac) return [];
    const assigned = parseFacultyCourses(fac.courses);
    const instructed = await query('SELECT name FROM courses WHERE LOWER(instructor) = LOWER(?)', [fac.name]);
    return [...new Set([...assigned, ...instructed.map(c => c.name)])];
}

function teacherOwnsCourse(teacherCourses, course) {
    const target = String(course || '').toLowerCase().trim();
    return teacherCourses.some(tc => String(tc).toLowerCase().trim() === target);
}

export async function getAllAttendance(req, res) {
    try {
        const { role, email } = req.user;
        const { course, date, student_id, from, to, academic_period_id } = req.query;
        const mongo = await isMongo();

        let conditions = [];
        let params = [];

        // Base restriction by role
        if (role === 'student') {
            const sid = student_id || req.user.student_id || req.user.id;
            conditions.push(mongo ? { student_id: String(sid) } : 'student_id = ?');
            if (!mongo) params.push(String(sid));
        } else if (role === 'teacher') {
            const userEmail = String(email || '').toLowerCase().trim();
            let teacherCourses = [];

            if (mongo) {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                const fac = await Faculty.findOne({ email: { $regex: new RegExp(`^${userEmail}$`, 'i') } });
                if (fac) {
                    const matched = await Course.find({
                        $or: [{ instructor: { $regex: new RegExp(`^${fac.name}$`, 'i') } }, { name: { $in: parseFacultyCourses(fac.courses) } }]
                    }).select('name');
                    teacherCourses = matched.map(c => c.name);
                }
            } else {
                const fac = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [userEmail]);
                if (fac) {
                    const list = parseFacultyCourses(fac.courses);
                    const inst = await query('SELECT name FROM courses WHERE LOWER(instructor) = LOWER(?)', [fac.name]);
                    teacherCourses = [...new Set([...list, ...inst.map(c => c.name)])];
                }
            }

            if (course) {
                const target = String(course).toLowerCase().trim();
                const matched = teacherCourses.find(tc => tc.toLowerCase().trim() === target);
                if (!matched) return res.json([]); // Requesting course teacher doesn't own
                conditions.push(mongo ? { course: matched } : 'course = ?');
                if (!mongo) params.push(matched);
            } else {
                if (teacherCourses.length > 0) {
                    conditions.push(mongo ? { course: { $in: teacherCourses } } : `course IN (${teacherCourses.map(() => '?').join(',')})`);
                    if (!mongo) params.push(...teacherCourses);
                } else {
                    return res.json([]);
                }
            }
        } else if (student_id) {
            conditions.push(mongo ? { student_id: String(student_id) } : 'student_id = ?');
            if (!mongo) params.push(String(student_id));
        }

        // Additional filters from query params
        if (course && (role === 'admin' || role === 'superadmin' || role === 'student')) {
            conditions.push(mongo ? { course } : 'course = ?');
            if (!mongo) params.push(course);
        }
        if (date) {
            conditions.push(mongo ? { date } : 'date = ?');
            if (!mongo) params.push(date);
        }
        if (academic_period_id) {
            conditions.push(mongo ? { academic_period_id: Number(academic_period_id) } : 'academic_period_id = ?');
            if (!mongo) params.push(Number(academic_period_id));
        }
        if (from) {
            conditions.push(mongo ? { date: { $gte: from } } : 'date >= ?');
            if (!mongo) params.push(from);
        }
        if (to) {
            conditions.push(mongo ? { date: { $lte: to } } : 'date <= ?');
            if (!mongo) params.push(to);
        }

        if (mongo) {
            const Attendance = (await import('../models/mongo/Attendance.js')).default;
            const finalQuery = conditions.length > 0 ? { $and: conditions } : {};
            const attendance = await Attendance.find(finalQuery).sort({ date: -1 }).limit(1000);
            return res.json(attendance);
        }

        let sql = 'SELECT * FROM attendance';
        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }
        sql += ' ORDER BY date DESC LIMIT 1000';

        const attendance = await query(sql, params);

        // FIX: Normalize course names for Supabase/PostgreSQL (remove {"..."})
        // and DATE columns, which pg returns as JS Dates and JSON-serializes as
        // full ISO timestamps (student history compares them to YYYY-MM-DD).
        const cleanedAttendance = attendance.map(a => ({
            ...a,
            date: dateOnly(a.date),
            course: typeof a.course === 'string' && a.course.startsWith('{') && a.course.endsWith('}')
                ? a.course.slice(1, -1).replace(/"/g, '')
                : a.course
        }));

        res.json(cleanedAttendance);
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
}

export async function markAttendance(req, res) {
    try {
        const { student_id, course, date, status, topics_covered, trainer_remarks } = req.body;
        const { role, email } = req.user;

        if (!student_id || !course || !date || !status) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate against the statuses configured in Settings → Attendance
        const config = await getAttendanceConfig();
        const canonicalStatus = normalizeStatus(status, config.statuses);
        if (!canonicalStatus) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${config.statuses.join(', ')}` });
        }

        // Authorization check for teachers
        if (role === 'teacher') {
            const userEmail = String(email || '').toLowerCase().trim();
            let teacherCourses = [];

            if (await isMongo()) {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                const fac = await Faculty.findOne({ email: { $regex: new RegExp(`^${userEmail}$`, 'i') } });
                if (fac) {
                    const matched = await Course.find({
                        $or: [{ instructor: { $regex: new RegExp(`^${fac.name}$`, 'i') } }, { name: { $in: parseFacultyCourses(fac.courses) } }]
                    }).select('name');
                    teacherCourses = matched.map(c => c.name);
                }
            } else {
                const fac = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [userEmail]);
                if (fac) {
                    const list = parseFacultyCourses(fac.courses);
                    const inst = await query('SELECT name FROM courses WHERE LOWER(instructor) = LOWER(?)', [fac.name]);
                    teacherCourses = [...new Set([...list, ...inst.map(c => c.name)])];
                }
            }

            if (!teacherCourses.some(tc => tc.toLowerCase().trim() === course.toLowerCase().trim())) {
                return res.status(403).json({ error: `Security Protocol: You are not authorized to mark attendance for "${course}"` });
            }
        }

        // 1. Mark Attendance
        let attendanceRecord;
        if (await isMongo()) {
            const Attendance = (await import('../models/mongo/Attendance.js')).default;
            attendanceRecord = await Attendance.findOneAndUpdate(
                { student_id, course, date },
                { status: canonicalStatus, updated_at: new Date() },
                { upsert: true, new: true }
            );
        } else {
            const period = await resolvePeriodForDate(date);
            const existing = await queryOne('SELECT id FROM attendance WHERE student_id = ? AND course = ? AND date = ?', [student_id, course, date]);
            if (existing) {
                await run(
                    'UPDATE attendance SET status = ?, academic_period_id = COALESCE(?, academic_period_id) WHERE id = ?',
                    [canonicalStatus, period?.id ?? null, existing.id]
                );
                attendanceRecord = await queryOne('SELECT * FROM attendance WHERE id = ?', [existing.id]);
            } else {
                const result = await run(
                    'INSERT INTO attendance (student_id, course, date, status, academic_period_id) VALUES (?, ?, ?, ?, ?)',
                    [student_id, course, date, canonicalStatus, period?.id ?? null]
                );
                attendanceRecord = await queryOne('SELECT * FROM attendance WHERE id = ?', [result.lastID]);
            }
        }

        // 2. Automatically sync with Daily Progress Report if topics supplied (Optional)
        if (topics_covered !== undefined) {
            const trainer_name = req.user.name || (email ? email.split('@')[0] : 'Trainer');
            const trainer_email = email;

            if (await isMongo()) {
                const StudentDailyReport = (await import('../models/mongo/StudentDailyReport.js')).default;
                const searchDate = new Date(date);
                searchDate.setHours(0, 0, 0, 0);
                const nextDate = new Date(searchDate);
                nextDate.setDate(searchDate.getDate() + 1);

                await StudentDailyReport.findOneAndUpdate(
                    { student_id, report_date: { $gte: searchDate, $lt: nextDate } },
                    {
                        course, report_date: date, topics_covered, trainer_remarks,
                        trainer_name, trainer_email
                    },
                    { upsert: true }
                );
            } else {
                const existingReport = await queryOne('SELECT id FROM student_daily_reports WHERE student_id = ? AND report_date = ? AND course = ?', [student_id, date, course]);
                if (existingReport) {
                    await run(
                        'UPDATE student_daily_reports SET topics_covered = ?, trainer_remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [topics_covered, trainer_remarks || '', existingReport.id]
                    );
                } else {
                    const studentRes = await queryOne('SELECT name FROM students WHERE id = ?', [student_id]);
                    await run(
                        `INSERT INTO student_daily_reports (
                            student_id, student_name, course, report_date, topics_covered, trainer_remarks, trainer_name, trainer_email
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [student_id, studentRes?.name || 'Student', course, date, topics_covered, trainer_remarks || '', trainer_name, trainer_email]
                    );
                }
            }
        }

        return res.status(201).json(attendanceRecord);
    } catch (error) {
        console.error('Mark attendance error:', error);
        res.status(500).json({ error: 'Failed to mark attendance' });
    }
}

export async function updateAttendance(req, res) {
    try {
        const recordId = req.params.id;
        const { status, topics_covered, trainer_remarks } = req.body;

        const config = await getAttendanceConfig();
        const canonicalStatus = normalizeStatus(status, config.statuses);
        if (!canonicalStatus) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${config.statuses.join(', ')}` });
        }

        let updated;
        if (await isMongo()) {
            const Attendance = (await import('../models/mongo/Attendance.js')).default;
            updated = await Attendance.findByIdAndUpdate(recordId, { status: canonicalStatus }, { new: true });
        } else {
            const existing = await queryOne('SELECT * FROM attendance WHERE id = ?', [recordId]);
            if (!existing) return res.status(404).json({ error: 'Attendance record not found' });

            if (req.user.role === 'teacher') {
                const teacherCourses = await resolveTeacherCourses(req.user.email);
                if (!teacherOwnsCourse(teacherCourses, existing.course)) {
                    return res.status(403).json({ error: 'Forbidden: You can only edit attendance for your own courses' });
                }
            }

            const period = await resolvePeriodForDate(existing.date);
            await run(
                'UPDATE attendance SET status = ?, academic_period_id = COALESCE(academic_period_id, ?) WHERE id = ?',
                [canonicalStatus, period?.id ?? null, recordId]
            );
            updated = await queryOne('SELECT * FROM attendance WHERE id = ?', [recordId]);
        }

        if (!updated) return res.status(404).json({ error: 'Attendance record not found' });

        // Update Daily Report if record exists and topics supplied
        if (topics_covered !== undefined && updated.student_id && updated.date && updated.course) {
            const email = req.user.email;
            const trainer_name = req.user.name || (email ? email.split('@')[0] : 'Trainer');

            if (await isMongo()) {
                const StudentDailyReport = (await import('../models/mongo/StudentDailyReport.js')).default;
                const searchDate = new Date(updated.date);
                searchDate.setHours(0, 0, 0, 0);
                const nextDate = new Date(searchDate);
                nextDate.setDate(searchDate.getDate() + 1);

                await StudentDailyReport.findOneAndUpdate(
                    { student_id: updated.student_id, report_date: { $gte: searchDate, $lt: nextDate } },
                    {
                        topics_covered, trainer_remarks,
                        updated_at: new Date()
                    },
                    { upsert: true }
                );
            } else {
                const existingReport = await queryOne('SELECT id FROM student_daily_reports WHERE student_id = ? AND report_date = ? AND course = ?', [updated.student_id, updated.date, updated.course]);
                if (existingReport) {
                    await run(
                        'UPDATE student_daily_reports SET topics_covered = ?, trainer_remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [topics_covered, trainer_remarks || '', existingReport.id]
                    );
                } else {
                    const studentRes = await queryOne('SELECT name FROM students WHERE id = ?', [updated.student_id]);
                    await run(
                        `INSERT INTO student_daily_reports (
                            student_id, student_name, course, report_date, topics_covered, trainer_remarks, trainer_name, trainer_email
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [updated.student_id, studentRes?.name || 'Student', updated.course, updated.date, topics_covered, trainer_remarks || '', trainer_name, req.user.email]
                    );
                }
            }
        }

        return res.json(updated);
    } catch (error) {
        console.error('Update attendance error:', error);
        res.status(500).json({ error: 'Failed to update attendance' });
    }
}


/**
 * GET /attendance/config
 * Exposes the statuses, eligibility threshold and bands configured in Settings
 * so the register can render the same options the server validates against.
 */
export async function getAttendanceSettings(req, res) {
    try {
        const config = await getAttendanceConfig();
        const activePeriod = await queryOne('SELECT id, name FROM academic_periods WHERE is_active = TRUE LIMIT 1').catch(() => null);
        return res.json({ ...config, active_period: activePeriod || null });
    } catch (error) {
        console.error('Get attendance config error:', error);
        return res.status(500).json({ error: 'Failed to load attendance settings' });
    }
}

/**
 * POST /attendance/batch
 * Saves a whole day's register in one request instead of one call per student.
 * Body: { course, date, entries: [{ student_id, status }] }
 */
export async function markAttendanceBatch(req, res) {
    try {
        const { course, date, entries } = req.body;
        const { role, email } = req.user;

        if (!course || !date || !Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ error: 'course, date and a non-empty entries array are required' });
        }
        if (entries.length > 500) {
            return res.status(400).json({ error: 'A register can hold at most 500 entries' });
        }

        if (role === 'teacher') {
            const teacherCourses = await resolveTeacherCourses(email);
            if (!teacherOwnsCourse(teacherCourses, course)) {
                return res.status(403).json({ error: `You are not authorized to mark attendance for "${course}"` });
            }
        }

        const config = await getAttendanceConfig();
        const period = await resolvePeriodForDate(date);
        const saved = [];
        const skipped = [];

        for (const entry of entries) {
            const studentId = String(entry?.student_id || '').trim();
            const status = normalizeStatus(entry?.status, config.statuses);
            if (!studentId || !status) {
                skipped.push({ student_id: studentId, status: entry?.status, reason: 'unknown student or status' });
                continue;
            }

            const existing = await queryOne(
                'SELECT id FROM attendance WHERE student_id = ? AND course = ? AND date = ?',
                [studentId, course, date]
            );
            if (existing) {
                await run(
                    'UPDATE attendance SET status = ?, academic_period_id = COALESCE(?, academic_period_id) WHERE id = ?',
                    [status, period?.id ?? null, existing.id]
                );
            } else {
                await run(
                    'INSERT INTO attendance (student_id, course, date, status, academic_period_id) VALUES (?, ?, ?, ?, ?)',
                    [studentId, course, date, status, period?.id ?? null]
                );
            }
            saved.push({ student_id: studentId, status });
        }

        return res.status(saved.length > 0 ? 201 : 200).json({
            date,
            course,
            academic_period: period ? { id: period.id, name: period.name } : null,
            saved: saved.length,
            skipped,
        });
    } catch (error) {
        console.error('Batch attendance error:', error);
        return res.status(500).json({ error: 'Failed to save attendance register' });
    }
}

async function computeAttendanceAlerts({ role, email, studentId, course, periodId, thresholdOverride }) {
    const config = await getAttendanceConfig();
    const threshold = Math.min(100, Math.max(0, parseFloat(thresholdOverride) || config.threshold));
    const period = periodId ? await getPeriodRange(periodId) : null;
    if (periodId && !period) {
        const err = new Error('Academic period not found');
        err.status = 404;
        throw err;
    }

    let teacherCourses = null;
    if (role === 'teacher') {
        teacherCourses = await resolveTeacherCourses(email);
        if (course && !teacherOwnsCourse(teacherCourses, course)) {
            const err = new Error('You can only view alerts for courses you teach');
            err.status = 403;
            throw err;
        }
    }

    const studentConds = [];
    const studentParams = [];
    if (studentId) {
        studentConds.push('LOWER(TRIM(id)) = LOWER(TRIM(?))');
        studentParams.push(studentId);
    } else if (course) {
        studentConds.push('LOWER(course) LIKE LOWER(?)');
        studentParams.push(`%${String(course).trim()}%`);
    } else if (teacherCourses) {
        if (teacherCourses.length === 0) return { threshold, period, alerts: [] };
        studentConds.push(`(${teacherCourses.map(() => 'LOWER(course) LIKE LOWER(?)').join(' OR ')})`);
        teacherCourses.forEach(tc => studentParams.push(`%${tc}%`));
    }

    const students = await query(
        `SELECT id, name, course FROM students${studentConds.length ? ' WHERE ' + studentConds.join(' AND ') : ''}`,
        studentParams
    );

    const attConds = [];
    const attParams = [];
    if (period?.start_date && period?.end_date) {
        attConds.push('a.date >= ? AND a.date <= ?');
        attParams.push(period.start_date, period.end_date);
    }
    if (studentId) {
        attConds.push('LOWER(TRIM(a.student_id)) = LOWER(TRIM(?))');
        attParams.push(studentId);
    }
    if (course) {
        attConds.push('LOWER(a.course) LIKE LOWER(?)');
        attParams.push(`%${String(course).trim()}%`);
    } else if (teacherCourses) {
        attConds.push(`a.course IN (${teacherCourses.map(() => '?').join(',')})`);
        attParams.push(...teacherCourses);
    }

    const records = await query(
        `SELECT a.student_id, a.course, a.date, a.status, s.name AS student_name
         FROM attendance a
         LEFT JOIN students s ON LOWER(TRIM(a.student_id)) = LOWER(TRIM(s.id))
         ${attConds.length ? 'WHERE ' + attConds.join(' AND ') : ''}`,
        attParams
    );

    const buckets = new Map();
    const bucketKey = (sid, courseName) => `${sid}||${courseName}`;
    const ensureBucket = (sid, courseName, name) => {
        const key = bucketKey(sid, courseName);
        if (!buckets.has(key)) {
            buckets.set(key, { student_id: sid, student_name: name || sid, course: courseName, counts: emptyCounts() });
        }
        return buckets.get(key);
    };

    for (const student of students) {
        const sid = String(student.id || '').trim();
        if (!sid) continue;
        const courses = parseCoursesField(student.course);
        for (const courseName of (courses.length ? courses : ['Unassigned'])) {
            if (course && !courseName.toLowerCase().includes(String(course).toLowerCase().trim())) continue;
            ensureBucket(sid, courseName.trim(), student.name);
        }
    }

    for (const record of records) {
        const sid = String(record.student_id || '').trim();
        const courseName = String(record.course || '').trim();
        if (!sid || !courseName) continue;
        const bucket = ensureBucket(sid, courseName, record.student_name);
        countStatus(bucket.counts, record.status);
    }

    const alerts = [];
    for (const bucket of buckets.values()) {
        if (bucket.counts.total === 0) continue;
        const percentage = attendanceRate(bucket.counts);
        if (percentage >= threshold) continue;
        alerts.push({
            student_id: bucket.student_id,
            student_name: bucket.student_name,
            course: bucket.course,
            percentage,
            threshold,
            ...bucket.counts,
            missed: bucket.counts.absent + bucket.counts.sick,
            band: attendanceBand(percentage, config.thresholds),
        });
    }
    alerts.sort((a, b) => a.percentage - b.percentage || a.student_name.localeCompare(b.student_name));

    return { threshold, period: period ? { id: period.id, name: period.name } : null, alerts };
}

/**
 * GET /attendance/alerts
 * Students whose attendance percentage sits below the eligibility threshold.
 */
export async function getAttendanceAlerts(req, res) {
    try {
        const role = (req.user.role || '').toLowerCase().trim();
        const studentId = role === 'student'
            ? String(req.user.student_id || req.user.id || '').trim()
            : (req.query.student_id || '');
        const result = await computeAttendanceAlerts({
            role,
            email: req.user.email,
            studentId,
            course: req.query.course || '',
            periodId: req.query.academic_period_id || null,
            thresholdOverride: req.query.threshold,
        });
        return res.json(result);
    } catch (error) {
        console.error('Attendance alerts error:', error);
        return res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to build attendance alerts' });
    }
}

/**
 * POST /attendance/alerts/notify
 * Pushes an in-app notification to each student currently below the threshold.
 */
export async function notifyAttendanceAlerts(req, res) {
    try {
        const role = (req.user.role || '').toLowerCase().trim();
        if (!['admin', 'superadmin', 'teacher'].includes(role)) {
            return res.status(403).json({ error: 'You are not authorized to send attendance alerts' });
        }
        const result = await computeAttendanceAlerts({
            role,
            email: req.user.email,
            studentId: '',
            course: req.body?.course || '',
            periodId: req.body?.academic_period_id || null,
            thresholdOverride: req.body?.threshold,
        });

        const allowed = Array.isArray(req.body?.student_ids) && req.body.student_ids.length
            ? new Set(req.body.student_ids.map(String))
            : null;
        const targets = result.alerts.filter(a => !allowed || allowed.has(String(a.student_id)));

        let notified = 0;
        for (const alert of targets.slice(0, 200)) {
            const content = `Your attendance in ${alert.course} is ${alert.percentage}%, below the ${alert.threshold}% requirement. Please speak to your trainer.`;
            await notificationService.notifyStudent(
                alert.student_id,
                'Attendance alert',
                content,
                'warning'
            );
            notified += 1;
        }

        return res.json({ notified, threshold: result.threshold, total_at_risk: result.alerts.length });
    } catch (error) {
        console.error('Notify attendance alerts error:', error);
        return res.status(error.status || 500).json({ error: error.status ? error.message : 'Failed to send attendance alerts' });
    }
}

/**
 * GET /attendance/summary
 * Returns per-student attendance totals grouped by week, month, and overall.
 * Restricted to admin / superadmin.
 * Query params: ?course=Cosmetology&student_id=/2026/028
 */
export async function getAttendanceSummary(req, res) {
    try {
        const { course, student_id, academic_period_id } = req.query;
        const { role, email } = req.user;
        const mongo = await isMongo();
        const period = academic_period_id ? await getPeriodRange(academic_period_id) : null;

        let allStudents = [];
        let records = [];

        // ── Resolve teacher's allowed courses ────────────────────────────────
        let teacherAllowedCourses = null; // null = no restriction (admin/superadmin)
        if (role === 'teacher') {
            const userEmail = String(email || '').toLowerCase().trim();
            if (mongo) {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                const fac = await Faculty.findOne({ email: { $regex: new RegExp(`^${userEmail}$`, 'i') } });
                if (fac) {
                    const matched = await Course.find({
                        $or: [
                            { instructor: { $regex: new RegExp(`^${fac.name}$`, 'i') } },
                            { name: { $in: parseFacultyCourses(fac.courses) } }
                        ]
                    }).select('name');
                    teacherAllowedCourses = matched.map(c => c.name);
                } else {
                    teacherAllowedCourses = [];
                }
            } else {
                const fac = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [userEmail]);
                if (fac) {
                    const list = parseFacultyCourses(fac.courses);
                    const inst = await query('SELECT name FROM courses WHERE LOWER(instructor) = LOWER(?)', [fac.name]);
                    teacherAllowedCourses = [...new Set([...list, ...inst.map(c => c.name)])];
                } else {
                    teacherAllowedCourses = [];
                }
            }

            // If teacher requests a specific course, verify they own it
            if (course && teacherAllowedCourses.length > 0) {
                const target = course.toLowerCase().trim();
                const owned = teacherAllowedCourses.find(tc => tc.toLowerCase().trim() === target);
                if (!owned) return res.json([]); // Not their course
            }
        }

        if (mongo) {
            const Student = (await import('../models/mongo/Student.js')).default;
            const Attendance = (await import('../models/mongo/Attendance.js')).default;

            let studentMongoQuery = {};
            if (student_id) {
                studentMongoQuery.id = String(student_id);
            } else if (course) {
                studentMongoQuery.course = { $regex: new RegExp(course.trim(), 'i') };
            } else if (teacherAllowedCourses !== null && teacherAllowedCourses.length > 0) {
                studentMongoQuery.course = { $in: teacherAllowedCourses.map(c => new RegExp(c, 'i')) };
            }
            allStudents = await Student.find(studentMongoQuery);

            let mongoQuery = {};
            if (course) {
                mongoQuery.course = { $regex: new RegExp(course.trim(), 'i') };
            } else if (teacherAllowedCourses !== null && teacherAllowedCourses.length > 0) {
                mongoQuery.course = { $in: teacherAllowedCourses };
            }
            if (student_id) mongoQuery.student_id = String(student_id);
            if (period?.start_date && period?.end_date) {
                mongoQuery.date = { $gte: period.start_date, $lte: period.end_date };
            }
            records = await Attendance.find(mongoQuery).sort({ date: 1 });

            // Enrich records with student names
            const sids = [...new Set(records.map(r => r.student_id))];
            const studentsList = await Student.find({ id: { $in: sids } });
            const nameMap = {};
            studentsList.forEach(s => { nameMap[s.id] = s.name; });
            records = records.map(r => ({ ...r.toObject(), student_name: nameMap[r.student_id] || '' }));
        } else {
            // SQL path (SQLite / PostgreSQL)
            let studentConditions = [];
            let studentParams = [];

            if (student_id) {
                studentConditions.push('LOWER(TRIM(id)) = LOWER(TRIM(?))');
                studentParams.push(student_id);
            } else if (course) {
                studentConditions.push('LOWER(course) LIKE LOWER(?)');
                studentParams.push(`%${course.trim()}%`);
            } else if (teacherAllowedCourses !== null && teacherAllowedCourses.length > 0) {
                // Filter students to teacher's courses only
                const placeholders = teacherAllowedCourses.map(() => 'LOWER(course) LIKE LOWER(?)').join(' OR ');
                studentConditions.push(`(${placeholders})`);
                teacherAllowedCourses.forEach(tc => studentParams.push(`%${tc}%`));
            } else if (teacherAllowedCourses !== null && teacherAllowedCourses.length === 0) {
                return res.json([]); // Teacher has no courses assigned
            }

            let studentQuery = 'SELECT id, name, course FROM students';
            if (studentConditions.length > 0) {
                studentQuery += ' WHERE ' + studentConditions.join(' AND ');
            }
            allStudents = await query(studentQuery, studentParams);

            const conditions = [];
            const params = [];
            if (course) {
                conditions.push('LOWER(a.course) LIKE LOWER(?)');
                params.push(`%${course.trim()}%`);
            } else if (teacherAllowedCourses !== null && teacherAllowedCourses.length > 0) {
                const placeholders = teacherAllowedCourses.map(() => '?').join(',');
                conditions.push(`a.course IN (${placeholders})`);
                params.push(...teacherAllowedCourses);
            }
            if (student_id) {
                conditions.push('LOWER(TRIM(a.student_id)) = LOWER(TRIM(?))');
                params.push(student_id);
            }
            if (period?.start_date && period?.end_date) {
                conditions.push('a.date >= ? AND a.date <= ?');
                params.push(period.start_date, period.end_date);
            }

            const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
            records = await query(`
                SELECT a.student_id, a.course, a.date, a.status, s.name as student_name
                FROM attendance a
                LEFT JOIN students s ON LOWER(TRIM(a.student_id)) = LOWER(TRIM(s.id))
                ${where}
                ORDER BY a.date ASC
            `, params);
        }

        // ── Aggregate records per student+course ─────────────────────────────
        const buckets = {};

        // Pre-populate with all matching students so they appear in list even with 0 attendance
        for (const student of allStudents) {
            const sid = String(student.id || '').trim();
            if (!sid) continue;

            const studentCourses = parseCoursesField(student.course);

            if (studentCourses.length === 0) {
                studentCourses = ['Unassigned'];
            }

            for (let courseName of studentCourses) {
                courseName = courseName.trim();
                // If course filter is applied, only initialize buckets for the matching course
                if (course && !courseName.toLowerCase().includes(course.toLowerCase().trim())) {
                    continue;
                }
                const key = `${sid}||${courseName}`;
                buckets[key] = {
                    student_id: sid,
                    student_name: student.name || sid,
                    course: courseName,
                    weekly: {},
                    monthly: {},
                    overall: emptyCounts()
                };
            }
        }

        // Process all actual attendance records
        for (const record of records) {
            const sid = String(record.student_id || '').trim();
            const courseName = String(record.course || '').trim();
            
            const rawDate = dateOnly(record.date);

            const status = String(record.status || '').toLowerCase();
            if (!sid || !rawDate) continue;

            const d = new Date(rawDate);
            if (isNaN(d.getTime())) continue;

            const key = `${sid}||${courseName}`;
            
            // If the student / course combination is not in the buckets, dynamically initialize it
            if (!buckets[key]) {
                buckets[key] = {
                    student_id: sid,
                    student_name: record.student_name || sid,
                    course: courseName,
                    weekly: {},
                    monthly: {},
                    overall: emptyCounts()
                };
            }

            // ISO week (Mon–Sun): find the Thursday of the week
            const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay();
            const thursday = new Date(d);
            thursday.setDate(d.getDate() + (4 - dayOfWeek));
            const jan1 = new Date(thursday.getFullYear(), 0, 1);
            const weekNum = Math.ceil(((thursday - jan1) / 86400000 + 1) / 7);
            const weekKey = `${thursday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

            const entry = buckets[key];
            if (!entry.weekly[weekKey])  entry.weekly[weekKey]  = { week: weekKey, ...emptyCounts() };
            if (!entry.monthly[monthKey]) entry.monthly[monthKey] = { month: monthKey, ...emptyCounts() };

            const inc = (b) => countStatus(b, status);
            inc(entry.weekly[weekKey]);
            inc(entry.monthly[monthKey]);
            inc(entry.overall);
        }

        // ── Flatten, sort, and attach rates ──────────────────────────────────
        const rate = (b) => ({ ...b, rate: attendanceRate(b) });

        const result = Object.values(buckets).map(e => ({
            student_id:   e.student_id,
            student_name: e.student_name,
            course:       e.course,
            weekly:  Object.values(e.weekly).sort((a, b) => a.week.localeCompare(b.week)).map(rate),
            monthly: Object.values(e.monthly).sort((a, b) => a.month.localeCompare(b.month)).map(rate),
            overall: rate(e.overall)
        }));

        result.sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''));
        res.json(result);

    } catch (error) {
        console.error('Attendance summary error:', error);
        res.status(500).json({ error: 'Failed to generate attendance summary' });
    }
}

export async function deleteAttendance(req, res) {
    try {
        const recordId = req.params.id;
        const { role, email } = req.user;

        if (await isMongo()) {
            const Attendance = (await import('../models/mongo/Attendance.js')).default;
            const record = await Attendance.findById(recordId);
            if (!record) return res.status(404).json({ error: 'Attendance record not found' });

            if (role === 'teacher') {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                const fac = await Faculty.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
                if (fac) {
                    const matched = await Course.find({
                        $or: [{ instructor: { $regex: new RegExp(`^${fac.name}$`, 'i') } }, { name: { $in: fac.courses || [] } }]
                    }).select('name');
                    const teacherCourses = matched.map(c => c.name);
                    if (!teacherCourses.some(tc => tc.toLowerCase().trim() === record.course.toLowerCase().trim())) {
                        return res.status(403).json({ error: 'Forbidden: You can only delete attendance for your own courses' });
                    }
                }
            }

            await Attendance.findByIdAndDelete(recordId);
            return res.json({ message: 'Attendance record deleted' });
        }

        const record = await queryOne('SELECT * FROM attendance WHERE id = ?', [recordId]);
        if (!record) return res.status(404).json({ error: 'Attendance record not found' });

        if (role === 'teacher') {
            const fac = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [email.toLowerCase().trim()]);
            if (fac) {
                const list = parseFacultyCourses(fac.courses);
                const inst = await query('SELECT name FROM courses WHERE LOWER(instructor) = LOWER(?)', [fac.name]);
                const teacherCourses = [...new Set([...list, ...inst.map(c => c.name)])];
                if (!teacherCourses.some(tc => tc.toLowerCase().trim() === record.course.toLowerCase().trim())) {
                    return res.status(403).json({ error: 'Forbidden: You can only delete attendance for your own courses' });
                }
            }
        }

        const result = await run('DELETE FROM attendance WHERE id = ?', [recordId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Attendance record not found' });
        res.json({ message: 'Attendance record deleted' });
    } catch (error) {
        console.error('Delete attendance error:', error);
        res.status(500).json({ error: 'Failed to delete attendance' });
    }
}

/**
 * GET /attendance/monthly-summary
 * Returns per-student monthly attendance summaries with status labels.
 * Query params: ?month=2026-07&course=&student_id=&sort=highest_attendance
 * Role-based: students see own data, teachers see their courses, admins see all.
 */
export async function getMonthlyAttendanceSummary(req, res) {
    try {
        const { month, course, student_id, sort = 'student_name', academic_period_id } = req.query;
        const { role, email } = req.user;
        const mongo = await isMongo();

        // Determine the target month (default: current month)
        const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const [year, mon] = targetMonth.split('-').map(Number);

        // Build month date range
        const monthStart = `${targetMonth}-01`;
        const lastDay = new Date(year, mon, 0).getDate();
        const monthEnd = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;

        // An explicitly selected academic period overrides the calendar month.
        const period = academic_period_id ? await getPeriodRange(academic_period_id) : null;
        if (academic_period_id && !period) return res.status(404).json({ error: 'Academic period not found' });
        const rangeStart = period?.start_date || monthStart;
        const rangeEnd = period?.end_date || monthEnd;

        // Read configurable grade bands from system_settings
        const config = await getAttendanceConfig();
        const getStatus = (pct) => attendanceBand(pct, config.thresholds);

        // ── Resolve teacher courses ─────────────────────────────────────────
        let teacherAllowedCourses = null;
        if (role === 'teacher') {
            const userEmail = String(email || '').toLowerCase().trim();
            if (mongo) {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                const fac = await Faculty.findOne({ email: { $regex: new RegExp(`^${userEmail}$`, 'i') } });
                if (fac) {
                    const matched = await Course.find({
                        $or: [
                            { instructor: { $regex: new RegExp(`^${fac.name}$`, 'i') } },
                            { name: { $in: parseFacultyCourses(fac.courses) } }
                        ]
                    }).select('name');
                    teacherAllowedCourses = matched.map(c => c.name);
                } else {
                    teacherAllowedCourses = [];
                }
            } else {
                const fac = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [userEmail]);
                if (fac) {
                    const list = parseFacultyCourses(fac.courses);
                    const inst = await query('SELECT name FROM courses WHERE LOWER(instructor) = LOWER(?)', [fac.name]);
                    teacherAllowedCourses = [...new Set([...list, ...inst.map(c => c.name)])];
                } else {
                    teacherAllowedCourses = [];
                }
            }
            if (teacherAllowedCourses.length === 0) return res.json([]);
        }

        // ── Student role: restrict to own data ──────────────────────────────
        const effectiveStudentId = role === 'student'
            ? String(req.user.student_id || req.user.id || student_id || '').trim()
            : student_id;

        // ── Fetch records ───────────────────────────────────────────────────
        let records = [];
        let allStudents = [];

        if (mongo) {
            const Student = (await import('../models/mongo/Student.js')).default;
            const Attendance = (await import('../models/mongo/Attendance.js')).default;

            let studentQ = {};
            if (effectiveStudentId) studentQ.id = effectiveStudentId;
            else if (course) studentQ.course = { $regex: new RegExp(course.trim(), 'i') };
            else if (teacherAllowedCourses) studentQ.course = { $in: teacherAllowedCourses.map(c => new RegExp(c, 'i')) };
            allStudents = await Student.find(studentQ).lean();

            const attQ = { date: { $gte: new Date(rangeStart), $lte: new Date(rangeEnd) } };
            if (effectiveStudentId) attQ.student_id = effectiveStudentId;
            if (course) attQ.course = { $regex: new RegExp(course.trim(), 'i') };
            else if (teacherAllowedCourses) attQ.course = { $in: teacherAllowedCourses };
            records = await Attendance.find(attQ).lean();
        } else {
            // SQL path
            let studentConds = [], studentParams = [];
            if (effectiveStudentId) {
                studentConds.push('LOWER(TRIM(id)) = LOWER(TRIM(?))');
                studentParams.push(effectiveStudentId);
            } else if (course) {
                studentConds.push('LOWER(course) LIKE LOWER(?)');
                studentParams.push(`%${course.trim()}%`);
            } else if (teacherAllowedCourses) {
                const ph = teacherAllowedCourses.map(() => 'LOWER(course) LIKE LOWER(?)').join(' OR ');
                studentConds.push(`(${ph})`);
                teacherAllowedCourses.forEach(tc => studentParams.push(`%${tc}%`));
            }
            allStudents = await query(
                `SELECT id, name, course FROM students${studentConds.length ? ' WHERE ' + studentConds.join(' AND ') : ''}`,
                studentParams
            );

            let attConds = [`a.date >= ? AND a.date <= ?`];
            let attParams = [rangeStart, rangeEnd];
            if (effectiveStudentId) { attConds.push('LOWER(TRIM(a.student_id)) = LOWER(TRIM(?))'); attParams.push(effectiveStudentId); }
            if (course) { attConds.push('LOWER(a.course) LIKE LOWER(?)'); attParams.push(`%${course.trim()}%`); }
            else if (teacherAllowedCourses) {
                const ph = teacherAllowedCourses.map(() => '?').join(',');
                attConds.push(`a.course IN (${ph})`);
                attParams.push(...teacherAllowedCourses);
            }

            records = await query(
                `SELECT a.student_id, a.course, a.date, a.status, s.name as student_name
                 FROM attendance a
                 LEFT JOIN students s ON LOWER(TRIM(a.student_id)) = LOWER(TRIM(s.id))
                 WHERE ${attConds.join(' AND ')}`,
                attParams
            );
        }

        // ── Aggregate per student + course ──────────────────────────────────
        const buckets = {};

        for (const student of allStudents) {
            const sid = String(student.id || '').trim();
            if (!sid) continue;
            let courses_list = [];
            if (student.course) {
                const raw = typeof student.course === 'string' ? student.course : JSON.stringify(student.course);
                if (raw.startsWith('[')) {
                    try { courses_list = JSON.parse(raw); } catch { courses_list = [raw]; }
                } else {
                    courses_list = raw.split(',').map(c => c.trim()).filter(Boolean);
                }
            }
            if (courses_list.length === 0) courses_list = ['Unassigned'];
            for (let cn of courses_list) {
                cn = cn.trim();
                if (course && !cn.toLowerCase().includes(course.toLowerCase().trim())) continue;
                const key = `${sid}||${cn}`;
                buckets[key] = {
                    student_id: sid, student_name: student.name || sid,
                    course: cn, month: targetMonth,
                    ...emptyCounts()
                };
            }
        }

        for (const rec of records) {
            const sid = String(rec.student_id || '').trim();
            const cn = String(rec.course || '').trim();
            if (!sid || !cn) continue;
            const key = `${sid}||${cn}`;
            if (!buckets[key]) {
                buckets[key] = {
                    student_id: sid, student_name: rec.student_name || sid,
                    course: cn, month: targetMonth,
                    ...emptyCounts()
                };
            }
            countStatus(buckets[key], rec.status);
        }

        // ── Build result with percentage + status ───────────────────────────
        let result = Object.values(buckets).map(b => {
            const pct = attendanceRate(b);
            return {
                ...b,
                percentage: pct,
                status: getStatus(pct),
                below_threshold: pct < config.threshold,
                thresholds: { ...config.thresholds, requirement: config.threshold },
                period: period ? { id: period.id, name: period.name } : null
            };
        });

        // ── Sort ─────────────────────────────────────────────────────────────
        const sortFns = {
            highest_attendance: (a, b) => b.percentage - a.percentage,
            lowest_attendance:  (a, b) => a.percentage - b.percentage,
            most_absent:        (a, b) => b.absent - a.absent,
            most_late:          (a, b) => b.late - a.late,
            student_name:       (a, b) => (a.student_name || '').localeCompare(b.student_name || ''),
        };
        result.sort(sortFns[sort] || sortFns.student_name);

        res.json(result);
    } catch (error) {
        console.error('Monthly attendance summary error:', error);
        res.status(500).json({ error: 'Failed to generate monthly attendance summary' });
    }
}
