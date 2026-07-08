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

// Helper to parse faculty courses list robustly
function parseFacultyCourses(coursesField) {
    if (!coursesField) return [];
    if (Array.isArray(coursesField)) return coursesField;
    if (typeof coursesField === 'string') {
        const trimmed = coursesField.trim();
        if (trimmed.startsWith('[')) {
            try {
                return JSON.parse(trimmed);
            } catch (e) {
                // fall through
            }
        }
        return trimmed.split(',').map(c => c.trim()).filter(Boolean);
    }
    return [];
}

// Helper to get allowed course IDs for a teacher
async function getTeacherAllowedCourseIds(req) {
    const userRole = (req.user?.role || '').toLowerCase();
    if (userRole !== 'teacher') return null; // non-teachers can access everything

    const userEmail = String(req.user?.email || '').toLowerCase().trim();
    const userName = String(req.user?.name || '').toLowerCase().trim();

    // 1. Get faculty record by email
    const faculty = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [userEmail]);
    
    let tutorName = userName;
    let coursesList = [];
    if (faculty) {
        tutorName = String(faculty.name || userName).toLowerCase().trim();
        coursesList = parseFacultyCourses(faculty.courses).map(c => c.toLowerCase().trim());
    }

    // 2. Query all course IDs that match the instructor name or course name in coursesList
    let allowedCourses = [];
    if (coursesList.length > 0) {
        const placeholders = coursesList.map(() => '?').join(',');
        const courses = await query(
            `SELECT id FROM courses WHERE LOWER(instructor) = LOWER(?) OR LOWER(name) IN (${placeholders})`,
            [tutorName, ...coursesList]
        );
        allowedCourses = courses.map(c => c.id);
    } else {
        const courses = await query(
            `SELECT id FROM courses WHERE LOWER(instructor) = LOWER(?)`,
            [tutorName]
        );
        allowedCourses = courses.map(c => c.id);
    }

    return allowedCourses;
}

// ─── GET /api/student-unit-marks ─────────────────────────────────────────────

/**
 * Returns student unit marks.
 * Filters: ?student_id=... &course_id=...
 * Students can only see their own marks.
 * Teachers can only see marks for courses they teach.
 */
export async function getStudentUnitMarks(req, res) {
    try {
        const userRole   = (req.user?.role || '').toLowerCase();
        const isStudent  = userRole === 'student';

        let { student_id, course_id } = req.query;

        // Enforce student isolation
        if (isStudent) {
            student_id = req.user.student_id || req.user.id;
        }

        const allowedCourses = await getTeacherAllowedCourseIds(req);

        const conditions = [];
        const params     = [];

        if (student_id) { 
            conditions.push('m.student_id = ?'); 
            params.push(student_id); 
        }

        if (allowedCourses !== null) {
            // User is a teacher. Apply course filtration.
            if (allowedCourses.length === 0) {
                return res.json([]); // No courses assigned -> no marks
            }
            if (course_id) {
                if (!allowedCourses.includes(course_id)) {
                    return res.json([]); // Requested course they don't teach -> return empty
                }
                conditions.push('m.course_id = ?');
                params.push(course_id);
            } else {
                const placeholders = allowedCourses.map(() => '?').join(',');
                conditions.push(`m.course_id IN (${placeholders})`);
                params.push(...allowedCourses);
            }
        } else {
            // Admin or Student
            if (course_id) {
                conditions.push('m.course_id = ?');
                params.push(course_id);
            }
        }

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
 * Teachers can only record marks for courses they teach and students enrolled in them.
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

        // Verify teacher course permission
        const allowedCourses = await getTeacherAllowedCourseIds(req);
        if (allowedCourses !== null) {
            if (!allowedCourses.includes(course_id)) {
                return res.status(403).json({ error: 'You are not authorized to record marks for this course' });
            }

            // Verify student is enrolled in this course
            const student = await queryOne('SELECT course FROM students WHERE id = ?', [student_id]);
            if (!student) {
                return res.status(404).json({ error: 'Student not found' });
            }

            const sCourses = parseFacultyCourses(student.course).map(c => c.toLowerCase().trim());
            const courseObj = await queryOne('SELECT name FROM courses WHERE id = ?', [course_id]);
            if (!courseObj || !sCourses.includes(courseObj.name.toLowerCase().trim())) {
                return res.status(400).json({ error: 'Student is not enrolled in this course' });
            }
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
 * Teachers can only record marks for courses they teach and students enrolled in them.
 */
export async function batchSaveUnitMarks(req, res) {
    try {
        const { course_id, unit_id, entries } = req.body;

        if (!course_id || !unit_id || !Array.isArray(entries) || entries.length === 0) {
            return res.status(400).json({ error: 'course_id, unit_id and entries are required' });
        }

        // Verify teacher course permission
        const allowedCourses = await getTeacherAllowedCourseIds(req);
        if (allowedCourses !== null) {
            if (!allowedCourses.includes(course_id)) {
                return res.status(403).json({ error: 'You are not authorized to record marks for this course' });
            }
        }

        const unit = await queryOne(
            'SELECT * FROM course_units WHERE id = ? AND course_id = ?',
            [unit_id, course_id]
        );
        if (!unit) return res.status(404).json({ error: 'Unit not found for this course' });

        const courseObj = await queryOne('SELECT name FROM courses WHERE id = ?', [course_id]);
        if (!courseObj) return res.status(404).json({ error: 'Course not found' });

        // Retrieve enrolled students to validate registry enrollment
        const students = await query('SELECT id, course FROM students');
        const courseNameLower = courseObj.name.toLowerCase().trim();
        const enrolledStudentIds = new Set(
            students.filter(s => {
                const sCourses = parseFacultyCourses(s.course).map(c => c.toLowerCase().trim());
                return sCourses.includes(courseNameLower);
            }).map(s => String(s.id).trim())
        );

        const thresholds = await getGradingThresholds();
        
        // Pre-load all existing marks for this course/unit to avoid sequential SELECT queries
        const existingMarks = await query(
            'SELECT id, student_id FROM student_unit_marks WHERE course_id = ? AND unit_id = ?',
            [course_id, unit_id]
        );
        const existingMap = new Map(existingMarks.map(m => [String(m.student_id).trim(), m.id]));

        let saved = 0;

        // Wrap the insertion/update loop in a transaction to prevent connection round-trip delays
        await run('BEGIN');
        try {
            for (const entry of entries) {
                const { student_id, marks, lecturer } = entry;
                if (!student_id || marks === undefined || marks === '') continue;

                const normalizedSid = String(student_id).trim();

                // Double check student is enrolled in the course
                if (!enrolledStudentIds.has(normalizedSid)) continue;

                const marksNum = parseFloat(marks);
                if (isNaN(marksNum) || marksNum < 0 || marksNum > 100) continue;

                const grade       = calculateGrade(marksNum, thresholds);
                const recLecturer = lecturer || req.user?.name || req.user?.email || null;

                const existingId = existingMap.get(normalizedSid);

                if (existingId) {
                    await run(
                        `UPDATE student_unit_marks
                            SET marks = ?, grade = ?, unit_name = ?, lecturer = ?,
                                recorded_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                         WHERE id = ?`,
                        [marksNum, grade, unit.name, recLecturer, existingId]
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
            await run('COMMIT');
        } catch (txnErr) {
            await run('ROLLBACK');
            throw txnErr;
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

        const allowedCourses = await getTeacherAllowedCourseIds(req);
        if (allowedCourses !== null) {
            if (!allowedCourses.includes(mark.course_id)) {
                return res.status(403).json({ error: 'You are not authorized to delete marks for this course' });
            }
        }

        await run('DELETE FROM student_unit_marks WHERE id = ?', [id]);
        res.json({ message: 'Mark deleted' });
    } catch (error) {
        console.error('deleteStudentUnitMark error:', error);
        res.status(500).json({ error: 'Failed to delete mark' });
    }
}
