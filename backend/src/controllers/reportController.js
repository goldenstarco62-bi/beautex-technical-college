import { getDb, query, queryOne, run } from '../config/database.js';

const isMongo = async () => !!process.env.MONGODB_URI;

export const getAllReports = async (req, res) => {
    try {
        const { course, trainer_email } = req.query;

        if (await isMongo()) {
            const AcademicReport = (await import('../models/mongo/AcademicReport.js')).default;
            let mongoFilter = {};

            // Student isolation
            if (req.user?.role === 'student') {
                const studentId = req.user?.student_id || req.user?.id;
                mongoFilter.student_id = String(studentId);
            } else if (trainer_email) {
                mongoFilter.trainer_email = String(trainer_email).toLowerCase().trim();
            } else if (course) {
                mongoFilter.course_unit = course;
            } else if (req.user?.role === 'teacher') {
                // Teachers see only their own reports by default if no filter
                mongoFilter.trainer_email = String(req.user.email || '').toLowerCase().trim();
            }

            const reports = await AcademicReport.find(mongoFilter).sort({ created_at: -1 });
            return res.json(reports);
        }

        let sql = 'SELECT * FROM academic_reports';
        let params = [];
        let conditions = [];

        // Student isolation
        if (req.user?.role === 'student') {
            const studentId = req.user?.student_id || req.user?.id;
            conditions.push('LOWER(TRIM(student_id)) = LOWER(TRIM(?))');
            params.push(String(studentId));
        } else if (trainer_email) {
            conditions.push('LOWER(TRIM(trainer_email)) = LOWER(TRIM(?))');
            params.push(String(trainer_email).toLowerCase().trim());
        } else if (course) {
            conditions.push('course_unit = ?');
            params.push(course);
        } else if (req.user?.role === 'teacher') {
            conditions.push('LOWER(TRIM(trainer_email)) = LOWER(TRIM(?))');
            params.push(String(req.user.email || '').toLowerCase().trim());
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
    const trainer_name = reportData.trainer_name || req.user.name || (trainer_email ? trainer_email.split('@')[0] : 'Trainer');

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

    // Sanitize numeric inputs for SQL compatibility
    const parseNum = (val) => {
        if (val === '' || val === null || val === undefined) return 0;
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
    };

    try {
        if (await isMongo()) {
            const AcademicReport = (await import('../models/mongo/AcademicReport.js')).default;
            const newReport = new AcademicReport({
                student_id, student_name, registration_number, course_unit,
                trainer_name, trainer_email, reporting_period,
                total_lessons: parseNum(total_lessons),
                attended_lessons: parseNum(attended_lessons),
                attendance_percentage: parseNum(attendance_percentage),
                theory_topics,
                theory_score: parseNum(theory_score),
                theory_remarks,
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
            [
                student_id, student_name, registration_number, course_unit,
                trainer_name, trainer_email, reporting_period,
                parseNum(total_lessons), parseNum(attended_lessons), parseNum(attendance_percentage),
                theory_topics, parseNum(theory_score), theory_remarks,
                practical_tasks, equipment_used, skill_level, safety_compliance,
                discipline_issues, trainer_observations,
                progress_summary, recommendation
            ]
        );
        const report = await queryOne('SELECT * FROM academic_reports WHERE id = ?', [result.lastID]);
        res.status(201).json(report);
    } catch (error) {
        console.error('Error creating report:', error);
        const msg = error.message || 'Internal server error';
        const isTableMissing = msg.includes('does not exist') || msg.includes('no such table');
        res.status(500).json({
            error: isTableMissing
                ? 'Database table missing. Run migration 003_add_missing_report_tables.sql in Supabase SQL Editor.'
                : msg,
            detail: msg
        });
    }
};

export const deleteReport = async (req, res) => {
    const { id } = req.params;
    try {
        if (await isMongo()) {
            const AcademicReport = (await import('../models/mongo/AcademicReport.js')).default;
            const report = await AcademicReport.findById(id);
            if (!report) return res.status(404).json({ error: 'Report not found' });
            if (req.user.role === 'teacher' && String(report.trainer_email || '').toLowerCase().trim() !== String(req.user.email || '').toLowerCase().trim()) {
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

            if (req.user.role === 'teacher' && String(report.trainer_email || '').toLowerCase().trim() !== String(req.user.email || '').toLowerCase().trim()) {
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

        if (req.user.role === 'teacher' && String(report.trainer_email || '').toLowerCase().trim() !== String(req.user.email || '').toLowerCase().trim()) {
            return res.status(403).json({ error: 'Forbidden: You can only edit your own reports' });
        }

        const fields = Object.keys(reportData).filter(k => !['id', 'created_at', 'updated_at', 'trainer_email'].includes(k));
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
