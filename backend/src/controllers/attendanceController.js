import { getDb, query, queryOne, run } from '../config/database.js';

const isMongo = async () => !!process.env.MONGODB_URI;

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
                        $or: [{ instructor: { $regex: new RegExp(`^${fac.name}$`, 'i') } }, { name: { $in: fac.courses || [] } }]
                    }).select('name');
                    teacherCourses = matched.map(c => c.name);
                }
            } else {
                const fac = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [userEmail]);
                if (fac) {
                    let list = [];
                    try { list = typeof fac.courses === 'string' ? JSON.parse(fac.courses || '[]') : (fac.courses || []); } catch (e) { }
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
                        $or: [{ instructor: { $regex: new RegExp(`^${fac.name}$`, 'i') } }, { name: { $in: fac.courses || [] } }]
                    }).select('name');
                    teacherCourses = matched.map(c => c.name);
                }
            } else {
                const fac = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [userEmail]);
                if (fac) {
                    let list = [];
                    try { list = typeof fac.courses === 'string' ? JSON.parse(fac.courses || '[]') : (fac.courses || []); } catch (e) { }
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
                let list = [];
                try { list = typeof fac.courses === 'string' ? JSON.parse(fac.courses || '[]') : (fac.courses || []); } catch (e) { }
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
