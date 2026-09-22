import { query, queryOne, run } from '../config/database.js';
import logger from '../utils/logger.js';

// ── Grade calculation ─────────────────────────────────────────────────────────
function calcGrade(percentage) {
    const p = parseFloat(percentage) || 0;
    if (p >= 70) return 'Distinction';
    if (p >= 60) return 'Credit';
    if (p >= 50) return 'Pass';
    return 'Fail';
}

// ── Audit helper ──────────────────────────────────────────────────────────────
async function writeAuditLog({ result_id, student_id, unit_name, cat_period_id, action,
    previous_marks, new_marks, previous_status, new_status, changed_by, changed_by_name, reason }) {
    try {
        await run(
            `INSERT INTO result_audit_logs
             (result_id, student_id, unit_name, cat_period_id, action, previous_marks,
              new_marks, previous_status, new_status, changed_by, changed_by_name, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [result_id, student_id, unit_name, cat_period_id, action,
             previous_marks ?? null, new_marks ?? null, previous_status ?? null,
             new_status ?? null, changed_by, changed_by_name || null, reason || null]
        );
    } catch (e) {
        logger.warn({ e }, 'result_audit_logs write failed (non-critical)');
    }
}

// Helper to resolve student ID for a logged in student
async function resolveStudentId(req) {
    let studentId = req.user?.student_id;
    if (!studentId && req.user?.email) {
        const studentRec = await queryOne('SELECT id FROM students WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))', [req.user.email]);
        if (studentRec) studentId = studentRec.id;
    }
    if (!studentId) studentId = req.user?.id;
    return String(studentId || '').trim();
}

// Helper to get allowed courses & registered students for a teacher
async function getTeacherAllowedCoursesAndStudents(req) {
    const userRole = (req.user?.role || '').toLowerCase().trim();
    if (userRole !== 'teacher') return null;

    const userEmail = String(req.user?.email || '').toLowerCase().trim();
    const userName = String(req.user?.name || '').toLowerCase().trim();

    const faculty = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [userEmail]);
    let tutorName = userName;
    let facultyCoursesList = [];

    if (faculty) {
        tutorName = String(faculty.name || userName).toLowerCase().trim();
        if (typeof faculty.courses === 'string') {
            if (faculty.courses.startsWith('[')) {
                try { facultyCoursesList = JSON.parse(faculty.courses); } catch (e) {}
            } else {
                facultyCoursesList = faculty.courses.split(',').map(s => s.trim()).filter(Boolean);
            }
        } else if (Array.isArray(faculty.courses)) {
            facultyCoursesList = faculty.courses;
        }
    }

    const allCourses = await query('SELECT id, name, instructor FROM courses');
    const teacherCourseObjs = allCourses.filter(c => {
        const isInstructor = c.instructor && c.instructor.toLowerCase().trim() === tutorName;
        const isAssigned = facultyCoursesList.some(fn => fn.toLowerCase().trim() === (c.name || '').toLowerCase().trim());
        return isInstructor || isAssigned;
    });

    const allowedCourseIds = teacherCourseObjs.map(c => String(c.id));
    const allowedCourseNames = teacherCourseObjs.map(c => String(c.name).toLowerCase().trim());

    // Get all students enrolled in these courses
    const allStudents = await query('SELECT id, name, course FROM students');
    const parseStudentCourses = (raw) => {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw.map(x => String(x).toLowerCase().trim());
        const s = String(raw).trim();
        if (s.startsWith('{') && s.endsWith('}')) {
            return s.slice(1, -1).split(',').map(c => c.replace(/"/g, '').toLowerCase().trim()).filter(Boolean);
        }
        if (s.startsWith('[')) {
            try { return JSON.parse(s).map(c => String(c).toLowerCase().trim()); } catch (e) {}
        }
        return s.split(',').map(c => c.toLowerCase().trim()).filter(Boolean);
    };

    const enrolledStudentIds = new Set(
        allStudents.filter(s => {
            const sc = parseStudentCourses(s.course);
            return sc.some(cn => allowedCourseNames.includes(cn));
        }).map(s => String(s.id).trim())
    );

    return {
        allowedCourseIds,
        allowedCourseNames,
        enrolledStudentIds
    };
}

/**
 * GET /cat-results — List results with role-based filtering
 * Query params: period_id, course_id, unit_id, student_id, workflow_status
 */
export async function getResults(req, res) {
    try {
        const userRole = (req.user?.role || '').toLowerCase().trim();
        const { period_id, course_id, unit_id, student_id, workflow_status } = req.query;

        let sql = `
            SELECT cr.*, cp.cat_name, cp.academic_year, cp.term_name, cp.max_marks as period_max_marks,
                   s.name as student_name, s.id as student_reg_id,
                   c.name as course_name, cu.name as unit_display_name
            FROM cat_results cr
            LEFT JOIN cat_periods cp ON cr.cat_period_id = cp.id
            LEFT JOIN students s ON cr.student_id = s.id
            LEFT JOIN courses c ON cr.course_id = c.id
            LEFT JOIN course_units cu ON cr.unit_id = cu.id
            WHERE 1=1
        `;
        const params = [];

        if (userRole === 'student') {
            const sId = await resolveStudentId(req);
            if (!sId) return res.json([]);
            sql += ' AND (LOWER(TRIM(cr.student_id)) = LOWER(TRIM(?)) OR cr.student_id = ?) AND cr.workflow_status = ?';
            params.push(sId, sId, 'Published');
        } else if (userRole === 'teacher') {
            const teacherAccess = await getTeacherAllowedCoursesAndStudents(req);
            if (!teacherAccess || teacherAccess.allowedCourseIds.length === 0) {
                return res.json([]);
            }

            const courseIds = teacherAccess.allowedCourseIds;
            const courseNames = teacherAccess.allowedCourseNames;
            const enrolledIdsArr = Array.from(teacherAccess.enrolledStudentIds);

            if (enrolledIdsArr.length === 0) return res.json([]);

            const coursePlaceholders = courseIds.map(() => '?').join(',');
            const namePlaceholders = courseNames.map(() => '?').join(',');

            sql += ` AND (cr.course_id IN (${coursePlaceholders}) OR LOWER(TRIM(c.name)) IN (${namePlaceholders}))`;
            params.push(...courseIds, ...courseNames);

            const studentPlaceholders = enrolledIdsArr.map(() => '?').join(',');
            sql += ` AND LOWER(TRIM(cr.student_id)) IN (${studentPlaceholders})`;
            params.push(...enrolledIdsArr.map(id => id.toLowerCase()));

            if (student_id) { sql += ' AND cr.student_id = ?'; params.push(student_id); }
            if (workflow_status) { sql += ' AND cr.workflow_status = ?'; params.push(workflow_status); }
        } else {
            // Admins/superadmins see all
            if (student_id) { sql += ' AND cr.student_id = ?'; params.push(student_id); }
            if (workflow_status) { sql += ' AND cr.workflow_status = ?'; params.push(workflow_status); }
        }

        if (period_id)  { sql += ' AND cr.cat_period_id = ?'; params.push(period_id); }
        if (course_id)  { sql += ' AND cr.course_id = ?';     params.push(course_id); }
        if (unit_id)    { sql += ' AND cr.unit_id = ?';       params.push(unit_id); }

        sql += ' ORDER BY cr.created_at DESC';

        const results = await query(sql, params);
        return res.json(results || []);
    } catch (err) {
        logger.error({ err }, 'getResults error');
        return res.status(500).json({ error: 'Failed to fetch results.' });
    }
}

/**
 * POST /cat-results — Single result entry
 */
export async function createResult(req, res) {
    try {
        const userRole = (req.user?.role || '').toLowerCase().trim();
        if (userRole === 'student') {
            return res.status(403).json({ error: 'Students are not authorized to create results.' });
        }

        const {
            student_id, course_id, unit_id, unit_name,
            cat_period_id, marks, status, remarks
        } = req.body;

        if (!student_id || !course_id || !cat_period_id || !unit_name) {
            return res.status(400).json({ error: 'student_id, course_id, cat_period_id and unit_name are required.' });
        }

        if (userRole === 'teacher') {
            const teacherAccess = await getTeacherAllowedCoursesAndStudents(req);
            if (!teacherAccess) {
                return res.status(403).json({ error: 'Teacher profile not found or unauthorized.' });
            }
            const courseIdStr = String(course_id).trim();
            const studentIdStr = String(student_id).trim();
            const courseAllowed = teacherAccess.allowedCourseIds.includes(courseIdStr);
            const studentAllowed = teacherAccess.enrolledStudentIds.has(studentIdStr);
            if (!courseAllowed || !studentAllowed) {
                return res.status(403).json({ error: 'You are only authorized to enter results for your registered students and assigned courses.' });
            }
        }

        // Get period to calculate max_marks
        const period = await queryOne('SELECT * FROM cat_periods WHERE id = ?', [cat_period_id]);
        if (!period) return res.status(404).json({ error: 'CAT period not found.' });

        let percentage = null;
        let grade = null;

        if (marks !== null && marks !== undefined && marks !== '') {
            const marksNum = parseFloat(marks);
            if (isNaN(marksNum) || marksNum < 0 || marksNum > (period.max_marks || 100)) {
                return res.status(400).json({ error: `Marks must be between 0 and ${period.max_marks || 100}.` });
            }
            percentage = Math.round((marksNum / (period.max_marks || 100)) * 100 * 10) / 10;
            grade = calcGrade(percentage);
        }

        const enteredBy = req.user?.email || req.user?.id;
        const trainerName = req.user?.name || req.user?.email;

        try {
            // Check if result already exists for this student in this period and unit/course
            const existing = unit_id
                ? await queryOne(
                    'SELECT id, workflow_status FROM cat_results WHERE student_id=? AND unit_id=? AND cat_period_id=?',
                    [student_id, unit_id, cat_period_id]
                )
                : await queryOne(
                    'SELECT id, workflow_status FROM cat_results WHERE student_id=? AND unit_name=? AND cat_period_id=?',
                    [student_id, unit_name, cat_period_id]
                );

            if (existing) {
                // Only allow updating Draft/Submitted, not Approved/Published
                if (['Approved', 'Published'].includes(existing.workflow_status)) {
                    return res.status(403).json({ error: 'Result is already approved or published and cannot be modified.' });
                }
                await run(
                    `UPDATE cat_results SET marks=?, percentage=?, grade=?, status=?,
                     remarks=?, entered_by=?, trainer_name=?, updated_at=CURRENT_TIMESTAMP
                     WHERE id=?`,
                    [
                        marks !== '' && marks !== null && marks !== undefined ? parseFloat(marks) : null,
                        percentage, grade, status || 'Present',
                        remarks || null, enteredBy, trainerName, existing.id
                    ]
                );

                await writeAuditLog({
                    result_id: existing.id, student_id, unit_name, cat_period_id,
                    action: 'updated', new_marks: marks !== '' && marks !== null && marks !== undefined ? parseFloat(marks) : null,
                    new_status: existing.workflow_status, changed_by: enteredBy, changed_by_name: trainerName
                });

                const updated = await queryOne('SELECT * FROM cat_results WHERE id = ?', [existing.id]);
                return res.json(updated);
            }

            const result = await run(
                `INSERT INTO cat_results
                 (student_id, course_id, unit_id, unit_name, cat_period_id,
                  marks, percentage, grade, status, workflow_status,
                  entered_by, trainer_name, remarks)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?)`,
                [
                    student_id, course_id, unit_id || null, unit_name, cat_period_id,
                    marks !== '' && marks !== null && marks !== undefined ? parseFloat(marks) : null,
                    percentage, grade,
                    status || 'Present',
                    enteredBy, trainerName, remarks || null
                ]
            );

            await writeAuditLog({
                result_id: result.lastID || result.insertId, student_id, unit_name, cat_period_id,
                action: 'created', new_marks: marks !== '' && marks !== null && marks !== undefined ? parseFloat(marks) : null,
                new_status: 'Draft', changed_by: enteredBy, changed_by_name: trainerName
            });

            const created = await queryOne('SELECT * FROM cat_results WHERE id = ?', [result.lastID || result.insertId]);
            return res.status(201).json(created);
        } catch (err) {
            if (err.message?.includes('UNIQUE') || err.code === '23505') {
                return res.status(409).json({ error: 'A result already exists for this student in this unit and period. Use the update endpoint.' });
            }
            throw err;
        }
    } catch (err) {
        logger.error({ err }, 'createResult error');
        return res.status(500).json({ error: 'Failed to create result.' });
    }
}

/**
 * POST /cat-results/batch — Batch entry for a class
 * Body: { cat_period_id, course_id, unit_id, unit_name, entries: [{ student_id, marks, status, remarks }] }
 */
export async function batchCreateResults(req, res) {
    try {
        const userRole = (req.user?.role || '').toLowerCase().trim();
        if (userRole === 'student') {
            return res.status(403).json({ error: 'Students are not authorized to create results.' });
        }

        const { cat_period_id, course_id, unit_id, unit_name, entries } = req.body;

        if (!cat_period_id || !course_id || !unit_name || !Array.isArray(entries)) {
            return res.status(400).json({ error: 'cat_period_id, course_id, unit_name and entries[] are required.' });
        }

        let teacherAccess = null;
        if (userRole === 'teacher') {
            teacherAccess = await getTeacherAllowedCoursesAndStudents(req);
            if (!teacherAccess || !teacherAccess.allowedCourseIds.includes(String(course_id).trim())) {
                return res.status(403).json({ error: 'You are only authorized to enter results for your assigned courses.' });
            }
        }

        const period = await queryOne('SELECT * FROM cat_periods WHERE id = ?', [cat_period_id]);
        if (!period) return res.status(404).json({ error: 'CAT period not found.' });

        const enteredBy = req.user?.email || req.user?.id;
        const trainerName = req.user?.name || req.user?.email;
        const maxMarks = period.max_marks || 100;

        const saved = [];
        const errors = [];

        for (const entry of entries) {
            const { student_id, marks, status, remarks } = entry;
            if (!student_id) continue;

            if (teacherAccess && !teacherAccess.enrolledStudentIds.has(String(student_id).trim())) {
                const st = await queryOne('SELECT name FROM students WHERE id = ?', [student_id]);
                errors.push({ student_id, student_name: st?.name || student_id, error: 'Student is not registered in your assigned course.' });
                continue;
            }

            let percentage = null;
            let grade = null;

            if (marks !== null && marks !== undefined && marks !== '') {
                const m = parseFloat(marks);
                if (isNaN(m) || m < 0 || m > maxMarks) {
                    const st = await queryOne('SELECT name FROM students WHERE id = ?', [student_id]);
                    errors.push({ student_id, student_name: st?.name || student_id, error: `Marks must be 0–${maxMarks}` });
                    continue;
                }
                percentage = Math.round((m / maxMarks) * 100 * 10) / 10;
                grade = calcGrade(percentage);
            }

            try {
                // Upsert: if exists update, otherwise insert
                const existing = unit_id
                    ? await queryOne(
                        'SELECT id, workflow_status FROM cat_results WHERE student_id=? AND unit_id=? AND cat_period_id=?',
                        [student_id, unit_id, cat_period_id]
                    )
                    : await queryOne(
                        'SELECT id, workflow_status FROM cat_results WHERE student_id=? AND unit_name=? AND cat_period_id=?',
                        [student_id, unit_name, cat_period_id]
                    );

                if (existing) {
                    // Only allow updating Draft/Submitted, not Approved/Published
                    if (['Approved', 'Published'].includes(existing.workflow_status)) {
                        const st = await queryOne('SELECT name FROM students WHERE id = ?', [student_id]);
                        errors.push({ student_id, student_name: st?.name || student_id, error: 'Result is already approved/published and cannot be modified.' });
                        continue;
                    }
                    await run(
                        `UPDATE cat_results SET marks=?, percentage=?, grade=?, status=?,
                         remarks=?, entered_by=?, trainer_name=?, updated_at=CURRENT_TIMESTAMP
                         WHERE id=?`,
                        [
                            marks !== '' && marks !== null && marks !== undefined ? parseFloat(marks) : null,
                            percentage, grade, status || 'Present',
                            remarks || null, enteredBy, trainerName, existing.id
                        ]
                    );
                    await writeAuditLog({ result_id: existing.id, student_id, unit_name, cat_period_id,
                        action: 'updated (batch)', new_marks: marks !== '' && marks !== null && marks !== undefined ? parseFloat(marks) : null,
                        new_status: existing.workflow_status, changed_by: enteredBy, changed_by_name: trainerName });
                    saved.push(existing.id);
                } else {
                    const result = await run(
                        `INSERT INTO cat_results (student_id, course_id, unit_id, unit_name, cat_period_id,
                          marks, percentage, grade, status, workflow_status, entered_by, trainer_name, remarks)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?)`,
                        [
                            student_id, course_id, unit_id || null, unit_name, cat_period_id,
                            marks !== '' && marks !== null && marks !== undefined ? parseFloat(marks) : null,
                            percentage, grade, status || 'Present',
                            enteredBy, trainerName, remarks || null
                        ]
                    );
                    await writeAuditLog({ result_id: result.lastID || result.insertId, student_id, unit_name, cat_period_id,
                        action: 'created (batch)', new_marks: marks !== '' && marks !== null && marks !== undefined ? parseFloat(marks) : null,
                        new_status: 'Draft', changed_by: enteredBy, changed_by_name: trainerName });
                    saved.push(result.lastID || result.insertId);
                }
            } catch (e) {
                logger.error({ e, student_id }, 'batchCreateResults entry failed');
                const st = await queryOne('SELECT name FROM students WHERE id = ?', [student_id]);
                errors.push({ student_id, student_name: st?.name || student_id, error: e.message });
            }
        }

        return res.json({ saved: saved.length, errors });
    } catch (err) {
        logger.error({ err }, 'batchCreateResults error');
        return res.status(500).json({ error: 'Failed to batch-create results.' });
    }
}

/**
 * PUT /cat-results/:id — Edit a single result
 */
export async function updateResult(req, res) {
    try {
        const { id } = req.params;
        const { marks, status, remarks } = req.body;

        const existing = await queryOne('SELECT * FROM cat_results WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ error: 'Result not found.' });

        const userRole = (req.user?.role || '').toLowerCase().trim();
        if (userRole === 'student') {
            return res.status(403).json({ error: 'Students are not authorized to edit results.' });
        }

        if (userRole === 'teacher') {
            const teacherAccess = await getTeacherAllowedCoursesAndStudents(req);
            if (!teacherAccess) return res.status(403).json({ error: 'Unauthorized.' });
            const courseAllowed = teacherAccess.allowedCourseIds.includes(String(existing.course_id).trim());
            const studentAllowed = teacherAccess.enrolledStudentIds.has(String(existing.student_id).trim());
            if (!courseAllowed || !studentAllowed) {
                return res.status(403).json({ error: 'You are only authorized to edit results for your registered students and assigned courses.' });
            }
        }

        // Block editing approved/published results unless admin/superadmin
        if (['Approved', 'Published'].includes(existing.workflow_status) &&
            !['admin', 'superadmin'].includes(userRole)) {
            return res.status(403).json({ error: 'Cannot edit an approved or published result.' });
        }

        const period = await queryOne('SELECT * FROM cat_periods WHERE id = ?', [existing.cat_period_id]);
        const maxMarks = period?.max_marks || 100;

        let percentage = existing.percentage;
        let grade = existing.grade;

        if (marks !== undefined && marks !== null && marks !== '') {
            const m = parseFloat(marks);
            if (isNaN(m) || m < 0 || m > maxMarks) {
                return res.status(400).json({ error: `Marks must be 0–${maxMarks}.` });
            }
            percentage = Math.round((m / maxMarks) * 100 * 10) / 10;
            grade = calcGrade(percentage);
        }

        await run(
            `UPDATE cat_results SET marks=?, percentage=?, grade=?, status=?,
             remarks=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [
                marks !== undefined && marks !== '' ? parseFloat(marks) : existing.marks,
                percentage, grade,
                status ?? existing.status,
                remarks !== undefined ? remarks : existing.remarks,
                id
            ]
        );

        await writeAuditLog({
            result_id: parseInt(id), student_id: existing.student_id,
            unit_name: existing.unit_name, cat_period_id: existing.cat_period_id,
            action: 'updated', previous_marks: existing.marks, new_marks: marks ? parseFloat(marks) : existing.marks,
            previous_status: existing.workflow_status, new_status: existing.workflow_status,
            changed_by: req.user?.email || req.user?.id, changed_by_name: req.user?.name,
            reason: req.body.reason
        });

        const updated = await queryOne('SELECT * FROM cat_results WHERE id = ?', [id]);
        return res.json(updated);
    } catch (err) {
        logger.error({ err }, 'updateResult error');
        return res.status(500).json({ error: 'Failed to update result.' });
    }
}

/**
 * POST /cat-results/:id/submit — Trainer submits Draft → Submitted
 */
export async function submitResult(req, res) {
    return updateWorkflowStatus(req, res, 'Draft', 'Submitted', 'submitted');
}

/**
 * POST /cat-results/:id/approve — Admin approves Submitted → Approved
 */
export async function approveResult(req, res) {
    return updateWorkflowStatus(req, res, 'Submitted', 'Approved', 'approved');
}

/**
 * POST /cat-results/:id/publish — Admin publishes Approved → Published
 */
export async function publishResult(req, res) {
    return updateWorkflowStatus(req, res, 'Approved', 'Published', 'published');
}

async function updateWorkflowStatus(req, res, fromStatus, toStatus, actionName) {
    try {
        const { id } = req.params;
        const existing = await queryOne('SELECT * FROM cat_results WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ error: 'Result not found.' });

        const userRole = (req.user?.role || '').toLowerCase().trim();
        if (userRole === 'student') {
            return res.status(403).json({ error: 'Students are not authorized to change result status.' });
        }

        if (userRole === 'teacher') {
            const teacherAccess = await getTeacherAllowedCoursesAndStudents(req);
            if (!teacherAccess) return res.status(403).json({ error: 'Unauthorized.' });
            const courseAllowed = teacherAccess.allowedCourseIds.includes(String(existing.course_id).trim());
            const studentAllowed = teacherAccess.enrolledStudentIds.has(String(existing.student_id).trim());
            if (!courseAllowed || !studentAllowed) {
                return res.status(403).json({ error: 'You are only authorized to manage results for your registered students and assigned courses.' });
            }
        }

        if (existing.workflow_status !== fromStatus) {
            return res.status(400).json({
                error: `Result must be in "${fromStatus}" status to ${actionName}. Current status: ${existing.workflow_status}.`
            });
        }

        const now = new Date().toISOString();
        const changedBy = req.user?.email || req.user?.id;

        let extraFields = '';
        let extraParams = [];

        if (toStatus === 'Submitted') {
            extraFields = ', submitted_at = ?';
            extraParams = [now];
        } else if (toStatus === 'Approved') {
            extraFields = ', approved_at = ?, approved_by = ?';
            extraParams = [now, changedBy];
        } else if (toStatus === 'Published') {
            extraFields = ', published_at = ?, published_by = ?';
            extraParams = [now, changedBy];
        }

        await run(
            `UPDATE cat_results SET workflow_status = ?${extraFields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [toStatus, ...extraParams, id]
        );

        await writeAuditLog({
            result_id: parseInt(id), student_id: existing.student_id,
            unit_name: existing.unit_name, cat_period_id: existing.cat_period_id,
            action: actionName, previous_status: fromStatus, new_status: toStatus,
            changed_by: changedBy, changed_by_name: req.user?.name
        });

        const updated = await queryOne('SELECT * FROM cat_results WHERE id = ?', [id]);
        return res.json({ message: `Result ${actionName} successfully.`, result: updated });
    } catch (err) {
        logger.error({ err }, `${actionName} result error`);
        return res.status(500).json({ error: `Failed to ${actionName} result.` });
    }
}

/**
 * POST /cat-results/bulk-submit — Submit all Draft results for a period+course
 */
export async function bulkSubmitResults(req, res) {
    try {
        const userRole = (req.user?.role || '').toLowerCase().trim();
        if (userRole === 'student') return res.status(403).json({ error: 'Students cannot submit results.' });

        const { cat_period_id, course_id, unit_id } = req.body;
        if (!cat_period_id) return res.status(400).json({ error: 'cat_period_id is required.' });

        let sql = `UPDATE cat_results SET workflow_status='Submitted', submitted_at=CURRENT_TIMESTAMP,
                   updated_at=CURRENT_TIMESTAMP WHERE workflow_status='Draft' AND cat_period_id=?`;
        const params = [cat_period_id];
        if (course_id) { sql += ' AND course_id=?'; params.push(course_id); }
        if (unit_id)   { sql += ' AND unit_id=?';   params.push(unit_id); }

        if (userRole === 'teacher') {
            const teacherAccess = await getTeacherAllowedCoursesAndStudents(req);
            if (!teacherAccess || teacherAccess.allowedCourseIds.length === 0) {
                return res.json({ message: '0 result(s) submitted.', changes: 0 });
            }
            const coursePlaceholders = teacherAccess.allowedCourseIds.map(() => '?').join(',');
            sql += ` AND course_id IN (${coursePlaceholders})`;
            params.push(...teacherAccess.allowedCourseIds);

            const enrolledArr = Array.from(teacherAccess.enrolledStudentIds);
            if (enrolledArr.length === 0) return res.json({ message: '0 result(s) submitted.', changes: 0 });
            const studentPlaceholders = enrolledArr.map(() => '?').join(',');
            sql += ` AND LOWER(TRIM(student_id)) IN (${studentPlaceholders})`;
            params.push(...enrolledArr.map(id => id.toLowerCase()));
        }

        const result = await run(sql, params);
        return res.json({ message: `${result.changes || 0} result(s) submitted.`, changes: result.changes });
    } catch (err) {
        logger.error({ err }, 'bulkSubmitResults error');
        return res.status(500).json({ error: 'Failed to bulk-submit results.' });
    }
}

/**
 * POST /cat-results/bulk-approve — Approve all Submitted results for a period+course
 */
export async function bulkApproveResults(req, res) {
    try {
        const { cat_period_id, course_id } = req.body;
        if (!cat_period_id) return res.status(400).json({ error: 'cat_period_id is required.' });

        const changedBy = req.user?.email || req.user?.id;
        let sql = `UPDATE cat_results SET workflow_status='Approved', approved_at=CURRENT_TIMESTAMP,
                   approved_by=?, updated_at=CURRENT_TIMESTAMP WHERE workflow_status='Submitted' AND cat_period_id=?`;
        const params = [changedBy, cat_period_id];
        if (course_id) { sql += ' AND course_id=?'; params.push(course_id); }

        const result = await run(sql, params);
        return res.json({ message: `${result.changes || 0} result(s) approved.`, changes: result.changes });
    } catch (err) {
        logger.error({ err }, 'bulkApproveResults error');
        return res.status(500).json({ error: 'Failed to bulk-approve results.' });
    }
}

/**
 * POST /cat-results/bulk-publish — Publish all Approved results for a period+course
 */
export async function bulkPublishResults(req, res) {
    try {
        const { cat_period_id, course_id } = req.body;
        if (!cat_period_id) return res.status(400).json({ error: 'cat_period_id is required.' });

        const changedBy = req.user?.email || req.user?.id;
        let sql = `UPDATE cat_results SET workflow_status='Published', published_at=CURRENT_TIMESTAMP,
                   published_by=?, updated_at=CURRENT_TIMESTAMP WHERE workflow_status='Approved' AND cat_period_id=?`;
        const params = [changedBy, cat_period_id];
        if (course_id) { sql += ' AND course_id=?'; params.push(course_id); }

        const result = await run(sql, params);
        return res.json({ message: `${result.changes || 0} result(s) published.`, changes: result.changes });
    } catch (err) {
        logger.error({ err }, 'bulkPublishResults error');
        return res.status(500).json({ error: 'Failed to bulk-publish results.' });
    }
}

/**
 * DELETE /cat-results/:id — Delete a Draft result
 */
export async function deleteResult(req, res) {
    try {
        const { id } = req.params;
        const userRole = (req.user?.role || '').toLowerCase().trim();
        if (userRole === 'student') return res.status(403).json({ error: 'Students cannot delete results.' });

        const existing = await queryOne('SELECT * FROM cat_results WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ error: 'Result not found.' });

        if (userRole === 'teacher') {
            const teacherAccess = await getTeacherAllowedCoursesAndStudents(req);
            if (!teacherAccess) return res.status(403).json({ error: 'Unauthorized.' });
            const courseAllowed = teacherAccess.allowedCourseIds.includes(String(existing.course_id).trim());
            const studentAllowed = teacherAccess.enrolledStudentIds.has(String(existing.student_id).trim());
            if (!courseAllowed || !studentAllowed) {
                return res.status(403).json({ error: 'You are only authorized to delete results for your registered students and assigned courses.' });
            }
        }

        // Only superadmin can delete published results
        if (existing.workflow_status === 'Published' && userRole !== 'superadmin') {
            return res.status(403).json({ error: 'Only Super Administrators can delete published results.' });
        }

        await run('DELETE FROM cat_results WHERE id = ?', [id]);
        await writeAuditLog({
            result_id: parseInt(id), student_id: existing.student_id,
            unit_name: existing.unit_name, cat_period_id: existing.cat_period_id,
            action: 'deleted', previous_marks: existing.marks, previous_status: existing.workflow_status,
            changed_by: req.user?.email || req.user?.id, changed_by_name: req.user?.name,
            reason: req.body?.reason
        });

        return res.json({ message: 'Result deleted.' });
    } catch (err) {
        logger.error({ err }, 'deleteResult error');
        return res.status(500).json({ error: 'Failed to delete result.' });
    }
}

/**
 * GET /cat-results/stats — Dashboard statistics
 */
export async function getResultStats(req, res) {
    try {
        const userRole = (req.user?.role || '').toLowerCase().trim();
        const { cat_period_id, course_id } = req.query;
        let baseCondition = 'WHERE 1=1';
        const params = [];

        if (userRole === 'student') {
            const sId = await resolveStudentId(req);
            if (!sId) {
                return res.json({
                    total: 0, gradeBreakdown: [], workflowBreakdown: [], avgPercentage: 0, passRate: { passed: 0, failed: 0, total: 0 }
                });
            }
            baseCondition += ' AND (LOWER(TRIM(cr.student_id)) = LOWER(TRIM(?)) OR cr.student_id = ?) AND cr.workflow_status = ?';
            params.push(sId, sId, 'Published');
        } else if (userRole === 'teacher') {
            const teacherAccess = await getTeacherAllowedCoursesAndStudents(req);
            if (!teacherAccess || teacherAccess.allowedCourseIds.length === 0) {
                return res.json({
                    total: 0, gradeBreakdown: [], workflowBreakdown: [], avgPercentage: 0, passRate: { passed: 0, failed: 0, total: 0 }
                });
            }
            const coursePlaceholders = teacherAccess.allowedCourseIds.map(() => '?').join(',');
            baseCondition += ` AND cr.course_id IN (${coursePlaceholders})`;
            params.push(...teacherAccess.allowedCourseIds);

            const enrolledArr = Array.from(teacherAccess.enrolledStudentIds);
            if (enrolledArr.length === 0) {
                return res.json({
                    total: 0, gradeBreakdown: [], workflowBreakdown: [], avgPercentage: 0, passRate: { passed: 0, failed: 0, total: 0 }
                });
            }
            const studentPlaceholders = enrolledArr.map(() => '?').join(',');
            baseCondition += ` AND LOWER(TRIM(cr.student_id)) IN (${studentPlaceholders})`;
            params.push(...enrolledArr.map(id => id.toLowerCase()));
        }

        if (cat_period_id) { baseCondition += ' AND cr.cat_period_id = ?'; params.push(cat_period_id); }
        if (course_id)     { baseCondition += ' AND cr.course_id = ?';     params.push(course_id); }

        const totalResults = await queryOne(
            `SELECT COUNT(*) as cnt FROM cat_results cr ${baseCondition}`, params
        );

        const gradeBreakdown = await query(
            `SELECT grade, COUNT(*) as cnt FROM cat_results cr ${baseCondition} AND grade IS NOT NULL GROUP BY grade`, params
        );

        const workflowBreakdown = await query(
            `SELECT workflow_status, COUNT(*) as cnt FROM cat_results cr ${baseCondition} GROUP BY workflow_status`, params
        );

        const avgPercentage = await queryOne(
            `SELECT AVG(percentage) as avg_pct FROM cat_results cr ${baseCondition} AND percentage IS NOT NULL`, params
        );

        const passRate = await queryOne(
            `SELECT
               COUNT(CASE WHEN grade IN ('Distinction','Credit','Pass') THEN 1 END) as passed,
               COUNT(CASE WHEN grade = 'Fail' THEN 1 END) as failed,
               COUNT(*) as total
             FROM cat_results cr ${baseCondition} AND grade IS NOT NULL`, params
        );

        return res.json({
            total: totalResults?.cnt || 0,
            gradeBreakdown: gradeBreakdown || [],
            workflowBreakdown: workflowBreakdown || [],
            avgPercentage: Math.round((avgPercentage?.avg_pct || 0) * 10) / 10,
            passRate: passRate || { passed: 0, failed: 0, total: 0 }
        });
    } catch (err) {
        logger.error({ err }, 'getResultStats error');
        return res.status(500).json({ error: 'Failed to fetch result statistics.' });
    }
}

/**
 * GET /cat-results/audit-log — Result change history
 */
export async function getResultAuditLog(req, res) {
    try {
        const userRole = (req.user?.role || '').toLowerCase().trim();
        const { student_id, cat_period_id, limit = 100 } = req.query;
        let sql = 'SELECT * FROM result_audit_logs WHERE 1=1';
        const params = [];

        if (userRole === 'student') {
            const sId = await resolveStudentId(req);
            sql += ' AND (LOWER(TRIM(student_id)) = LOWER(TRIM(?)) OR student_id = ?)';
            params.push(sId, sId);
        } else if (userRole === 'teacher') {
            const teacherAccess = await getTeacherAllowedCoursesAndStudents(req);
            const enrolledArr = teacherAccess ? Array.from(teacherAccess.enrolledStudentIds) : [];
            if (enrolledArr.length === 0) return res.json([]);
            const placeholders = enrolledArr.map(() => '?').join(',');
            sql += ` AND LOWER(TRIM(student_id)) IN (${placeholders})`;
            params.push(...enrolledArr.map(id => id.toLowerCase()));
        }

        if (student_id && userRole !== 'student') { sql += ' AND student_id = ?'; params.push(student_id); }
        if (cat_period_id) { sql += ' AND cat_period_id = ?'; params.push(cat_period_id); }

        sql += ` ORDER BY created_at DESC LIMIT ${parseInt(limit) || 100}`;
        const logs = await query(sql, params);
        return res.json(logs || []);
    } catch (err) {
        logger.error({ err }, 'getResultAuditLog error');
        return res.status(500).json({ error: 'Failed to fetch audit logs.' });
    }
}
