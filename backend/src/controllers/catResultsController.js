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

    // id is required below for the trainer_unit_assignments merge — without it, teachers
    // assigned units via trainer assignments silently get no course credit and 403.
    const faculty = await queryOne('SELECT id, name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [userEmail]);
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

    // Also include courses from trainer_unit_assignments
    if (faculty?.id) {
        const tuaRows = await query('SELECT DISTINCT course_id FROM trainer_unit_assignments WHERE faculty_id = ?', [faculty.id]);
        for (const tr of tuaRows) {
            const cId = String(tr.course_id);
            if (!allowedCourseIds.includes(cId)) {
                allowedCourseIds.push(cId);
                const cObj = allCourses.find(c => String(c.id) === cId);
                if (cObj?.name) {
                    allowedCourseNames.push(String(cObj.name).toLowerCase().trim());
                }
            }
        }
    }

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
            return sc.some(cn =>
                allowedCourseNames.includes(cn) ||
                allowedCourseIds.map(x => x.toLowerCase()).includes(cn) ||
                allowedCourseNames.some(acn => acn.includes(cn) || cn.includes(acn))
            );
        }).map(s => String(s.id).trim())
    );

    return {
        allowedCourseIds,
        allowedCourseNames,
        enrolledStudentIds
    };
}

// ── Offering-scoped access ────────────────────────────────────────────────────
// An offering is one lecturer teaching one unit to one group, so write access is
// derived from the offering rather than from the coarse course-level assignment above.
async function getTeacherFaculty(req) {
    const email = String(req.user?.email || '').toLowerCase().trim();
    if (!email) return null;
    return queryOne('SELECT id, name FROM faculty WHERE LOWER(email) = LOWER(?)', [email]);
}

// students.course stores an ordered list; the first entry is the main registered course.
function parseStudentCourseList(raw) {
    if (!raw) return [];
    const s = String(raw).trim();
    let names = [];
    if (s.startsWith('[')) { try { names = JSON.parse(s).map(x => String(x)); } catch (e) { names = []; } }
    else if (s.startsWith('{') && s.endsWith('}')) names = s.slice(1, -1).split(',');
    else names = s.split(',');
    return names.map(n => String(n).replace(/"/g, '').trim()).filter(Boolean);
}

async function resolveStudentCourseId(studentId) {
    const st = await queryOne('SELECT course FROM students WHERE id = ?', [studentId]);
    const names = parseStudentCourseList(st?.course).map(n => n.toLowerCase());
    if (!names.length) return null;

    const courses = await query('SELECT id, name FROM courses');
    const hit = courses.find(c => names.includes(String(c.name || '').toLowerCase().trim()));
    return hit ? String(hit.id) : null;
}

/**
 * Validate that the caller may write marks against this offering, and that the student
 * belongs to it. Returns { offering, roster } — roster is null for a single-student call.
 */
async function checkOfferingWriteAccess(req, offeringId, studentId) {
    const offering = await queryOne('SELECT * FROM unit_offerings WHERE id = ?', [offeringId]);
    if (!offering) return { error: { status: 404, message: 'Offering not found.' } };
    if (offering.status !== 'Active') return { error: { status: 403, message: `"${offering.offering_name}" is not an active offering.` } };

    const role = (req.user?.role || '').toLowerCase().trim();
    if (role === 'teacher') {
        const faculty = await getTeacherFaculty(req);
        if (!faculty || String(offering.faculty_id || '') !== String(faculty.id || '')) {
            return { error: { status: 403, message: 'You can only enter marks for offerings you lecture.' } };
        }
    }

    if (studentId !== undefined) {
        const onRoster = await queryOne(
            'SELECT 1 AS ok FROM offering_students WHERE offering_id = ? AND student_id = ?',
            [offeringId, studentId]
        );
        if (!onRoster) return { error: { status: 403, message: 'This student is not on the roster of that offering.' } };
        return { offering };
    }

    const rows = await query('SELECT student_id FROM offering_students WHERE offering_id = ?', [offeringId]);
    return { offering, roster: new Set((rows || []).map(r => String(r.student_id).trim())) };
}

// The single-entry form sends course+unit only, never an offering_id. A teacher whose access
// to a common unit comes purely from an offering would fail the course-level gate, so match
// their Active offering for this unit that lists the student on its roster.
async function resolveTeacherOffering(req, unitId, studentId) {
    if (!unitId || !studentId) return null;
    const faculty = await getTeacherFaculty(req);
    if (!faculty) return null;
    return await queryOne(
        `SELECT uo.* FROM unit_offerings uo
         JOIN offering_students os ON os.offering_id = uo.id AND os.student_id = ?
         WHERE uo.faculty_id = ? AND uo.unit_id = ? AND uo.status = 'Active'
         LIMIT 1`,
        [studentId, faculty.id, unitId]
    );
}

// Row-level gate for update/submit/delete: lecturing the row's offering authorizes the
// teacher even when that row's course is outside their own course list.
async function canManageResultRow(req, row) {
    if (row.offering_id) {
        const faculty = await getTeacherFaculty(req);
        if (faculty) {
            const owns = await queryOne(
                'SELECT 1 AS ok FROM unit_offerings WHERE id = ? AND faculty_id = ?',
                [row.offering_id, faculty.id]
            );
            if (owns) return true;
        }
    }
    // Legacy rows carry no offering_id; a common-unit lecturer should still manage a row whose
    // student sits on the roster of one of their Active offerings for that unit.
    if (row.unit_id && await resolveTeacherOffering(req, row.unit_id, row.student_id)) return true;
    const teacherAccess = await getTeacherAllowedCoursesAndStudents(req);
    if (!teacherAccess) return false;
    return teacherAccess.allowedCourseIds.includes(String(row.course_id).trim())
        && teacherAccess.enrolledStudentIds.has(String(row.student_id).trim());
}

// Combined teacher scope for set-based operations: assigned course+student rows OR any row
// belonging to an offering they lecture.
async function getTeacherScope(req) {
    const teacherAccess = await getTeacherAllowedCoursesAndStudents(req);
    const faculty = await getTeacherFaculty(req);
    const offeringIds = faculty
        ? (await query('SELECT id FROM unit_offerings WHERE faculty_id = ?', [faculty.id])).map(r => Number(r.id))
        : [];
    return {
        courseIds: teacherAccess?.allowedCourseIds || [],
        students: teacherAccess ? Array.from(teacherAccess.enrolledStudentIds) : [],
        offeringIds
    };
}

/**
 * GET /cat-results — List results with role-based filtering
 * Query params: period_id, course_id, unit_id, student_id, workflow_status
 */
export async function getResults(req, res) {
    try {
        const userRole = (req.user?.role || '').toLowerCase().trim();
        const { period_id, course_id, unit_id, student_id, workflow_status, offering_id } = req.query;

        let sql = `
            SELECT cr.*, cp.cat_name, cp.academic_year, cp.term_name, cp.max_marks as period_max_marks,
                   s.name as student_name, s.id as student_reg_id, s.course as student_courses_raw,
                   c.name as course_name, COALESCE(gu.unit_name, cu.name, cr.unit_name) as unit_display_name,
                   gu.unit_code as unit_display_code,
                   o.group_label AS offering_group, o.faculty_name AS offering_faculty_name, o.course_id AS offering_course_id
            FROM cat_results cr
            LEFT JOIN cat_periods cp ON cr.cat_period_id = cp.id
            LEFT JOIN students s ON cr.student_id = s.id
            LEFT JOIN courses c ON cr.course_id = c.id
            LEFT JOIN global_units gu ON cr.unit_id = gu.id
            LEFT JOIN course_units cu ON cr.unit_id = cu.id
            LEFT JOIN unit_offerings o ON o.id = cr.offering_id
            WHERE 1=1
        `;
        const params = [];

        if (userRole === 'student') {
            // Students see every mark filed against them as soon as a trainer uploads it,
            // regardless of Draft/Submitted/Approved/Published — but only rows that actually
            // carry a mark (never-filled placeholder drafts stay hidden).
            const sId = await resolveStudentId(req);
            if (!sId) return res.json([]);
            sql += ' AND (LOWER(TRIM(cr.student_id)) = LOWER(TRIM(?)) OR cr.student_id = ?) AND cr.marks IS NOT NULL';
            params.push(sId, sId);
        } else if (userRole === 'teacher') {
            // A teacher sees their assigned courses plus every row of offerings they lecture —
            // cross-course offerings are not covered by course-level assignment.
            const teacherAccess = await getTeacherAllowedCoursesAndStudents(req);
            const faculty = await getTeacherFaculty(req);
            const myOfferingIds = faculty
                ? (await query('SELECT id FROM unit_offerings WHERE faculty_id = ?', [faculty.id])).map(r => Number(r.id))
                : [];

            const courseIds = teacherAccess?.allowedCourseIds || [];
            const courseNames = teacherAccess?.allowedCourseNames || [];
            if (!courseIds.length && !myOfferingIds.length) return res.json([]);

            const clauses = [];
            const clauseParams = [];
            if (courseIds.length) {
                clauses.push(`cr.course_id IN (${courseIds.map(() => '?').join(',')})`);
                clauseParams.push(...courseIds);
            }
            if (courseNames.length) {
                clauses.push(`LOWER(TRIM(c.name)) IN (${courseNames.map(() => '?').join(',')})`);
                clauseParams.push(...courseNames);
            }
            if (myOfferingIds.length) {
                clauses.push(`cr.offering_id IN (${myOfferingIds.map(() => '?').join(',')})`);
                clauseParams.push(...myOfferingIds);
            }
            sql += ` AND (${clauses.join(' OR ')})`;
            params.push(...clauseParams);

            if (student_id) { sql += ' AND cr.student_id = ?'; params.push(student_id); }
            if (workflow_status) { sql += ' AND cr.workflow_status = ?'; params.push(workflow_status); }
        } else {
            // Admins/superadmins see all
            if (student_id) { sql += ' AND cr.student_id = ?'; params.push(student_id); }
            if (workflow_status) { sql += ' AND cr.workflow_status = ?'; params.push(workflow_status); }
        }

        if (period_id)   { sql += ' AND cr.cat_period_id = ?';  params.push(period_id); }
        if (course_id)   { sql += ' AND cr.course_id = ?';      params.push(course_id); }
        if (unit_id)     { sql += ' AND cr.unit_id = ?';        params.push(unit_id); }
        if (offering_id) { sql += ' AND cr.offering_id = ?';    params.push(offering_id); }

        sql += ' ORDER BY cr.created_at DESC';

        const results = await query(sql, params);
        for (const r of results || []) {
            const courseList = parseStudentCourseList(r.student_courses_raw);
            r.student_main_course = courseList[0] || null;
            r.student_course_list = courseList;
            // Legacy rows can carry a course_id that no longer exists; the student's own
            // registration is the fallback the UI shows so the course column is never blank.
            if (!r.course_name) r.course_name = r.student_main_course || null;
            delete r.student_courses_raw;
        }
        return res.json(results || []);
    } catch (err) {
        logger.error({ err }, 'getResults error');
        return res.status(500).json({ error: 'Failed to fetch results.' });
    }
}

/**
 * Locate the row a new mark should write to. Offering-keyed entries match on the offering, but
 * legacy rows (same student + unit + period, no offering yet) are adopted into the offering instead
 * of being re-inserted — the legacy UNIQUE(student_id, unit_id, cat_period_id) forbids a second row.
 */
async function findResultTarget({ offering, studentId, courseId, unitId, unitName, catPeriodId }) {
    if (offering) {
        const byOffering = await queryOne(
            'SELECT id, workflow_status FROM cat_results WHERE student_id=? AND offering_id=? AND cat_period_id=?',
            [studentId, offering.id, catPeriodId]
        );
        if (byOffering) return { existing: byOffering, adopt: null };
        const unitKey = offering.unit_id || unitId;
        if (unitKey) {
            const legacy = await queryOne(
                'SELECT id, workflow_status FROM cat_results WHERE student_id=? AND unit_id=? AND cat_period_id=? AND offering_id IS NULL',
                [studentId, unitKey, catPeriodId]
            );
            if (legacy) return { existing: legacy, adopt: { offering_id: offering.id, unit_id: unitKey } };
        }
        return { existing: null, adopt: null };
    }

    const existing = unitId
        ? await queryOne(
            'SELECT id, workflow_status FROM cat_results WHERE student_id=? AND course_id=? AND unit_id=? AND cat_period_id=?',
            [studentId, courseId, unitId, catPeriodId]
        )
        : await queryOne(
            'SELECT id, workflow_status FROM cat_results WHERE student_id=? AND course_id=? AND unit_name=? AND cat_period_id=?',
            [studentId, courseId, unitName, catPeriodId]
        );
    return { existing, adopt: null };
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
            student_id, course_id, unit_id, unit_name, offering_id,
            cat_period_id, marks, status, remarks
        } = req.body;

        if (!student_id || !cat_period_id || !unit_name) {
            return res.status(400).json({ error: 'student_id, cat_period_id and unit_name are required.' });
        }
        // Marks must be tied to a real unit (directly or via an offering) — no more
        // free-text "general assessment" rows.
        if (!unit_id) {
            return res.status(400).json({ error: 'A unit is required — select the unit this mark belongs to.' });
        }

        // Offering-driven entry: the offering decides the course and the permission, so a
        // common unit taught across courses works without touching course-level rules.
        let offering = null;
        if (offering_id) {
            const access = await checkOfferingWriteAccess(req, offering_id, student_id);
            if (access.error) return res.status(access.error.status).json({ error: access.error.message });
            offering = access.offering;
        } else if (userRole === 'teacher') {
            offering = await resolveTeacherOffering(req, unit_id, student_id);
        }

        const effectiveCourseId = String(
            course_id || offering?.course_id || (await resolveStudentCourseId(student_id)) || ''
        ).trim();
        if (!effectiveCourseId) {
            return res.status(400).json({ error: 'course_id is required (or pass an offering_id / give the student a course).' });
        }

        if (userRole === 'teacher' && !offering) {
            const teacherAccess = await getTeacherAllowedCoursesAndStudents(req);
            if (!teacherAccess) {
                return res.status(403).json({ error: 'Teacher profile not found or unauthorized.' });
            }
            const studentIdStr = String(student_id).trim();
            const courseAllowed = teacherAccess.allowedCourseIds.includes(effectiveCourseId);
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
        let trainerName = req.body.trainer_name || offering?.faculty_name || null;
        if (!trainerName) {
            if (userRole === 'teacher' && req.user?.name) {
                trainerName = req.user.name;
            } else {
                if (unit_id) {
                    const assigned = await queryOne(
                        `SELECT f.name FROM trainer_unit_assignments tua
                         JOIN faculty f ON f.id = tua.faculty_id
                         WHERE tua.course_id = ? AND tua.unit_id = ? LIMIT 1`,
                        [effectiveCourseId, unit_id]
                    );
                    if (assigned?.name) trainerName = assigned.name;
                }
                if (!trainerName) {
                    const cRow = await queryOne('SELECT instructor FROM courses WHERE id = ?', [effectiveCourseId]);
                    trainerName = cRow?.instructor || req.user?.name || req.user?.email || 'Instructor';
                }
            }
        }

        try {
            // Check if result already exists for this student in this period and unit.
            // Offering-keyed entries match on the offering; otherwise the match is by course
            // plus (unit_id, or the unit_name label when no unit was chosen) — course_id must
            // be part of it because units are shared across courses.
            const { existing, adopt } = await findResultTarget({
                offering, studentId: student_id, courseId: effectiveCourseId, unitId: unit_id, unitName: unit_name, catPeriodId: cat_period_id
            });

            if (existing) {
                // Only allow updating Draft/Submitted, not Approved/Published
                if (['Approved', 'Published'].includes(existing.workflow_status)) {
                    return res.status(403).json({ error: 'Result is already approved or published and cannot be modified.' });
                }
                await run(
                    `UPDATE cat_results SET marks=?, percentage=?, grade=?, status=?,
                     remarks=?, entered_by=?, trainer_name=?, updated_at=CURRENT_TIMESTAMP
                     ${adopt ? ', offering_id=?, unit_id=COALESCE(unit_id, ?)' : ''}
                     WHERE id=?`,
                    [
                        marks !== '' && marks !== null && marks !== undefined ? parseFloat(marks) : null,
                        percentage, grade, status || 'Present',
                        remarks || null, enteredBy, trainerName,
                        ...(adopt ? [adopt.offering_id, adopt.unit_id] : []),
                        existing.id
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
                 (student_id, course_id, unit_id, unit_name, offering_id, cat_period_id,
                  marks, percentage, grade, status, workflow_status,
                  entered_by, trainer_name, remarks)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?)`,
                [
                    student_id, effectiveCourseId, unit_id || offering?.unit_id || null, unit_name, offering?.id || null, cat_period_id,
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
 * POST /cat-results/batch — Batch entry for a class or an offering
 * Body: { cat_period_id, offering_id?, course_id?, unit_id?, unit_name, entries: [{ student_id, marks, status, remarks }] }
 */
export async function batchCreateResults(req, res) {
    try {
        const userRole = (req.user?.role || '').toLowerCase().trim();
        if (userRole === 'student') {
            return res.status(403).json({ error: 'Students are not authorized to create results.' });
        }

        const { cat_period_id, course_id, unit_id, unit_name, offering_id, entries } = req.body;

        if (!cat_period_id || !unit_name || !Array.isArray(entries)) {
            return res.status(400).json({ error: 'cat_period_id, unit_name and entries[] are required.' });
        }

        // Offering-scoped batch: roster + lecturer ownership replace the course-level gate,
        // which is what lets one common unit be marked per group across different courses.
        let offering = null;
        let offeringRoster = null;
        let teacherAccess = null;

        if (offering_id) {
            const access = await checkOfferingWriteAccess(req, offering_id);
            if (access.error) return res.status(access.error.status).json({ error: access.error.message });
            offering = access.offering;
            offeringRoster = access.roster;
            if (offeringRoster.size === 0) {
                return res.status(400).json({ error: 'This offering has no students yet. Add the roster before entering marks.' });
            }
        } else if (!course_id) {
            return res.status(400).json({ error: 'course_id or offering_id is required.' });
        } else if (userRole === 'teacher') {
            teacherAccess = await getTeacherAllowedCoursesAndStudents(req);
            if (!teacherAccess || !teacherAccess.allowedCourseIds.includes(String(course_id).trim())) {
                return res.status(403).json({ error: 'You are only authorized to enter results for your assigned courses.' });
            }
        }

        // Marks must be tied to a real unit (directly, or through the offering's unit) —
        // no more free-text "general assessment" batch rows.
        if (!unit_id && !offering?.unit_id) {
            return res.status(400).json({ error: 'A unit is required — select the unit these marks belong to.' });
        }

        const period = await queryOne('SELECT * FROM cat_periods WHERE id = ?', [cat_period_id]);
        if (!period) return res.status(404).json({ error: 'CAT period not found.' });

        const enteredBy = req.user?.email || req.user?.id;
        let defaultTrainerName = req.body.trainer_name || offering?.faculty_name || null;
        if (!defaultTrainerName) {
            if (userRole === 'teacher' && req.user?.name) {
                defaultTrainerName = req.user.name;
            } else {
                if (unit_id) {
                    const assigned = await queryOne(
                        `SELECT f.name FROM trainer_unit_assignments tua
                         JOIN faculty f ON f.id = tua.faculty_id
                         WHERE tua.course_id = ? AND tua.unit_id = ? LIMIT 1`,
                        [course_id || offering?.course_id, unit_id]
                    );
                    if (assigned?.name) defaultTrainerName = assigned.name;
                }
                if (!defaultTrainerName) {
                    const cRow = await queryOne('SELECT instructor FROM courses WHERE id = ?', [course_id || offering?.course_id]);
                    defaultTrainerName = cRow?.instructor || req.user?.name || req.user?.email || 'Instructor';
                }
            }
        }
        const trainerName = defaultTrainerName;
        const maxMarks = period.max_marks || 100;
        const batchCourseId = course_id || offering?.course_id || null;

        const saved = [];
        const errors = [];

        for (const entry of entries) {
            const { student_id, marks, status, remarks } = entry;
            if (!student_id) continue;

            if (offeringRoster && !offeringRoster.has(String(student_id).trim())) {
                const st = await queryOne('SELECT name FROM students WHERE id = ?', [student_id]);
                errors.push({ student_id, student_name: st?.name || student_id, error: 'Student is not on the roster of this offering.' });
                continue;
            }

            if (teacherAccess && !teacherAccess.enrolledStudentIds.has(String(student_id).trim())) {
                const st = await queryOne('SELECT name FROM students WHERE id = ?', [student_id]);
                errors.push({ student_id, student_name: st?.name || student_id, error: 'Student is not registered in your assigned course.' });
                continue;
            }

            // A cross-course offering has no course of its own: each student's row is filed
            // under the course that student actually studies.
            const entryCourseId = batchCourseId || await resolveStudentCourseId(student_id);
            if (!entryCourseId) {
                const st = await queryOne('SELECT name FROM students WHERE id = ?', [student_id]);
                errors.push({ student_id, student_name: st?.name || student_id, error: 'Could not resolve a course for this student — assign them to a course or use a course-scoped offering.' });
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
                // Upsert: offering-keyed rows match on the offering; otherwise student +
                // course + (unit_id, or unit_name when no unit was chosen).
                const { existing, adopt } = await findResultTarget({
                    offering, studentId: student_id, courseId: entryCourseId, unitId: unit_id, unitName: unit_name, catPeriodId: cat_period_id
                });

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
                         ${adopt ? ', offering_id=?, unit_id=COALESCE(unit_id, ?)' : ''}
                         WHERE id=?`,
                        [
                            marks !== '' && marks !== null && marks !== undefined ? parseFloat(marks) : null,
                            percentage, grade, status || 'Present',
                            remarks || null, enteredBy, trainerName,
                            ...(adopt ? [adopt.offering_id, adopt.unit_id] : []),
                            existing.id
                        ]
                    );
                    await writeAuditLog({ result_id: existing.id, student_id, unit_name, cat_period_id,
                        action: 'updated (batch)', new_marks: marks !== '' && marks !== null && marks !== undefined ? parseFloat(marks) : null,
                        new_status: existing.workflow_status, changed_by: enteredBy, changed_by_name: trainerName });
                    saved.push(existing.id);
                } else {
                    const result = await run(
                        `INSERT INTO cat_results (student_id, course_id, unit_id, unit_name, offering_id, cat_period_id,
                          marks, percentage, grade, status, workflow_status, entered_by, trainer_name, remarks)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Draft', ?, ?, ?)`,
                        [
                            student_id, entryCourseId, unit_id || offering?.unit_id || null, unit_name, offering?.id || null, cat_period_id,
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

        if (userRole === 'teacher' && !(await canManageResultRow(req, existing))) {
            return res.status(403).json({ error: 'You are only authorized to edit results for your registered students and assigned courses.' });
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

        if (userRole === 'teacher' && !(await canManageResultRow(req, existing))) {
            return res.status(403).json({ error: 'You are only authorized to manage results for your registered students and assigned courses.' });
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
            const scope = await getTeacherScope(req);
            const orParts = [];
            const orParams = [];
            if (scope.courseIds.length && scope.students.length) {
                orParts.push(`(course_id IN (${scope.courseIds.map(() => '?').join(',')}) AND LOWER(TRIM(student_id)) IN (${scope.students.map(() => '?').join(',')}))`);
                orParams.push(...scope.courseIds, ...scope.students.map(id => id.toLowerCase()));
            }
            if (scope.offeringIds.length) {
                orParts.push(`offering_id IN (${scope.offeringIds.map(() => '?').join(',')})`);
                orParams.push(...scope.offeringIds);
            }
            if (!orParts.length) return res.json({ message: '0 result(s) submitted.', changes: 0 });
            sql += ` AND (${orParts.join(' OR ')})`;
            params.push(...orParams);
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

        if (userRole === 'teacher' && !(await canManageResultRow(req, existing))) {
            return res.status(403).json({ error: 'You are only authorized to delete results for your registered students and assigned courses.' });
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
            const emptyStats = { total: 0, gradeBreakdown: [], workflowBreakdown: [], avgPercentage: 0, passRate: { passed: 0, failed: 0, total: 0 } };
            const scope = await getTeacherScope(req);
            const orParts = [];
            const orParams = [];
            if (scope.courseIds.length && scope.students.length) {
                orParts.push(`(cr.course_id IN (${scope.courseIds.map(() => '?').join(',')}) AND LOWER(TRIM(cr.student_id)) IN (${scope.students.map(() => '?').join(',')}))`);
                orParams.push(...scope.courseIds, ...scope.students.map(id => id.toLowerCase()));
            }
            if (scope.offeringIds.length) {
                orParts.push(`cr.offering_id IN (${scope.offeringIds.map(() => '?').join(',')})`);
                orParams.push(...scope.offeringIds);
            }
            if (!orParts.length) return res.json(emptyStats);
            baseCondition += ` AND (${orParts.join(' OR ')})`;
            params.push(...orParams);
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
