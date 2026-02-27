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
        res.json(attendance);
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
}

export async function markAttendance(req, res) {
    try {
        const { student_id, course, date, status } = req.body;
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

        if (await isMongo()) {
            const Attendance = (await import('../models/mongo/Attendance.js')).default;
            const doc = await Attendance.findOneAndUpdate(
                { student_id, course, date },
                { status, updated_at: new Date() },
                { upsert: true, new: true }
            );
            return res.status(201).json(doc);
        }

        // CROSS-DB Upsert Logic (Postgres/SQLite)
        const existing = await queryOne('SELECT id FROM attendance WHERE student_id = ? AND course = ? AND date = ?', [student_id, course, date]);

        if (existing) {
            await run('UPDATE attendance SET status = ? WHERE id = ?', [status, existing.id]);
            const updated = await queryOne('SELECT * FROM attendance WHERE id = ?', [existing.id]);
            return res.json(updated);
        } else {
            const result = await run(
                'INSERT INTO attendance (student_id, course, date, status) VALUES (?, ?, ?, ?)',
                [student_id, course, date, status]
            );
            const attendance = await queryOne('SELECT * FROM attendance WHERE id = ?', [result.lastID]);
            res.status(201).json(attendance);
        }
    } catch (error) {
        console.error('Mark attendance error:', error);
        res.status(500).json({ error: 'Failed to mark attendance' });
    }
}

export async function updateAttendance(req, res) {
    try {
        const recordId = req.params.id;
        const { status } = req.body;

        if (await isMongo()) {
            const Attendance = (await import('../models/mongo/Attendance.js')).default;
            const updated = await Attendance.findByIdAndUpdate(recordId, { status }, { new: true });
            if (!updated) return res.status(404).json({ error: 'Attendance record not found' });
            return res.json(updated);
        }

        await run('UPDATE attendance SET status = ? WHERE id = ?', [status, recordId]);
        const attendance = await queryOne('SELECT * FROM attendance WHERE id = ?', [recordId]);
        if (!attendance) return res.status(404).json({ error: 'Attendance record not found' });
        res.json(attendance);
    } catch (error) {
        console.error('Update attendance error:', error);
        res.status(500).json({ error: 'Failed to update attendance' });
    }
}

export async function deleteAttendance(req, res) {
    try {
        const recordId = req.params.id;

        if (await isMongo()) {
            const Attendance = (await import('../models/mongo/Attendance.js')).default;
            const deleted = await Attendance.findByIdAndDelete(recordId);
            if (!deleted) return res.status(404).json({ error: 'Attendance record not found' });
            return res.json({ message: 'Attendance record deleted' });
        }

        const result = await run('DELETE FROM attendance WHERE id = ?', [recordId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Attendance record not found' });
        res.json({ message: 'Attendance record deleted' });
    } catch (error) {
        console.error('Delete attendance error:', error);
        res.status(500).json({ error: 'Failed to delete attendance' });
    }
}
