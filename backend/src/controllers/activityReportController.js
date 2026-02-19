import { getDb, query, queryOne, run } from '../config/database.js';

async function isMongo() {
    const db = await getDb();
    return db.constructor.name === 'NativeConnection';
}

// ============ DAILY REPORTS ============

export const getAllDailyReports = async (req, res) => {
    try {
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const { limit = 30, startDate, endDate } = req.query;
            let query = { report_type: 'daily' };
            if (startDate || endDate) {
                query.report_date = {};
                if (startDate) query.report_date.$gte = new Date(startDate);
                if (endDate) query.report_date.$lte = new Date(endDate);
            }
            const reports = await ActivityReport.find(query).sort({ report_date: -1 }).limit(parseInt(limit));
            return res.json({ success: true, data: reports });
        }

        const reports = await query('SELECT * FROM daily_activity_reports ORDER BY report_date DESC LIMIT 30');
        res.json({ success: true, data: reports });
    } catch (error) {
        console.error('Error fetching daily reports:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getDailyReport = async (req, res) => {
    try {
        const { date } = req.params;
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const report = await ActivityReport.findOne({ report_type: 'daily', report_date: new Date(date) });
            if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
            return res.json({ success: true, data: report });
        }

        const report = await queryOne('SELECT * FROM daily_activity_reports WHERE report_date = ?', [date]);
        if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
        res.json({ success: true, data: report });
    } catch (error) {
        console.error('Error fetching daily report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const createDailyReport = async (req, res) => {
    try {
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const reportData = { ...req.body, report_type: 'daily', reported_by: req.user.email };
            const newReport = new ActivityReport(reportData);
            const savedReport = await newReport.save();
            return res.status(201).json({ success: true, data: { id: savedReport._id } });
        }

        const { report_date, classes_conducted, total_attendance_percentage, assessments_conducted,
            total_students_present, total_students_absent, late_arrivals, new_enrollments,
            staff_present, staff_absent, facilities_issues, equipment_maintenance,
            notable_events, incidents, achievements, additional_notes } = req.body;

        if (!report_date) {
            return res.status(400).json({ success: false, error: 'Report date is required' });
        }

        const result = await run(
            `INSERT INTO daily_activity_reports (report_date, reported_by, classes_conducted, total_attendance_percentage,
             assessments_conducted, total_students_present, total_students_absent, late_arrivals, new_enrollments,
             staff_present, staff_absent, facilities_issues, equipment_maintenance, notable_events, incidents, achievements, additional_notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [report_date, req.user.email, classes_conducted, total_attendance_percentage, assessments_conducted,
                total_students_present, total_students_absent, late_arrivals, new_enrollments,
                staff_present, staff_absent, facilities_issues, equipment_maintenance, notable_events, incidents, achievements, additional_notes]
        );
        res.status(201).json({ success: true, data: { id: result.lastID } });
    } catch (error) {
        console.error('Error creating daily report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateDailyReport = async (req, res) => {
    try {
        const { id } = req.params;
        const { report_date } = req.body;

        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const updateData = { ...req.body, updated_at: new Date() };
            if (report_date) updateData.report_date = new Date(report_date);

            const updatedReport = await ActivityReport.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true });
            if (!updatedReport) return res.status(404).json({ success: false, error: 'Report not found' });
            return res.json({ success: true, message: 'Report updated successfully' });
        }

        const fields = Object.keys(req.body).filter(k => k !== 'id');
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => req.body[f]);
        values.push(id);
        await run(`UPDATE daily_activity_reports SET ${setClause} WHERE id = ?`, values);
        res.json({ success: true, message: 'Report updated successfully' });
    } catch (error) {
        console.error('Error updating daily report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteDailyReport = async (req, res) => {
    try {
        const { id } = req.params;
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            await ActivityReport.findByIdAndDelete(id);
            return res.json({ success: true, message: 'Report deleted successfully' });
        }

        await run('DELETE FROM daily_activity_reports WHERE id = ?', [id]);
        res.json({ success: true, message: 'Report deleted successfully' });
    } catch (error) {
        console.error('Error deleting daily report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============ WEEKLY REPORTS ============

export const getAllWeeklyReports = async (req, res) => {
    try {
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const { limit = 20 } = req.query;
            const reports = await ActivityReport.find({ report_type: 'weekly' }).sort({ week_start_date: -1 }).limit(parseInt(limit));
            return res.json({ success: true, data: reports });
        }

        const reports = await query('SELECT * FROM weekly_summary_reports ORDER BY week_start_date DESC LIMIT 20');
        res.json({ success: true, data: reports });
    } catch (error) {
        console.error('Error fetching weekly reports:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getWeeklyReport = async (req, res) => {
    try {
        const { id } = req.params;
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const report = await ActivityReport.findById(id);
            if (!report || report.report_type !== 'weekly') return res.status(404).json({ success: false, error: 'Report not found' });
            return res.json({ success: true, data: report });
        }

        const report = await queryOne('SELECT * FROM weekly_summary_reports WHERE id = ?', [id]);
        if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
        res.json({ success: true, data: report });
    } catch (error) {
        console.error('Error fetching weekly report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const createWeeklyReport = async (req, res) => {
    try {
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const reportData = { ...req.body, report_type: 'weekly', reported_by: req.user.email };
            const newReport = new ActivityReport(reportData);
            const savedReport = await newReport.save();
            return res.status(201).json({ success: true, data: { id: savedReport._id } });
        }

        const { week_start_date, week_end_date, total_classes_conducted, average_attendance, total_assessments,
            active_students, avg_student_attendance, disciplinary_cases, courses_completed, new_enrollments,
            key_achievements, challenges_faced, action_items, revenue_collected, notes } = req.body;

        const result = await run(
            `INSERT INTO weekly_summary_reports (week_start_date, week_end_date, reported_by, total_classes_conducted,
             average_attendance, total_assessments, active_students, avg_student_attendance, disciplinary_cases,
             courses_completed, new_enrollments, key_achievements, challenges_faced, action_items, revenue_collected, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [week_start_date, week_end_date, req.user.email, total_classes_conducted, average_attendance, total_assessments,
                active_students, avg_student_attendance, disciplinary_cases, courses_completed, new_enrollments,
                key_achievements, challenges_faced, action_items, revenue_collected, notes]
        );
        res.status(201).json({ success: true, data: { id: result.lastID } });
    } catch (error) {
        console.error('Error creating weekly report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateWeeklyReport = async (req, res) => {
    try {
        const { id } = req.params;
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const updatedReport = await ActivityReport.findByIdAndUpdate(id, { $set: { ...req.body, updated_at: new Date() } }, { new: true, runValidators: true });
            if (!updatedReport) return res.status(404).json({ success: false, error: 'Report not found' });
            return res.json({ success: true, message: 'Report updated successfully' });
        }

        const fields = Object.keys(req.body).filter(k => k !== 'id');
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => req.body[f]);
        values.push(id);
        await run(`UPDATE weekly_summary_reports SET ${setClause} WHERE id = ?`, values);
        res.json({ success: true, message: 'Report updated successfully' });
    } catch (error) {
        console.error('Error updating weekly report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteWeeklyReport = async (req, res) => {
    try {
        const { id } = req.params;
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            await ActivityReport.findByIdAndDelete(id);
            return res.json({ success: true, message: 'Report deleted successfully' });
        }

        await run('DELETE FROM weekly_summary_reports WHERE id = ?', [id]);
        res.json({ success: true, message: 'Report deleted successfully' });
    } catch (error) {
        console.error('Error deleting weekly report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============ MONTHLY REPORTS ============

export const getAllMonthlyReports = async (req, res) => {
    try {
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const { limit = 12 } = req.query;
            const reports = await ActivityReport.find({ report_type: 'monthly' }).sort({ month_start_date: -1 }).limit(parseInt(limit));
            return res.json({ success: true, data: reports });
        }

        const reports = await query('SELECT * FROM monthly_summary_reports ORDER BY month_start_date DESC LIMIT 12');
        res.json({ success: true, data: reports });
    } catch (error) {
        console.error('Error fetching monthly reports:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const getMonthlyReport = async (req, res) => {
    try {
        const { id } = req.params;
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const report = await ActivityReport.findById(id);
            if (!report || report.report_type !== 'monthly') return res.status(404).json({ success: false, error: 'Report not found' });
            return res.json({ success: true, data: report });
        }

        const report = await queryOne('SELECT * FROM monthly_summary_reports WHERE id = ?', [id]);
        if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
        res.json({ success: true, data: report });
    } catch (error) {
        console.error('Error fetching monthly report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const createMonthlyReport = async (req, res) => {
    try {
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const reportData = { ...req.body, report_type: 'monthly', reported_by: req.user.email };
            const newReport = new ActivityReport(reportData);
            const savedReport = await newReport.save();
            return res.status(201).json({ success: true, data: { id: savedReport._id } });
        }

        const { month, month_start_date, month_end_date, total_students, new_enrollments, graduations, dropouts,
            total_classes, average_attendance, total_assessments, average_pass_rate, total_faculty, new_hires,
            faculty_departures, revenue, expenses, major_achievements, challenges, strategic_initiatives,
            goals_next_month, additional_notes } = req.body;

        const result = await run(
            `INSERT INTO monthly_summary_reports (month, month_start_date, month_end_date, reported_by, total_students,
             new_enrollments, graduations, dropouts, total_classes, average_attendance, total_assessments, average_pass_rate,
             total_faculty, new_hires, faculty_departures, revenue, expenses, major_achievements, challenges,
             strategic_initiatives, goals_next_month, additional_notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [month, month_start_date, month_end_date, req.user.email, total_students, new_enrollments, graduations, dropouts,
                total_classes, average_attendance, total_assessments, average_pass_rate, total_faculty, new_hires,
                faculty_departures, revenue, expenses, major_achievements, challenges, strategic_initiatives,
                goals_next_month, additional_notes]
        );
        res.status(201).json({ success: true, data: { id: result.lastID } });
    } catch (error) {
        console.error('Error creating monthly report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const updateMonthlyReport = async (req, res) => {
    try {
        const { id } = req.params;
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const updatedReport = await ActivityReport.findByIdAndUpdate(id, { $set: { ...req.body, updated_at: new Date() } }, { new: true, runValidators: true });
            if (!updatedReport) return res.status(404).json({ success: false, error: 'Report not found' });
            return res.json({ success: true, message: 'Report updated successfully' });
        }

        const fields = Object.keys(req.body).filter(k => k !== 'id');
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => req.body[f]);
        values.push(id);
        await run(`UPDATE monthly_summary_reports SET ${setClause} WHERE id = ?`, values);
        res.json({ success: true, message: 'Report updated successfully' });
    } catch (error) {
        console.error('Error updating monthly report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

export const deleteMonthlyReport = async (req, res) => {
    try {
        const { id } = req.params;
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            await ActivityReport.findByIdAndDelete(id);
            return res.json({ success: true, message: 'Report deleted successfully' });
        }

        await run('DELETE FROM monthly_summary_reports WHERE id = ?', [id]);
        res.json({ success: true, message: 'Report deleted successfully' });
    } catch (error) {
        console.error('Error deleting monthly report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ============ DASHBOARD STATS ============

export const getReportsSummary = async (req, res) => {
    try {
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const dailyCount = await ActivityReport.countDocuments({ report_type: 'daily' });
            const weeklyCount = await ActivityReport.countDocuments({ report_type: 'weekly' });
            const monthlyCount = await ActivityReport.countDocuments({ report_type: 'monthly' });
            const latestDaily = await ActivityReport.findOne({ report_type: 'daily' }).sort({ report_date: -1 });
            return res.json({
                success: true,
                data: { daily_reports: dailyCount, weekly_reports: weeklyCount, monthly_reports: monthlyCount, latest_daily: latestDaily }
            });
        }

        const dailyCount = await queryOne('SELECT COUNT(*) as count FROM daily_activity_reports');
        const weeklyCount = await queryOne('SELECT COUNT(*) as count FROM weekly_summary_reports');
        const monthlyCount = await queryOne('SELECT COUNT(*) as count FROM monthly_summary_reports');
        const latestDaily = await queryOne('SELECT * FROM daily_activity_reports ORDER BY report_date DESC LIMIT 1');

        res.json({
            success: true,
            data: {
                daily_reports: dailyCount?.count || 0,
                weekly_reports: weeklyCount?.count || 0,
                monthly_reports: monthlyCount?.count || 0,
                latest_daily: latestDaily
            }
        });
    } catch (error) {
        console.error('Error fetching reports summary:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
