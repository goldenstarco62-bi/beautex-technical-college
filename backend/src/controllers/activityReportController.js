import { getDb, query, queryOne, run } from '../config/database.js';

const isMongo = async () => !!process.env.MONGODB_URI;

// ============ DAILY REPORTS ============

export const getAllDailyReports = async (req, res) => {
    try {
        console.log('Fetching daily reports...');
        const mongo = await isMongo();
        if (mongo) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const { limit = 30, startDate, endDate } = req.query;
            let queryObj = { report_type: 'daily' };
            if (startDate || endDate) {
                queryObj.report_date = {};
                if (startDate) queryObj.report_date.$gte = new Date(startDate);
                if (endDate) queryObj.report_date.$lte = new Date(endDate);
            }
            const reports = await ActivityReport.find(queryObj).sort({ report_date: -1 }).limit(parseInt(limit));
            return res.json({ success: true, data: reports });
        }

        console.log('Executing SQL query for daily reports...');
        const reports = await query('SELECT * FROM daily_activity_reports ORDER BY report_date DESC LIMIT 30');
        console.log(`Found ${reports.length} daily reports.`);
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
    // Sanitize numeric inputs for SQL compatibility
    const parseNum = (val) => {
        if (val === '' || val === null || val === undefined) return 0;
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
    };

    try {
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            // Strip MongoDB internal/immutable fields from body before creating
            const { _id, __v, id, created_at, updated_at, ...cleanBody } = req.body;
            const reportData = { ...cleanBody, report_type: 'daily', reported_by: req.user.name || req.user.email };
            const newReport = new ActivityReport(reportData);
            const savedReport = await newReport.save();
            return res.status(201).json({ success: true, data: { id: savedReport._id } });
        }

        const { report_date, classes_conducted, total_attendance_percentage, assessments_conducted,
            total_students_present, total_students_absent, late_arrivals, new_enrollments,
            staff_present, staff_absent, disciplinary_cases, facilities_issues, equipment_maintenance,
            notable_events, incidents, achievements, additional_notes } = req.body;

        if (!report_date) {
            return res.status(400).json({ success: false, error: 'Report date is required' });
        }

        const result = await run(
            `INSERT INTO daily_activity_reports (report_date, reported_by, classes_conducted, total_attendance_percentage,
             assessments_conducted, total_students_present, total_students_absent, late_arrivals, new_enrollments,
             staff_present, staff_absent, disciplinary_cases, facilities_issues, equipment_maintenance, notable_events, incidents, achievements, additional_notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                report_date,
                req.user.name || req.user.email,
                parseNum(classes_conducted),
                parseNum(total_attendance_percentage),
                parseNum(assessments_conducted),
                parseNum(total_students_present),
                parseNum(total_students_absent),
                parseNum(late_arrivals),
                parseNum(new_enrollments),
                parseNum(staff_present),
                parseNum(staff_absent),
                parseNum(disciplinary_cases),
                facilities_issues,
                equipment_maintenance,
                notable_events,
                incidents,
                achievements,
                additional_notes
            ]
        );
        res.status(201).json({ success: true, data: { id: result.lastID } });
    } catch (error) {
        console.error('Error creating daily report:', error);
        res.status(500).json({ success: false, error: error.message, detail: error.stack });
    }
};

export const updateDailyReport = async (req, res) => {
    try {
        const { id } = req.params;
        const { report_date } = req.body;

        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            // Strip immutable MongoDB fields to avoid MongoServerError
            const { _id, __v, id: bodyId, created_at, updated_at, ...cleanBody } = req.body;
            const updateData = { ...cleanBody, updated_at: new Date() };
            if (report_date) updateData.report_date = new Date(report_date);

            const updatedReport = await ActivityReport.findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: false });
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
        console.log('Fetching weekly reports...');
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const { limit = 20 } = req.query;
            const reports = await ActivityReport.find({ report_type: 'weekly' }).sort({ week_start_date: -1 }).limit(parseInt(limit));
            return res.json({ success: true, data: reports });
        }

        console.log('Executing SQL query for weekly reports...');
        const reports = await query('SELECT * FROM weekly_summary_reports ORDER BY week_start_date DESC LIMIT 20');
        console.log(`Found ${reports.length} weekly reports.`);
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
    const parseNum = (val) => {
        if (val === '' || val === null || val === undefined) return 0;
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
    };

    try {
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const { _id, __v, id, created_at, updated_at, ...cleanBody } = req.body;
            const reportData = { ...cleanBody, report_type: 'weekly', reported_by: req.user.name || req.user.email };
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
            [
                week_start_date,
                week_end_date,
                req.user.name || req.user.email,
                parseNum(total_classes_conducted),
                parseNum(average_attendance),
                parseNum(total_assessments),
                parseNum(active_students),
                parseNum(avg_student_attendance),
                parseNum(disciplinary_cases),
                parseNum(courses_completed),
                parseNum(new_enrollments),
                key_achievements,
                challenges_faced,
                action_items,
                parseNum(revenue_collected),
                notes
            ]
        );
        res.status(201).json({ success: true, data: { id: result.lastID } });
    } catch (error) {
        console.error('Error creating weekly report:', error);
        res.status(500).json({ success: false, error: error.message, detail: error.stack });
    }
};

export const updateWeeklyReport = async (req, res) => {
    try {
        const { id } = req.params;
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const { _id, __v, id: bodyId, created_at, updated_at, ...cleanBody } = req.body;
            const updatedReport = await ActivityReport.findByIdAndUpdate(id, { $set: { ...cleanBody, updated_at: new Date() } }, { new: true, runValidators: false });
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
        console.log('Fetching monthly reports...');
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const { limit = 12 } = req.query;
            const reports = await ActivityReport.find({ report_type: 'monthly' }).sort({ month_start_date: -1 }).limit(parseInt(limit));
            return res.json({ success: true, data: reports });
        }

        console.log('Executing SQL query for monthly reports...');
        const reports = await query('SELECT * FROM monthly_summary_reports ORDER BY month_start_date DESC LIMIT 12');
        console.log(`Found ${reports.length} monthly reports.`);
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
    const parseNum = (val) => {
        if (val === '' || val === null || val === undefined) return 0;
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
    };

    try {
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const { _id, __v, id, created_at, updated_at, ...cleanBody } = req.body;
            const reportData = { ...cleanBody, report_type: 'monthly', reported_by: req.user.name || req.user.email };
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
            [
                month, month_start_date, month_end_date, req.user.name || req.user.email,
                parseNum(total_students), parseNum(new_enrollments), parseNum(graduations), parseNum(dropouts),
                parseNum(total_classes), parseNum(average_attendance), parseNum(total_assessments), parseNum(average_pass_rate),
                parseNum(total_faculty), parseNum(new_hires), parseNum(faculty_departures),
                parseNum(revenue), parseNum(expenses),
                major_achievements, challenges, strategic_initiatives,
                goals_next_month, additional_notes
            ]
        );
        res.status(201).json({ success: true, data: { id: result.lastID } });
    } catch (error) {
        console.error('Error creating monthly report:', error);
        res.status(500).json({ success: false, error: error.message, detail: error.stack });
    }
};

export const updateMonthlyReport = async (req, res) => {
    try {
        const { id } = req.params;
        if (await isMongo()) {
            const ActivityReport = (await import('../models/mongo/ActivityReport.js')).default;
            const { _id, __v, id: bodyId, created_at, updated_at, ...cleanBody } = req.body;
            const updatedReport = await ActivityReport.findByIdAndUpdate(id, { $set: { ...cleanBody, updated_at: new Date() } }, { new: true, runValidators: false });
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

// ============ AUTO-CAPTURE STATS ============

export const getAutoCaptureStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, error: 'Start and end dates are required' });
        }

        if (await isMongo()) {
            // MongoDB aggregation logic
            const Attendance = (await import('../models/mongo/Attendance.js')).default;
            const Student = (await import('../models/mongo/Student.js')).default;
            const Payment = (await import('../models/mongo/Payment.js')).default;
            const Faculty = (await import('../models/mongo/Faculty.js')).default;

            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            const attendanceStats = await Attendance.aggregate([
                { $match: { date: { $gte: start, $lte: end } } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]);

            const newStudents = await Student.countDocuments({ enrolled_date: { $gte: start, $lte: end } });
            const revenue = await Payment.aggregate([
                { $match: { payment_date: { $gte: start, $lte: end }, status: 'Completed' } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]);

            const facultyCount = await Faculty.countDocuments({});

            const stats = {
                attendance: {
                    Present: attendanceStats.find(s => s._id === 'Present')?.count || 0,
                    Absent: attendanceStats.find(s => s._id === 'Absent')?.count || 0,
                    Late: attendanceStats.find(s => s._id === 'Late')?.count || 0
                },
                new_enrollments: newStudents,
                revenue_collected: revenue[0]?.total || 0,
                total_faculty: facultyCount
            };

            return res.json({ success: true, data: stats });
        }

        // SQLite / PostgreSQL logic
        const start = startDate;
        const end = endDate;
        // Use env var directly to avoid a broken dynamic re-import
        const isPostgres = !!process.env.DATABASE_URL;

        // Use query() (not queryOne()) so we get an array we can .find() on
        const attendanceRows = await query(
            isPostgres
                ? 'SELECT status, COUNT(*) as count FROM attendance WHERE date BETWEEN $1 AND $2 GROUP BY status'
                : 'SELECT status, COUNT(*) as count FROM attendance WHERE date BETWEEN ? AND ? GROUP BY status',
            [start, end]
        );

        const enrollments = await queryOne(
            isPostgres
                ? 'SELECT COUNT(*) as count FROM students WHERE enrolled_date BETWEEN $1 AND $2'
                : 'SELECT COUNT(*) as count FROM students WHERE enrolled_date BETWEEN ? AND ?',
            [start, end]
        );

        // Date casting varies between SQLite and PostgreSQL
        const dateCast = isPostgres ? 'CAST(payment_date AS DATE)' : 'DATE(payment_date)';
        const paymentPlaceholders = isPostgres ? '$1 AND $2' : '? AND ?';
        const payments = await queryOne(
            `SELECT SUM(amount) as total FROM payments WHERE ${dateCast} BETWEEN ${paymentPlaceholders} AND status = 'Completed'`,
            [start, end]
        );

        const faculty = await queryOne(
            isPostgres ? 'SELECT COUNT(*) as count FROM faculty' : 'SELECT COUNT(*) as count FROM faculty'
        );

        const rows = Array.isArray(attendanceRows) ? attendanceRows : [];
        const stats = {
            attendance: {
                Present: rows.find(r => r.status === 'Present')?.count || 0,
                Absent: rows.find(r => r.status === 'Absent')?.count || 0,
                Late: rows.find(r => r.status === 'Late')?.count || 0
            },
            new_enrollments: enrollments?.count || 0,
            revenue_collected: parseFloat(payments?.total || 0),
            total_faculty: faculty?.count || 0
        };

        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('Error auto-capturing stats:', error);
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
