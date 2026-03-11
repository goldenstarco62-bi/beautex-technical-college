import { getDb, query, queryOne, run } from '../config/database.js';

const isMongo = async () => !!process.env.MONGODB_URI;

export const getAllDailyReports = async (req, res) => {
    try {
        const { student_id, course, date, trainer_email } = req.query;
        const { role, email } = req.user;

        if (await isMongo()) {
            const StudentDailyReport = (await import('../models/mongo/StudentDailyReport.js')).default;
            let mongoFilter = {};

            if (role === 'student') {
                mongoFilter.student_id = req.user.student_id || req.user.id;
            } else if (role === 'teacher') {
                // Teachers see reports for their assigned courses
                const Course = (await import('../models/mongo/Course.js')).default;
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const faculty = await Faculty.findOne({ email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });

                if (faculty) {
                    const facultyCourses = await Course.find({
                        $or: [
                            { instructor: { $regex: new RegExp(`^${faculty.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
                            { name: { $in: faculty.courses || [] } }
                        ],
                        status: 'Active'
                    }).select('name');
                    const courseNames = facultyCourses.map(c => c.name);
                    if (courseNames.length === 0) return res.json([]);

                    const courseRegexes = courseNames.map(n => new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
                    mongoFilter.course = { $in: courseRegexes };
                } else {
                    return res.json([]);
                }
            } else if (student_id) {
                mongoFilter.student_id = student_id;
            }

            if (course) mongoFilter.course = course;
            if (date) {
                const searchDate = new Date(date);
                searchDate.setHours(0, 0, 0, 0);
                const nextDate = new Date(searchDate);
                nextDate.setDate(searchDate.getDate() + 1);
                mongoFilter.report_date = { $gte: searchDate, $lt: nextDate };
            }
            if (trainer_email) mongoFilter.trainer_email = trainer_email;

            const reports = await StudentDailyReport.find(mongoFilter).sort({ report_date: -1 });
            return res.json(reports);
        }

        let sql = `
            SELECT 
                r.*, 
                s.photo as student_photo,
                f.photo as trainer_photo
            FROM student_daily_reports r
            LEFT JOIN students s ON r.student_id = s.id
            LEFT JOIN faculty f ON LOWER(r.trainer_email) = LOWER(f.email)
        `;
        let params = [];
        let conditions = [];

        if (role === 'student') {
            conditions.push('r.student_id = ?');
            params.push(req.user.student_id || req.user.id);
        } else if (role === 'teacher') {
            const faculty = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [email]);
            if (faculty) {
                let coursesList = [];
                try {
                    coursesList = typeof faculty.courses === 'string' ? JSON.parse(faculty.courses || '[]') : (faculty.courses || []);
                } catch (e) { }
                const instructorCourses = await query('SELECT name FROM courses WHERE LOWER(instructor) = LOWER(?)', [faculty.name]);
                const allTutorCourses = [...new Set([...coursesList.map(c => String(c).toLowerCase().trim()), ...instructorCourses.map(c => String(c.name).toLowerCase().trim())])];

                if (allTutorCourses.length > 0) {
                    const placeholders = allTutorCourses.map(() => 'LOWER(r.course) = ?').join(' OR ');
                    conditions.push(`(${placeholders})`);
                    params.push(...allTutorCourses);
                } else {
                    return res.json([]);
                }
            } else {
                return res.json([]);
            }
        } else if (student_id) {
            conditions.push('r.student_id = ?');
            params.push(student_id);
        }

        if (course) {
            conditions.push('LOWER(r.course) = ?');
            params.push(String(course).toLowerCase().trim());
        }
        if (date) {
            conditions.push('r.report_date = ?');
            params.push(date);
        }
        if (trainer_email) {
            conditions.push('r.trainer_email = ?');
            params.push(trainer_email);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' ORDER BY r.report_date DESC';

        const reports = await query(sql, params);

        // FIX: Clean up Postgres array format if present (e.g., {"Computer Packages"} -> Computer Packages)
        const cleanedReports = reports.map(r => ({
            ...r,
            course: typeof r.course === 'string' && r.course.startsWith('{') && r.course.endsWith('}')
                ? r.course.slice(1, -1).replace(/"/g, '')
                : r.course
        }));

        res.json(cleanedReports);
    } catch (error) {
        console.error('Error fetching student daily reports:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createDailyReport = async (req, res) => {
    let { student_id, student_name, course, report_date, topics_covered, trainer_remarks } = req.body;
    const trainer_name = req.user.name || 'Trainer';
    const trainer_email = req.user.email;

    // FIX: If course is passed as an array (common in this app), take the first item or join them.
    if (Array.isArray(course)) {
        course = course.length > 0 ? course[0] : 'General';
    } else if (typeof course === 'string' && course.startsWith('[') && course.endsWith(']')) {
        try {
            const parsed = JSON.parse(course);
            course = Array.isArray(parsed) ? (parsed[0] || 'General') : parsed;
        } catch (e) { }
    }

    if (!student_id || !course || !report_date) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        if (await isMongo()) {
            const StudentDailyReport = (await import('../models/mongo/StudentDailyReport.js')).default;

            // Upsert model: update if exists for that student on that day
            const searchDate = new Date(report_date);
            searchDate.setHours(0, 0, 0, 0);
            const nextDate = new Date(searchDate);
            nextDate.setDate(searchDate.getDate() + 1);

            const report = await StudentDailyReport.findOneAndUpdate(
                { student_id, report_date: { $gte: searchDate, $lt: nextDate } },
                {
                    student_name, course, report_date, topics_covered, trainer_remarks,
                    trainer_name, trainer_email
                },
                { upsert: true, new: true }
            );
            return res.status(201).json(report);
        }

        const existing = await queryOne('SELECT id FROM student_daily_reports WHERE student_id = ? AND report_date = ? AND course = ?', [student_id, report_date, course]);

        if (existing) {
            await run(
                'UPDATE student_daily_reports SET topics_covered = ?, trainer_remarks = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [topics_covered, trainer_remarks, existing.id]
            );
            const updated = await queryOne('SELECT * FROM student_daily_reports WHERE id = ?', [existing.id]);
            return res.status(200).json(updated);
        } else {
            const result = await run(
                `INSERT INTO student_daily_reports (
                    student_id, student_name, course, report_date, topics_covered, trainer_remarks, trainer_name, trainer_email
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [student_id, student_name, course, report_date, topics_covered, trainer_remarks, trainer_name, trainer_email]
            );
            const report = await queryOne('SELECT * FROM student_daily_reports WHERE id = ?', [result.lastID]);
            res.status(201).json(report);
        }
    } catch (error) {
        console.error('Error creating student daily report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const addStudentComment = async (req, res) => {
    const { id } = req.params;
    const { lesson_taught, student_comment } = req.body;

    if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'Only students can leave a comment on their daily report.' });
    }

    try {
        if (await isMongo()) {
            const StudentDailyReport = (await import('../models/mongo/StudentDailyReport.js')).default;
            const report = await StudentDailyReport.findById(id);
            if (!report) return res.status(404).json({ error: 'Report not found' });

            const studentId = String(req.user.student_id || req.user.id || '');
            if (String(report.student_id) !== studentId) {
                return res.status(403).json({ error: 'You can only comment on your own reports.' });
            }

            report.lesson_taught = lesson_taught;
            report.student_comment = student_comment || null;
            report.student_commented_at = new Date();
            await report.save();
            return res.json(report);
        }

        // SQL path
        const report = await queryOne('SELECT * FROM student_daily_reports WHERE id = ?', [id]);
        if (!report) return res.status(404).json({ error: 'Report not found' });

        const studentId = String(req.user.student_id || req.user.id || '');
        if (String(report.student_id) !== studentId) {
            return res.status(403).json({ error: 'You can only comment on your own reports.' });
        }

        await run(
            'UPDATE student_daily_reports SET lesson_taught = ?, student_comment = ?, student_commented_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [lesson_taught === true ? 1 : lesson_taught === false ? 0 : null, student_comment || null, id]
        );
        const updated = await queryOne('SELECT * FROM student_daily_reports WHERE id = ?', [id]);
        return res.json(updated);
    } catch (error) {
        console.error('Error saving student comment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteDailyReport = async (req, res) => {
    const { id } = req.params;
    try {
        if (await isMongo()) {
            const StudentDailyReport = (await import('../models/mongo/StudentDailyReport.js')).default;
            const report = await StudentDailyReport.findById(id);
            if (!report) return res.status(404).json({ error: 'Report not found' });

            if (req.user.role === 'teacher' && String(report.trainer_email || '').toLowerCase().trim() !== String(req.user.email || '').toLowerCase().trim()) {
                return res.status(403).json({ error: 'Forbidden: You can only delete your own reports' });
            }

            await StudentDailyReport.findByIdAndDelete(id);
            return res.json({ message: 'Report deleted successfully' });
        }

        const report = await queryOne('SELECT * FROM student_daily_reports WHERE id = ?', [id]);
        if (!report) return res.status(404).json({ error: 'Report not found' });

        if (req.user.role === 'teacher' && String(report.trainer_email || '').toLowerCase().trim() !== String(req.user.email || '').toLowerCase().trim()) {
            return res.status(403).json({ error: 'Forbidden: You can only delete your own reports' });
        }

        await run('DELETE FROM student_daily_reports WHERE id = ?', [id]);
        res.json({ message: 'Report deleted successfully' });
    } catch (error) {
        console.error('Error deleting student daily report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
