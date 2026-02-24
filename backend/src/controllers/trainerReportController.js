import { getDb, query, queryOne, run } from '../config/database.js';

const isMongo = async () => !!process.env.MONGODB_URI;

export const getAllReports = async (req, res) => {
    try {
        const { role, id } = req.user;
        const mongo = await isMongo();

        if (role === 'student') {
            return res.status(403).json({ error: 'Access Denied: Students are not authorized to view internal trainer reports.' });
        }

        if (mongo) {
            const TrainerReport = (await import('../models/mongo/TrainerReport.js')).default;
            let filter = {};
            if (role === 'teacher') {
                filter = { trainer_id: id };
            }
            const reports = await TrainerReport.find(filter).sort({ report_date: -1 });
            return res.json(reports);
        }

        let sql = 'SELECT * FROM trainer_reports ORDER BY report_date DESC';
        let params = [];
        if (role === 'teacher') {
            // FIX: Cast to string for comparison since SQLite id is INTEGER, JWT id may be string
            sql = 'SELECT * FROM trainer_reports WHERE CAST(trainer_id AS TEXT) = ? ORDER BY report_date DESC';
            params = [String(id)];
        }
        const reports = await query(sql, params);
        res.json(reports);
    } catch (error) {
        console.error('Error fetching trainer reports:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createReport = async (req, res) => {
    try {
        const { week_number, report_date, daily_report, record_of_work, course_id } = req.body;
        const { id, role } = req.user;

        if (!week_number || !report_date || !daily_report || !record_of_work) {
            return res.status(400).json({ error: 'Required fields missing: week_number, report_date, daily_report, record_of_work' });
        }

        let trainerName = 'Trainer';
        const mongo = await isMongo();

        if (mongo) {
            const User = (await import('../models/mongo/User.js')).default;
            const user = await User.findById(id);
            if (user) trainerName = user.name || user.email.split('@')[0];
        } else {
            const user = await queryOne('SELECT name, email FROM users WHERE id = ?', [id]);
            if (user) trainerName = user.name || user.email.split('@')[0];
        }

        if (mongo) {
            const TrainerReport = (await import('../models/mongo/TrainerReport.js')).default;
            const newReport = new TrainerReport({
                trainer_id: id,
                trainer_name: trainerName,
                week_number,
                report_date,
                daily_report,
                record_of_work,
                course_id,
                status: 'Submitted'
            });
            const saved = await newReport.save();
            return res.status(201).json(saved);
        }

        const result = await run(
            'INSERT INTO trainer_reports (trainer_id, trainer_name, week_number, report_date, daily_report, record_of_work, course_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [String(id), trainerName, week_number, report_date, daily_report, record_of_work, course_id, 'Submitted']
        );
        const report = await queryOne('SELECT * FROM trainer_reports WHERE id = ?', [result.lastID]);
        res.status(201).json(report);
    } catch (error) {
        console.error('Error creating trainer report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteReport = async (req, res) => {
    try {
        const { id } = req.params;
        const { id: userId, role } = req.user;
        const mongo = await isMongo();

        if (mongo) {
            const TrainerReport = (await import('../models/mongo/TrainerReport.js')).default;
            const report = await TrainerReport.findById(id);
            if (!report) return res.status(404).json({ error: 'Report not found' });

            if (role !== 'admin' && role !== 'superadmin' && String(report.trainer_id) !== String(userId)) {
                return res.status(403).json({ error: 'Unauthorized' });
            }

            await TrainerReport.findByIdAndDelete(id);
            return res.json({ message: 'Report deleted' });
        }

        const report = await queryOne('SELECT * FROM trainer_reports WHERE id = ?', [id]);
        if (!report) return res.status(404).json({ error: 'Report not found' });

        // FIX: Use String() cast on both sides to prevent INTEGER vs STRING mismatch
        // that previously always blocked teachers from deleting their own reports
        if (role !== 'admin' && role !== 'superadmin' && String(report.trainer_id) !== String(userId)) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        await run('DELETE FROM trainer_reports WHERE id = ?', [id]);
        res.json({ message: 'Report deleted' });
    } catch (error) {
        console.error('Error deleting trainer report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
