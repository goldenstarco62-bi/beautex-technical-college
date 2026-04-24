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

        let sql = `
            SELECT tr.*, u.photo as trainer_photo
            FROM trainer_reports tr
            LEFT JOIN users u ON CAST(tr.trainer_id AS TEXT) = CAST(u.id AS TEXT)
            ORDER BY tr.report_date DESC
        `;
        let params = [];
        if (role === 'teacher') {
            sql = `
                SELECT tr.*, u.photo as trainer_photo
                FROM trainer_reports tr
                LEFT JOIN users u ON CAST(tr.trainer_id AS TEXT) = CAST(u.id AS TEXT)
                WHERE CAST(tr.trainer_id AS TEXT) = ?
                ORDER BY tr.report_date DESC
            `;
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

        // Guard against missing name/email â€” always guarantee a non-empty trainer_name
        const trainerEmail = req.user.email || '';
        let trainerName = (req.user.name || '').trim();
        const mongo = await isMongo();

        // If name is missing from JWT, look it up from the faculty table (SQL only)
        if (!trainerName && !mongo) {
            try {
                const facultyRecord = await queryOne(
                    'SELECT name FROM faculty WHERE LOWER(email) = LOWER(?)',
                    [trainerEmail]
                );
                if (facultyRecord && facultyRecord.name) {
                    trainerName = facultyRecord.name;
                }
            } catch (_) { /* non-fatal */ }
        }

        // Final fallback: use email prefix
        if (!trainerName) {
            trainerName = trainerEmail ? trainerEmail.split('@')[0] : 'Trainer';
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
            [String(id), trainerName, week_number, report_date, daily_report, record_of_work, course_id || null, 'Submitted']
        );

        // PostgreSQL returns lastID from RETURNING clause; SQLite uses result.lastID
        const insertedId = result.lastID;
        if (!insertedId) {
            // Fallback: fetch the latest inserted row for this trainer
            const report = await queryOne(
                'SELECT * FROM trainer_reports WHERE CAST(trainer_id AS TEXT) = ? ORDER BY created_at DESC LIMIT 1',
                [String(id)]
            );
            return res.status(201).json(report);
        }

        const report = await queryOne('SELECT * FROM trainer_reports WHERE id = ?', [insertedId]);
        res.status(201).json(report);
    } catch (error) {
        console.error('Error creating trainer report:', error);
        const msg = error.message || '';
        if (msg.includes('does not exist') || msg.includes('no such table')) {
            return res.status(500).json({ error: 'Database table missing. Please contact the system administrator to run database migrations.' });
        }
        res.status(500).json({ error: 'Failed to submit report: ' + msg });
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
