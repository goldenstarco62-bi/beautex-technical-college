import { getDb, query, queryOne, run } from '../config/database.js';

async function isMongo() {
    const db = await getDb();
    return db.constructor.name === 'NativeConnection';
}

export async function getAllAttendance(req, res) {
    try {
        const { role, email, student_id } = req.user;
        const mongo = await isMongo();

        // Admin and Superadmin see everything
        if (role === 'admin' || role === 'superadmin') {
            if (mongo) {
                const Attendance = (await import('../models/mongo/Attendance.js')).default;
                const attendance = await Attendance.find().sort({ date: -1 });
                return res.json(attendance);
            }
            const attendance = await query('SELECT * FROM attendance ORDER BY date DESC LIMIT 1000');
            return res.json(attendance);
        }

        // Teachers see attendance for their courses
        if (role === 'teacher') {
            if (mongo) {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                const Attendance = (await import('../models/mongo/Attendance.js')).default;
                const faculty = await Faculty.findOne({ email });
                if (!faculty) return res.json([]);

                const facultyCourses = await Course.find({
                    $or: [{ instructor: faculty.name }, { name: { $in: faculty.courses || [] } }]
                }).select('name');
                const courseNames = facultyCourses.map(c => c.name);

                const attendance = await Attendance.find({ course: { $in: courseNames } }).sort({ date: -1 });
                return res.json(attendance);
            }

            const faculty = await queryOne('SELECT name, courses FROM faculty WHERE email = ?', [email]);
            if (!faculty) return res.json([]);

            let coursesList = [];
            try {
                coursesList = typeof faculty.courses === 'string' ? JSON.parse(faculty.courses || '[]') : (faculty.courses || []);
            } catch (e) { }

            const instructorCourses = await query('SELECT name FROM courses WHERE instructor = ?', [faculty.name]);
            const allTutorCourses = [...new Set([...coursesList, ...instructorCourses.map(c => c.name)])];

            if (allTutorCourses.length === 0) return res.json([]);

            const placeholders = allTutorCourses.map(() => '?').join(',');
            const attendance = await query(`
                SELECT * FROM attendance 
                WHERE course IN (${placeholders})
                ORDER BY date DESC
            `, allTutorCourses);
            return res.json(attendance);
        }

        // Students see only their own attendance records
        if (role === 'student') {
            const sId = student_id || req.query.student_id;
            if (!sId) {
                // If student_id is not in token, try finding it by email
                if (mongo) {
                    const Student = (await import('../models/mongo/Student.js')).default;
                    const sp = await Student.findOne({ email });
                    if (!sp) return res.json([]);
                    const Attendance = (await import('../models/mongo/Attendance.js')).default;
                    const attendance = await Attendance.find({ student_id: sp.id }).sort({ date: -1 });
                    return res.json(attendance);
                }
                const sp = await queryOne('SELECT id FROM students WHERE email = ?', [email]);
                if (!sp) return res.json([]);
                const attendance = await query('SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC', [sp.id]);
                return res.json(attendance);
            }

            if (mongo) {
                const Attendance = (await import('../models/mongo/Attendance.js')).default;
                const attendance = await Attendance.find({ student_id: String(sId) }).sort({ date: -1 });
                return res.json(attendance);
            }
            const attendance = await query('SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC', [String(sId)]);
            return res.json(attendance);
        }

        res.json([]);
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
}

export async function markAttendance(req, res) {
    try {
        const { student_id, course, date, status } = req.body;

        if (await isMongo()) {
            const Attendance = (await import('../models/mongo/Attendance.js')).default;
            const newAttendance = new Attendance({ student_id, course, date, status });
            const saved = await newAttendance.save();
            return res.status(201).json(saved);
        }

        const result = await run(
            'INSERT INTO attendance (student_id, course, date, status) VALUES (?, ?, ?, ?)',
            [student_id, course, date, status]
        );
        const attendance = await queryOne('SELECT * FROM attendance WHERE id = ?', [result.lastID]);
        res.status(201).json(attendance);
    } catch (error) {
        console.error('Mark attendance error:', error);
        res.status(500).json({ error: 'Failed to mark attendance' });
    }
}

export async function updateAttendance(req, res) {
    try {
        if (await isMongo()) {
            const Attendance = (await import('../models/mongo/Attendance.js')).default;
            const updated = await Attendance.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
            if (!updated) return res.status(404).json({ error: 'Attendance record not found' });
            return res.json(updated);
        }

        const { status } = req.body;
        await run('UPDATE attendance SET status = ? WHERE id = ?', [status, req.params.id]);
        const attendance = await queryOne('SELECT * FROM attendance WHERE id = ?', [req.params.id]);
        if (!attendance) return res.status(404).json({ error: 'Attendance record not found' });
        res.json(attendance);
    } catch (error) {
        console.error('Update attendance error:', error);
        res.status(500).json({ error: 'Failed to update attendance' });
    }
}
