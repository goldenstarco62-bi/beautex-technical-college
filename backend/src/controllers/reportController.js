import { getDb, query, queryOne, run } from '../config/database.js';

async function isMongo() {
    const db = await getDb();
    return db.constructor.name === 'NativeConnection';
}

export const getAllReports = async (req, res) => {
    try {
        const { course, trainer_email } = req.query;

        if (await isMongo()) {
            const AcademicReport = (await import('../models/mongo/AcademicReport.js')).default;
            let query = {};

            // Student isolation
            if (req.user?.role === 'student' && req.user?.student_id) {
                query.student_id = req.user.student_id;
            } else if (trainer_email) {
                query.trainer_email = trainer_email;
            } else if (course) {
                query.course_unit = course;
            }

            const reports = await AcademicReport.find(query).sort({ created_at: -1 });
            return res.json(reports);
        }

        let sql = 'SELECT * FROM academic_reports';
        let params = [];
        let conditions = [];

        // Student isolation
        if (req.user?.role === 'student' && req.user?.student_id) {
            conditions.push('student_id = ?');
            params.push(req.user.student_id);
        } else if (trainer_email) {
            conditions.push('trainer_email = ?');
            params.push(trainer_email);
        } else if (course) {
            conditions.push('course_unit = ?');
            params.push(course);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' ORDER BY created_at DESC';

        const reports = await query(sql, params);
        res.json(reports);
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getStudentReports = async (req, res) => {
    const { studentId } = req.params;
    try {
        if (await isMongo()) {
            const AcademicReport = (await import('../models/mongo/AcademicReport.js')).default;
            const reports = await AcademicReport.find({ student_id: studentId }).sort({ created_at: -1 });
            return res.json(reports);
        }

        const reports = await query('SELECT * FROM academic_reports WHERE student_id = ? ORDER BY created_at DESC', [studentId]);
        res.json(reports);
    } catch (error) {
        console.error('Error fetching student reports:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createReport = async (req, res) => {
    const reportData = req.body;
    const trainer_email = req.user.email;
    const trainer_name = req.user.name || (trainer_email ? trainer_email.split('@')[0] : 'Trainer');

    const {
        student_id, student_name, registration_number, course_unit, reporting_period,
        total_lessons, attended_lessons, attendance_percentage,
        theory_topics, theory_score, theory_remarks,
        practical_tasks, equipment_used, skill_level, safety_compliance,
        discipline_issues, trainer_observations,
        progress_summary, recommendation
    } = reportData;

    if (!student_id || !course_unit || !reporting_period) {
        return res.status(400).json({ error: 'Student ID, Course, and Reporting Period are required' });
    }

    try {
        if (await isMongo()) {
            const AcademicReport = (await import('../models/mongo/AcademicReport.js')).default;
            const newReport = new AcademicReport({
                student_id, student_name, registration_number, course_unit,
                trainer_name, trainer_email, reporting_period,
                total_lessons: total_lessons || 0,
                attended_lessons: attended_lessons || 0,
                attendance_percentage: attendance_percentage || 0,
                theory_topics, theory_score, theory_remarks,
                practical_tasks, equipment_used, skill_level, safety_compliance,
                discipline_issues, trainer_observations,
                progress_summary, recommendation
            });
            const savedReport = await newReport.save();
            return res.status(201).json(savedReport);
        }

        const result = await run(
            `INSERT INTO academic_reports (
                student_id, student_name, registration_number, course_unit,
                trainer_name, trainer_email, reporting_period,
                total_lessons, attended_lessons, attendance_percentage,
                theory_topics, theory_score, theory_remarks,
                practical_tasks, equipment_used, skill_level, safety_compliance,
                discipline_issues, trainer_observations,
                progress_summary, recommendation
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [student_id, student_name, registration_number, course_unit,
                trainer_name, trainer_email, reporting_period,
                total_lessons || 0, attended_lessons || 0, attendance_percentage || 0,
                theory_topics, theory_score, theory_remarks,
                practical_tasks, equipment_used, skill_level, safety_compliance,
                discipline_issues, trainer_observations,
                progress_summary, recommendation]
        );
        const report = await queryOne('SELECT * FROM academic_reports WHERE id = ?', [result.lastID]);
        res.status(201).json(report);
    } catch (error) {
        console.error('Error creating report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteReport = async (req, res) => {
    const { id } = req.params;
    try {
        if (await isMongo()) {
            const AcademicReport = (await import('../models/mongo/AcademicReport.js')).default;
            const report = await AcademicReport.findById(id);
            if (!report) return res.status(404).json({ error: 'Report not found' });
            if (req.user.role === 'teacher' && report.trainer_email !== req.user.email) {
                return res.status(403).json({ error: 'Forbidden: You can only delete your own reports' });
            }
            await AcademicReport.findByIdAndDelete(id);
            return res.json({ message: 'Report deleted successfully' });
        }

        await run('DELETE FROM academic_reports WHERE id = ?', [id]);
        res.json({ message: 'Report deleted successfully' });
    } catch (error) {
        console.error('Error deleting report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateReport = async (req, res) => {
    const { id } = req.params;
    const reportData = req.body;

    try {
        if (await isMongo()) {
            const AcademicReport = (await import('../models/mongo/AcademicReport.js')).default;
            const report = await AcademicReport.findById(id);
            if (!report) return res.status(404).json({ error: 'Report not found' });

            if (req.user.role === 'teacher' && report.trainer_email !== req.user.email) {
                return res.status(403).json({ error: 'Forbidden: You can only edit your own reports' });
            }

            const updatedReport = await AcademicReport.findByIdAndUpdate(
                id,
                { $set: { ...reportData, updated_at: new Date() } },
                { new: true, runValidators: true }
            );
            return res.json(updatedReport);
        }

        const report = await queryOne('SELECT * FROM academic_reports WHERE id = ?', [id]);
        if (!report) return res.status(404).json({ error: 'Report not found' });

        if (req.user.role === 'teacher' && report.trainer_email !== req.user.email) {
            return res.status(403).json({ error: 'Forbidden: You can only edit your own reports' });
        }

        const fields = Object.keys(reportData).filter(k => !['id', 'created_at', 'updated_at', 'trainer_email', 'trainer_name'].includes(k));
        if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => reportData[f]);
        values.push(id);

        await run(`UPDATE academic_reports SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
        const updatedReport = await queryOne('SELECT * FROM academic_reports WHERE id = ?', [id]);
        res.json(updatedReport);
    } catch (error) {
        console.error('Error updating report:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
