import { getDb, query, queryOne, run } from '../config/database.js';

const isMongo = async () => !!process.env.MONGODB_URI;

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
            const userEmail = String(email || '').toLowerCase().trim();
            if (mongo) {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                const Attendance = (await import('../models/mongo/Attendance.js')).default;
                // FIX: Case-insensitive email lookup
                const emailRegex = new RegExp(`^${userEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
                const faculty = await Faculty.findOne({ email: { $regex: emailRegex } });
                if (!faculty) return res.json([]);

                const facultyName = faculty.name;
                const facultyCourses = Array.isArray(faculty.courses) ? faculty.courses : [];

                const matchedCourses = await Course.find({
                    $or: [
                        { instructor: { $regex: new RegExp(`^${facultyName}$`, 'i') } },
                        { name: { $in: facultyCourses } }
                    ]
                }).select('name');
                const courseNames = matchedCourses.map(c => c.name);

                const attendance = await Attendance.find({ course: { $in: courseNames } }).sort({ date: -1 });
                return res.json(attendance);
            }

            const faculty = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [userEmail]);
            if (!faculty) return res.json([]);

            let coursesList = [];
            try {
                if (faculty.courses && String(faculty.courses).startsWith('[')) {
                    coursesList = JSON.parse(faculty.courses);
                } else if (faculty.courses) {
                    coursesList = faculty.courses.split(',').map(s => s.trim());
                }
            } catch (e) { }

            const instructorCourses = await query('SELECT name FROM courses WHERE LOWER(instructor) = LOWER(?)', [faculty.name]);
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
            const tokenStudentId = student_id;
            const userEmail = String(email || '').toLowerCase().trim();

            if (mongo) {
                const Attendance = (await import('../models/mongo/Attendance.js')).default;
                const Student = (await import('../models/mongo/Student.js')).default;

                let searchId = tokenStudentId;
                if (!searchId) {
                    const sp = await Student.findOne({ email: userEmail });
                    if (!sp) return res.json([]);
                    searchId = sp.id;
                }

                const attendance = await Attendance.find({ student_id: String(searchId) }).sort({ date: -1 });
                return res.json(attendance);
            } else {
                let searchId = tokenStudentId;
                if (!searchId) {
                    const sp = await queryOne('SELECT id FROM students WHERE LOWER(email) = LOWER(?)', [userEmail]);
                    if (!sp) return res.json([]);
                    searchId = sp.id;
                }

                const attendance = await query('SELECT * FROM attendance WHERE student_id = ? ORDER BY date DESC', [String(searchId)]);
                return res.json(attendance);
            }
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

        if (!student_id || !course || !date || !status) {
            return res.status(400).json({ error: 'student_id, course, date, and status are required' });
        }

        // Security check for teachers
        if (req.user.role === 'teacher') {
            const userEmail = String(req.user.email || '').toLowerCase().trim();
            let allowedCourses = [];

            if (await isMongo()) {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                // FIX: Case-insensitive email lookup
                const emailRegex = new RegExp(`^${userEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
                const faculty = await Faculty.findOne({ email: { $regex: emailRegex } });
                if (!faculty) return res.status(403).json({ error: 'Access Denied: Trainer profile missing' });

                const facultyName = faculty.name;
                const facultyCourses = Array.isArray(faculty.courses) ? faculty.courses : [];

                const matchedCourses = await Course.find({
                    $or: [
                        { instructor: { $regex: new RegExp(`^${facultyName}$`, 'i') } },
                        { name: { $in: facultyCourses } }
                    ]
                }).select('name');
                allowedCourses = matchedCourses.map(c => c.name);
            } else {
                const faculty = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [userEmail]);
                if (!faculty) return res.status(403).json({ error: 'Access Denied: Trainer profile missing' });

                let coursesList = [];
                try {
                    if (faculty.courses && String(faculty.courses).startsWith('[')) {
                        coursesList = JSON.parse(faculty.courses);
                    } else if (faculty.courses) {
                        coursesList = faculty.courses.split(',').map(s => s.trim());
                    }
                } catch (e) { }

                const instructorCourses = await query('SELECT name FROM courses WHERE LOWER(instructor) = LOWER(?)', [faculty.name]);
                allowedCourses = [...new Set([...coursesList, ...instructorCourses.map(c => c.name)])];
            }

            if (!allowedCourses.some(ac => ac.toLowerCase().trim() === course.toLowerCase().trim())) {
                return res.status(403).json({ error: `Security Protocol: You are not authorized to mark attendance for "${course}"` });
            }
        }

        if (await isMongo()) {
            const Attendance = (await import('../models/mongo/Attendance.js')).default;
            // FIX: Upsert for MongoDB — prevent duplicate records
            const saved = await Attendance.findOneAndUpdate(
                { student_id, course, date },
                { $set: { status } },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
            return res.status(201).json(saved);
        }

        // FIX: INSERT OR REPLACE uses the UNIQUE(student_id, course, date) constraint
        // to overwrite existing records instead of creating duplicates
        const result = await run(
            'INSERT OR REPLACE INTO attendance (student_id, course, date, status) VALUES (?, ?, ?, ?)',
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
        const recordId = req.params.id;

        // Security check for teachers
        if (req.user.role === 'teacher') {
            const email = req.user.email;
            let recordCourse = null;

            if (await isMongo()) {
                const Attendance = (await import('../models/mongo/Attendance.js')).default;
                const rec = await Attendance.findById(recordId);
                recordCourse = rec?.course;
            } else {
                const rec = await queryOne('SELECT course FROM attendance WHERE id = ?', [recordId]);
                recordCourse = rec?.course;
            }

            if (!recordCourse) return res.status(404).json({ error: 'Attendance record not found' });

            let allowedCourses = [];
            if (await isMongo()) {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                // FIX: Case-insensitive email lookup
                const emailRegex = new RegExp(`^${String(email || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
                const faculty = await Faculty.findOne({ email: { $regex: emailRegex } });
                if (faculty) {
                    const facultyCourses = await Course.find({
                        $or: [{ instructor: { $regex: new RegExp(`^${faculty.name}$`, 'i') } }, { name: { $in: faculty.courses || [] } }]
                    }).select('name');
                    allowedCourses = facultyCourses.map(c => c.name);
                }
            } else {
                const faculty = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [email]);
                if (faculty) {
                    let coursesList = [];
                    try { coursesList = typeof faculty.courses === 'string' ? JSON.parse(faculty.courses || '[]') : (faculty.courses || []); } catch (e) { }
                    const instructorCourses = await query('SELECT name FROM courses WHERE LOWER(instructor) = LOWER(?)', [faculty.name]);
                    allowedCourses = [...new Set([...coursesList, ...instructorCourses.map(c => c.name)])];
                }
            }

            // FIX: Case-insensitive comparison (was exact match before)
            if (!allowedCourses.some(ac => ac.toLowerCase().trim() === recordCourse.toLowerCase().trim())) {
                return res.status(403).json({ error: 'Access Denied: You cannot modify records for this course.' });
            }
        }

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
