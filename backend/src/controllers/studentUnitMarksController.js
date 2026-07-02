/**
 * Student Unit Marks Controller
 * Records and retrieves student scores for each course unit.
 * Automatically calculates grades based on system settings thresholds.
 */
import { query, run, queryOne } from '../config/database.js';

// ─── Grade Calculation Helpers ──────────────────────────────────────────────

async function getGradingThresholds() {
    try {
        const rows = await query(
            `SELECT key, value FROM system_settings WHERE key IN (
                'grading_distinction_min', 'grading_credit_min', 'grading_pass_min'
            )`
        );
        const map = rows.reduce((acc, r) => { acc[r.key] = parseFloat(r.value); return acc; }, {});
        return {
            distinction: map.grading_distinction_min ?? 80,
            credit:      map.grading_credit_min      ?? 65,
            pass:        map.grading_pass_min         ?? 50,
        };
    } catch {
        return { distinction: 80, credit: 65, pass: 50 };
    }
}

export function calculateGrade(marks, thresholds) {
    const { distinction, credit, pass } = thresholds;
    if (marks >= distinction) return 'Distinction';
    if (marks >= credit)      return 'Credit';
    if (marks >= pass)        return 'Pass';
    return 'Fail';
}

// ─── GET /api/student-unit-marks ─────────────────────────────────────────────

/**
 * Returns student unit marks.
 * Filters: ?student_id=... &course_id=...
 * Students can only see their own marks.
 */
export async function getStudentUnitMarks(req, res) {
    try {
        const userRole   = (req.user?.role || '').toLowerCase();
        const isStudent  = userRole === 'student';
        const isAdmin    = ['admin', 'superadmin', 'teacher'].includes(userRole);

        let { student_id, course_id } = req.query;

        // Enforce student isolation
        if (isStudent) {
            student_id = req.user.student_id || req.user.id;
        }

        const conditions = [];
        const params     = [];

        if (student_id) { conditions.push('m.student_id = ?'); params.push(student_id); }
        if (course_id)  { conditions.push('m.course_id = ?');  params.push(course_id);  }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const marks = await query(
            `SELECT m.*,
                    s.name AS student_name,
                    c.name AS course_name,
                    cu.name AS unit_name_current
             FROM student_unit_marks m
             LEFT JOIN students s  ON s.id = m.student_id
             LEFT JOIN courses c   ON c.id = m.course_id
             LEFT JOIN course_units cu ON cu.id = m.unit_id
             ${where}
             ORDER BY m.course_id, cu.sort_order, cu.id`,
            params
        );

        res.json(marks);
    } catch (error) {
        console.error('getStudentUnitMarks error:', error);
        res.status(500).json({ error: 'Failed to fetch unit marks' });
    }
}

// ─── POST /api/student-unit-marks ────────────────────────────────────────────

/**
 * Upsert a single student unit mark.
 * Body: { student_id, course_id, unit_id, marks, lecturer? }
 * Grade is auto-calculated.
 */
export async function saveStudentUnitMark(req, res) {
    try {
        const { student_id, course_id, unit_id, marks, lecturer } = req.body;

        if (!student_id || !course_id || !unit_id || marks === undefined) {
            return res.status(400).json({ error: 'student_id, course_id, unit_id and marks are required' });
        }

        const marksNum = parseFloat(marks);
        if (isNaN(marksNum) || marksNum < 0 || marksNum > 100) {
            return res.status(400).json({ error: 'marks must be a number between 0 and 100' });
        }

        // Verify unit exists and belongs to course
        const unit = await queryOne(
            'SELECT * FROM course_units WHERE id = ? AND course_id = ?',
            [unit_id, course_id]
        );
        if (!unit) return res.status(404).json({ error: 'Unit not found for this course' });

        const thresholds = await getGradingThresholds();
        const grade      = calculateGrade(marksNum, thresholds);
        const recLecturer = lecturer || req.user?.name || req.user?.email || null;

        // Upsert
        const existing = await queryOne(
            'SELECT id FROM student_unit_marks WHERE student_id = ? AND course_id = ? AND unit_id = ?',
            [student_id, course_id, unit_id]
        );

        if (existing) {
            await run(
                `UPDATE student_unit_marks
                    SET marks = ?, grade = ?, unit_name = ?, lecturer = ?,
                        recorded_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [marksNum, grade, unit.name, recLecturer, existing.id]
            );
            const updated = await queryOne('SELECT * FROM student_unit_marks WHERE id = ?', [existing.id]);
            return res.json(updated);
        }

        const result = await run(
            `INSERT INTO student_unit_marks
                (student_id, course_id, unit_id, unit_name, marks, grade, lecturer)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [student_id, course_id, unit_id, unit.name, marksNum, grade, recLecturer]
        );
        const created = await queryOne('SELECT * FROM student_unit_marks WHERE id = ?', [result.lastID]);
        res.status(201).json(created);
    } catch (error) {
        console.error('saveStudentUnitMark error:', error);
        res.status(500).json({ error: 'Failed to save unit mark' });
    }
}

// ─── POST /api/student-unit-marks/batch ──────────────────────────────────────

/**
 * Save marks for multiple students for a specific unit.
 * Body: { course_id, unit_id, entries: [{ student_id, marks, lecturer? }] }
 */
export async function batchSaveUnitMarks(req, res) {
    try {
        const { course_id, unit_id, entries } = req.body;

        if (!course_id || !unit_id || !Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ error: 'course_id, unit_id and entries are required' });
        }

        const unit = await queryOne(
            'SELECT * FROM course_units WHERE id = ? AND course_id = ?',
            [unit_id, course_id]
        );
        if (!unit) return res.status(404).json({ error: 'Unit not found for this course' });

        const thresholds = await getGradingThresholds();
        let saved = 0;

        for (const entry of entries) {
            const { student_id, marks, lecturer } = entry;
            if (!student_id || marks === undefined || marks === '') continue;

            const marksNum = parseFloat(marks);
            if (isNaN(marksNum) || marksNum < 0 || marksNum > 100) continue;

            const grade       = calculateGrade(marksNum, thresholds);
            const recLecturer = lecturer || req.user?.name || req.user?.email || null;

            const existing = await queryOne(
                'SELECT id FROM student_unit_marks WHERE student_id = ? AND course_id = ? AND unit_id = ?',
                [student_id, course_id, unit_id]
            );

            if (existing) {
                await run(
                    `UPDATE student_unit_marks
                        SET marks = ?, grade = ?, unit_name = ?, lecturer = ?,
                            recorded_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [marksNum, grade, unit.name, recLecturer, existing.id]
                );
            } else {
                await run(
                    `INSERT INTO student_unit_marks
                        (student_id, course_id, unit_id, unit_name, marks, grade, lecturer)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [student_id, course_id, unit_id, unit.name, marksNum, grade, recLecturer]
                );
            }
            saved++;
        }

        res.status(201).json({ message: `Saved marks for ${saved} students`, count: saved });
    } catch (error) {
        console.error('batchSaveUnitMarks error:', error);
        res.status(500).json({ error: 'Failed to batch save unit marks' });
    }
}

// ─── DELETE /api/student-unit-marks/:id ──────────────────────────────────────

export async function deleteStudentUnitMark(req, res) {
    try {
        const { id } = req.params;
        const mark = await queryOne('SELECT * FROM student_unit_marks WHERE id = ?', [id]);
        if (!mark) return res.status(404).json({ error: 'Mark not found' });

        await run('DELETE FROM student_unit_marks WHERE id = ?', [id]);
        res.json({ message: 'Mark deleted' });
    } catch (error) {
        console.error('deleteStudentUnitMark error:', error);
        res.status(500).json({ error: 'Failed to delete mark' });
    }
}
