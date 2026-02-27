import { getDb, query, queryOne, run } from '../config/database.js';

const isMongo = async () => !!process.env.MONGODB_URI;

export const getAllDailyReports = async (req, res) => {
    try {
        const { student_id, course, date, trainer_email } = req.query;

        if (await isMongo()) {
            const StudentDailyReport = (await import('../models/mongo/StudentDailyReport.js')).default;
            let mongoFilter = {};

            if (req.user.role === 'student') {
                mongoFilter.student_id = req.user.student_id || req.user.id;
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

        let sql = 'SELECT * FROM student_daily_reports';
        let params = [];
        let conditions = [];

        if (req.user.role === 'student') {
            conditions.push('student_id = ?');
            params.push(req.user.student_id || req.user.id);
        } else if (student_id) {
            conditions.push('student_id = ?');
            params.push(student_id);
        }

        if (course) {
            conditions.push('course = ?');
            params.push(course);
        }
        if (date) {
            conditions.push('report_date = ?');
            params.push(date);
        }
        if (trainer_email) {
            conditions.push('trainer_email = ?');
            params.push(trainer_email);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' ORDER BY report_date DESC';

        const reports = await query(sql, params);
        res.json(reports);
    } catch (error) {
        console.error('Error fetching student daily reports:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createDailyReport = async (req, res) => {
    const { student_id, student_name, course, report_date, topics_covered, trainer_remarks } = req.body;
    const trainer_name = req.user.name || 'Trainer';
    const trainer_email = req.user.email;

    if (!student_id || !course || !report_date || !topics_covered) {
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

export const deleteDailyReport = async (req, res) => {
    const { id } = req.params;
    try {
        if (await isMongo()) {
            const StudentDailyReport = (await import('../models/mongo/StudentDailyReport.js')).default;
            await StudentDailyReport.findByIdAndDelete(id);
            return res.json({ message: 'Report deleted successfully' });
        }
        await run('DELETE FROM student_daily_reports WHERE id = ?', [id]);
        res.json({ message: 'Report deleted successfully' });
    } catch (error) {
        console.error('Error deleting student daily report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
