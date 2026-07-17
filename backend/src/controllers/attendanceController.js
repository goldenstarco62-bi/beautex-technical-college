import { getDb, query, queryOne, run } from '../config/database.js';
import { parseCoursesField } from '../utils/courseParser.js';

const isMongo = async () => !!process.env.MONGODB_URI;

// Helper to parse faculty courses list robustly
function parseFacultyCourses(coursesField) {
    return parseCoursesField(coursesField);
}

export async function getAllAttendance(req, res) {
    try {
        const { role, email } = req.user;
        const { course, date, student_id } = req.query;
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
        const cleanedAttendance = attendance.map(a => ({
            ...a,
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

        // Validate status value
        const validStatuses = ['Present', 'Absent', 'Late'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
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
                { status, updated_at: new Date() },
                { upsert: true, new: true }
            );
        } else {
            const existing = await queryOne('SELECT id FROM attendance WHERE student_id = ? AND course = ? AND date = ?', [student_id, course, date]);
            if (existing) {
                await run('UPDATE attendance SET status = ? WHERE id = ?', [status, existing.id]);
                attendanceRecord = await queryOne('SELECT * FROM attendance WHERE id = ?', [existing.id]);
            } else {
                const result = await run(
                    'INSERT INTO attendance (student_id, course, date, status) VALUES (?, ?, ?, ?)',
                    [student_id, course, date, status]
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

        let updated;
        if (await isMongo()) {
            const Attendance = (await import('../models/mongo/Attendance.js')).default;
            updated = await Attendance.findByIdAndUpdate(recordId, { status }, { new: true });
        } else {
            await run('UPDATE attendance SET status = ? WHERE id = ?', [status, recordId]);
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
 * GET /attendance/summary
 * Returns per-student attendance totals grouped by week, month, and overall.
 * Restricted to admin / superadmin.
 * Query params: ?course=Cosmetology&student_id=/2026/028
 */
export async function getAttendanceSummary(req, res) {
    try {
        const { course, student_id } = req.query;
        const { role, email } = req.user;
        const mongo = await isMongo();

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
                    overall: { present: 0, absent: 0, late: 0, total: 0 }
                };
            }
        }

        // Process all actual attendance records
        for (const record of records) {
            const sid = String(record.student_id || '').trim();
            const courseName = String(record.course || '').trim();
            
            let rawDate = '';
            if (record.date) {
                if (record.date instanceof Date) {
                    rawDate = record.date.toISOString().split('T')[0];
                } else {
                    rawDate = String(record.date).split('T')[0];
                }
            }

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
                    overall: { present: 0, absent: 0, late: 0, total: 0 }
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
            if (!entry.weekly[weekKey])  entry.weekly[weekKey]  = { week: weekKey,   present: 0, absent: 0, late: 0, total: 0 };
            if (!entry.monthly[monthKey]) entry.monthly[monthKey] = { month: monthKey, present: 0, absent: 0, late: 0, total: 0 };

            const inc = (b) => {
                b.total++;
                if (status === 'present') b.present++;
                else if (status === 'absent') b.absent++;
                else if (status === 'late')   b.late++;
            };
            inc(entry.weekly[weekKey]);
            inc(entry.monthly[monthKey]);
            inc(entry.overall);
        }

        // ── Flatten, sort, and attach rates ──────────────────────────────────
        const rate = (b) => ({
            ...b,
            rate: b.total > 0 ? Math.round(((b.present + b.late) / b.total) * 100) : 0
        });

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
        const { month, course, student_id, sort = 'student_name' } = req.query;
        const { role, email } = req.user;
        const mongo = await isMongo();

        // Determine the target month (default: current month)
        const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const [year, mon] = targetMonth.split('-').map(Number);

        // Build month date range
        const monthStart = `${targetMonth}-01`;
        const lastDay = new Date(year, mon, 0).getDate();
        const monthEnd = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;

        // Read configurable thresholds from system_settings
        let threshExcellent = 95, threshGood = 85, threshFair = 75;
        if (!mongo) {
            const { query: dbQuery } = await import('../config/database.js');
            try {
                const threshRows = await dbQuery(
                    "SELECT key, value FROM system_settings WHERE key IN ('att_excellent','att_good','att_fair')"
                );
                threshRows.forEach(r => {
                    if (r.key === 'att_excellent') threshExcellent = parseFloat(r.value) || 95;
                    if (r.key === 'att_good') threshGood = parseFloat(r.value) || 85;
                    if (r.key === 'att_fair') threshFair = parseFloat(r.value) || 75;
                });
            } catch (_) { /* use defaults */ }
        }

        const getStatus = (pct) => {
            if (pct >= threshExcellent) return 'Excellent';
            if (pct >= threshGood) return 'Good';
            if (pct >= threshFair) return 'Fair';
            return 'Needs Improvement';
        };

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

            const attQ = { date: { $gte: new Date(monthStart), $lte: new Date(monthEnd) } };
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
            let attParams = [monthStart, monthEnd];
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
                    present: 0, absent: 0, late: 0, total: 0
                };
            }
        }

        for (const rec of records) {
            const sid = String(rec.student_id || '').trim();
            const cn = String(rec.course || '').trim();
            const status = String(rec.status || '').toLowerCase();
            if (!sid || !cn) continue;
            const key = `${sid}||${cn}`;
            if (!buckets[key]) {
                buckets[key] = {
                    student_id: sid, student_name: rec.student_name || sid,
                    course: cn, month: targetMonth,
                    present: 0, absent: 0, late: 0, total: 0
                };
            }
            buckets[key].total++;
            if (status === 'present') buckets[key].present++;
            else if (status === 'absent') buckets[key].absent++;
            else if (status === 'late') buckets[key].late++;
        }

        // ── Build result with percentage + status ───────────────────────────
        let result = Object.values(buckets).map(b => {
            const pct = b.total > 0
                ? Math.round(((b.present + b.late) / b.total) * 100 * 100) / 100
                : 0;
            return {
                ...b,
                percentage: pct,
                status: getStatus(pct),
                thresholds: { excellent: threshExcellent, good: threshGood, fair: threshFair }
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
