import { query, queryOne } from '../config/database.js';
import { getGradeScale, gradeFor, gradePointsFor } from '../utils/grading.js';
import { resolveStudentId, getTeacherAllowedCoursesAndStudents } from './catResultsController.js';

const round = (value, digits = 2) => {
    const factor = 10 ** digits;
    return Math.round((Number(value) || 0) * factor) / factor;
};

const nameKey = (value) => String(value || '').trim().toLowerCase();

/**
 * GET /api/academic/report-card?student_id=&academic_period_id=
 *
 * Term-linked report card built from Published CAT results. Each term's unit
 * score is the mean of its published assessments; GPA is credit-weighted using
 * each unit's credit_hours. Students may only request their own card; teachers
 * only students they teach; admins may request anyone.
 */
export async function getReportCard(req, res) {
    try {
        const role = (req.user?.role || '').toLowerCase().trim();
        let studentId = req.query.student_id ? String(req.query.student_id).trim() : '';

        if (role === 'student') {
            studentId = await resolveStudentId(req);
        } else if (role === 'teacher') {
            if (!studentId) return res.status(400).json({ error: 'student_id is required.' });
            const access = await getTeacherAllowedCoursesAndStudents(req);
            if (!access || !access.enrolledStudentIds.has(String(studentId).trim())) {
                return res.status(403).json({ error: 'You can only view report cards for students you teach.' });
            }
        } else if (!['admin', 'superadmin'].includes(role)) {
            return res.status(403).json({ error: 'You are not authorized to view report cards.' });
        }

        if (!studentId) return res.status(400).json({ error: 'student_id is required.' });

        const student = await queryOne(
            `SELECT id, name, email, course, department, level, status, enrolled_date, completion_date
             FROM students WHERE id = ?`,
            [studentId]
        );
        if (!student) return res.status(404).json({ error: 'Student not found.' });

        const scale = await getGradeScale();

        const params = [studentId];
        let sql = `
            SELECT cr.id, cr.cat_period_id, cr.unit_id, cr.course_id, cr.marks, cr.percentage, cr.grade,
                   cp.cat_name, cp.max_marks AS period_max_marks, cp.academic_period_id,
                   ap.name AS academic_period_name, ap.start_date, ap.end_date, ap.status AS academic_period_status,
                   COALESCE(gu.unit_name, cu.name, cr.unit_name) AS unit_display_name,
                   COALESCE(gu.unit_code, cu.code, '') AS unit_display_code
            FROM cat_results cr
            JOIN cat_periods cp ON cp.id = cr.cat_period_id
            LEFT JOIN academic_periods ap ON ap.id = cp.academic_period_id
            LEFT JOIN global_units gu ON gu.id = cr.unit_id
            LEFT JOIN course_units cu ON cu.id = cr.unit_id
            WHERE LOWER(TRIM(cr.student_id)) = LOWER(TRIM(?))
              AND cr.workflow_status = 'Published' AND cr.marks IS NOT NULL
        `;
        if (req.query.academic_period_id) {
            sql += ' AND cp.academic_period_id = ?';
            params.push(req.query.academic_period_id);
        }
        sql += ` ORDER BY ap.start_date ASC NULLS FIRST, cp.id ASC, unit_display_name ASC`;

        const rows = await query(sql, params);

        // Credit hours live on global units; display names are the stable link because
        // historical results can reference either global_units or course_units ids.
        const unitMeta = new Map();
        for (const unit of await query('SELECT unit_name, credit_hours FROM global_units')) {
            const key = nameKey(unit.unit_name);
            if (key) unitMeta.set(key, Number(unit.credit_hours) || 1);
        }

        const periodMap = new Map();
        for (const row of rows || []) {
            const periodKey = row.academic_period_id != null ? `period:${row.academic_period_id}` : `cat:${row.cat_period_id}`;
            if (!periodMap.has(periodKey)) {
                periodMap.set(periodKey, {
                    academic_period_id: row.academic_period_id ?? null,
                    name: row.academic_period_name || 'Unassigned term',
                    start_date: row.start_date || null,
                    end_date: row.end_date || null,
                    status: row.academic_period_status || null,
                    unitMap: new Map(),
                });
            }
            const period = periodMap.get(periodKey);
            const unitName = String(row.unit_display_name || 'General Assessment').trim();
            const unitKey = nameKey(unitName);
            if (!period.unitMap.has(unitKey)) {
                period.unitMap.set(unitKey, {
                    unit_name: unitName,
                    unit_code: row.unit_display_code || null,
                    credit_hours: unitMeta.get(unitKey) || 1,
                    assessments: [],
                });
            }
            period.unitMap.get(unitKey).assessments.push({
                id: row.id,
                cat_name: row.cat_name,
                marks: row.marks,
                max_marks: row.period_max_marks || 100,
                percentage: parseFloat(row.percentage) || 0,
                grade: row.grade || gradeFor(row.percentage, scale),
            });
        }

        const periods = Array.from(periodMap.values()).map((period) => {
            const units = Array.from(period.unitMap.values()).map((unit) => {
                const average = round(
                    unit.assessments.reduce((sum, a) => sum + a.percentage, 0) / unit.assessments.length,
                    1
                );
                const grade = gradeFor(average, scale);
                const gradePoints = gradePointsFor(grade, scale);
                return {
                    ...unit,
                    average,
                    grade,
                    grade_points: gradePoints,
                    quality_points: round(gradePoints * unit.credit_hours),
                };
            }).sort((a, b) => a.unit_name.localeCompare(b.unit_name));

            const credits = round(units.reduce((sum, u) => sum + u.credit_hours, 0));
            const qualityPoints = round(units.reduce((sum, u) => sum + u.quality_points, 0));
            const earnedCredits = round(
                units.filter(u => u.grade !== 'Fail').reduce((sum, u) => sum + u.credit_hours, 0)
            );

            return {
                academic_period_id: period.academic_period_id,
                name: period.name,
                start_date: period.start_date,
                end_date: period.end_date,
                status: period.status,
                units,
                credits,
                earned_credits: earnedCredits,
                quality_points: qualityPoints,
                gpa: credits > 0 ? round(qualityPoints / credits) : null,
            };
        });

        const credits = round(periods.reduce((sum, p) => sum + p.credits, 0));
        const qualityPoints = round(periods.reduce((sum, p) => sum + p.quality_points, 0));

        return res.json({
            student,
            grade_scale: scale,
            periods,
            cumulative: {
                units: periods.reduce((sum, p) => sum + p.units.length, 0),
                credits,
                earned_credits: round(periods.reduce((sum, p) => sum + p.earned_credits, 0)),
                quality_points: qualityPoints,
                gpa: credits > 0 ? round(qualityPoints / credits) : null,
            },
        });
    } catch (error) {
        console.error('getReportCard error:', error);
        return res.status(500).json({ error: 'Failed to build report card.' });
    }
}
