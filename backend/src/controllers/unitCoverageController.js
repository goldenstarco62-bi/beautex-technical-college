/**
 * Unit Coverage Controller
 * Manages curriculum delivery tracking: teachers mark units as covered,
 * students confirm whether units were taught, admins monitor progress.
 */
import { query, run, queryOne } from '../config/database.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Write a notification to the notifications table.
 */
async function pushNotification({ user_id, title, content, type = 'info', priority = 'medium' }) {
    try {
        await run(
            `INSERT INTO notifications (user_id, title, content, type, priority) VALUES (?, ?, ?, ?, ?)`,
            [user_id || null, title, content, type, priority]
        );
    } catch (e) {
        console.warn('⚠️ pushNotification error:', e.message);
    }
}

/**
 * Simple similarity: returns true if two strings share >60% of words (case-insensitive).
 * Used server-side to detect potential duplicate unit names within the same course.
 */
function isSimilarName(a, b) {
    const norm = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const an = norm(a);
    const bn = norm(b);
    if (an === bn) return true;
    // Substring containment
    if (an.includes(bn) || bn.includes(an)) return true;
    // Token overlap (>50%)
    const ta = new Set(an.split(/\s+/));
    const tb = new Set(bn.split(/\s+/));
    const intersection = [...ta].filter(w => tb.has(w)).length;
    const union = new Set([...ta, ...tb]).size;
    return union > 0 && (intersection / union) >= 0.5;
}

/**
 * Get students enrolled in a course (by course name match).
 */
async function getEnrolledStudents(courseId) {
    try {
        const course = await queryOne('SELECT name FROM courses WHERE id = ?', [courseId]);
        if (!course) return [];
        const students = await query(
            `SELECT id, name FROM students WHERE LOWER(course) = LOWER(?) AND status = 'Active'`,
            [course.name]
        );
        return students;
    } catch (e) {
        console.warn('getEnrolledStudents error:', e.message);
        return [];
    }
}

/**
 * Get active academic period label.
 */
async function getActivePeriodLabel() {
    try {
        const p = await queryOne(`SELECT name FROM academic_periods WHERE is_active = 1 LIMIT 1`, []);
        return p?.name || null;
    } catch {
        return null;
    }
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * GET /api/unit-coverage/courses/:courseId
 * Returns all units for the course with:
 *  - latest coverage log (if any)
 *  - confirmation stats (Yes/Partially/No counts)
 */
export async function getCourseCoverage(req, res) {
    try {
        const { courseId } = req.params;
        const course = await queryOne('SELECT * FROM courses WHERE id = ?', [courseId]);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        const units = await query(
            `SELECT * FROM course_units WHERE course_id = ? AND (is_archived = 0 OR is_archived IS NULL) ORDER BY sort_order ASC, id ASC`,
            [courseId]
        );

        // For each unit, fetch latest coverage log and confirmation stats
        const enriched = await Promise.all(units.map(async (unit) => {
            const log = await queryOne(
                `SELECT * FROM unit_coverage_logs WHERE unit_id = ? ORDER BY created_at DESC LIMIT 1`,
                [unit.id]
            );
            let stats = { yes: 0, partially: 0, no: 0, total: 0 };
            if (log) {
                const confirmations = await query(
                    `SELECT response, COUNT(*) as cnt FROM unit_coverage_confirmations WHERE coverage_log_id = ? GROUP BY response`,
                    [log.id]
                );
                confirmations.forEach(c => {
                    const key = c.response.toLowerCase();
                    stats[key] = parseInt(c.cnt) || 0;
                });
                stats.total = stats.yes + stats.partially + stats.no;
            }
            return { ...unit, coverage_log: log || null, confirmation_stats: stats };
        }));

        res.json({ course, units: enriched });
    } catch (error) {
        console.error('getCourseCoverage error:', error);
        res.status(500).json({ error: 'Failed to fetch course coverage' });
    }
}

/**
 * POST /api/unit-coverage/mark
 * Teacher marks a unit as covered.
 *
 * Body: {
 *   course_id, unit_id?, unit_name?, description?, expected_duration?,
 *   unit_remarks?, remarks?, material_urls?, force_create?
 * }
 *
 * Behaviour:
 *  - If unit_id provided → use that unit directly.
 *  - If unit_name provided and unit_id omitted:
 *      → Check for existing/similar unit in course.
 *      → If similar found and force_create is falsy → return 409 with candidates.
 *      → If force_create or no match → create unit, then log coverage.
 */
export async function markUnitCovered(req, res) {
    try {
        const {
            course_id, unit_id, unit_name, description, expected_duration,
            unit_remarks, remarks, material_urls, force_create
        } = req.body;

        if (!course_id) return res.status(400).json({ error: 'course_id is required' });

        const course = await queryOne('SELECT * FROM courses WHERE id = ?', [course_id]);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        const teacher = req.user;
        let targetUnitId = unit_id ? parseInt(unit_id) : null;

        if (!targetUnitId) {
            // Need unit_name to auto-create
            if (!unit_name?.trim()) {
                return res.status(400).json({ error: 'Either unit_id or unit_name is required' });
            }

            // Check for existing units with similar name in this course
            if (!force_create) {
                const existingUnits = await query(
                    `SELECT * FROM course_units WHERE course_id = ? AND (is_archived = 0 OR is_archived IS NULL) ORDER BY sort_order ASC`,
                    [course_id]
                );
                const similar = existingUnits.filter(u => isSimilarName(u.name, unit_name.trim()));
                if (similar.length > 0) {
                    return res.status(409).json({
                        conflict: true,
                        message: 'A similar unit already exists.',
                        candidates: similar,
                        entered_name: unit_name.trim()
                    });
                }
            }

            // Create new unit
            const existingMax = await queryOne(
                'SELECT MAX(sort_order) AS max_order FROM course_units WHERE course_id = ?',
                [course_id]
            );
            const nextOrder = (existingMax?.max_order ?? -1) + 1;
            const result = await run(
                `INSERT INTO course_units (course_id, name, description, expected_duration, unit_remarks, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
                [course_id, unit_name.trim(), description || null, expected_duration || null, unit_remarks || null, nextOrder]
            );
            targetUnitId = result.lastID;
        }

        // Verify the target unit belongs to this course
        const unit = await queryOne(
            'SELECT * FROM course_units WHERE id = ? AND course_id = ?',
            [targetUnitId, course_id]
        );
        if (!unit) return res.status(404).json({ error: 'Unit not found in this course' });

        const activePeriod = await getActivePeriodLabel();
        const teacherName = teacher.name || teacher.email || 'Unknown';
        const teacherId = teacher.email || String(teacher.id);
        const now = new Date();
        const dateCovered = now.toISOString().split('T')[0];
        const timeCovered = now.toTimeString().split(' ')[0];
        const materialUrlsStr = Array.isArray(material_urls) ? JSON.stringify(material_urls) : (material_urls || null);

        const logResult = await run(
            `INSERT INTO unit_coverage_logs (course_id, unit_id, teacher_id, teacher_name, academic_period, date_covered, time_covered, remarks, material_urls) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [course_id, targetUnitId, teacherId, teacherName, activePeriod, dateCovered, timeCovered, remarks || null, materialUrlsStr]
        );

        const coverageLog = await queryOne('SELECT * FROM unit_coverage_logs WHERE id = ?', [logResult.lastID]);
        const updatedUnit = await queryOne('SELECT * FROM course_units WHERE id = ?', [targetUnitId]);

        // Notify enrolled students
        const enrolledStudents = await getEnrolledStudents(course_id);
        for (const student of enrolledStudents) {
            await pushNotification({
                user_id: student.id,
                title: `Unit Covered: ${unit.name || unit_name}`,
                content: `${teacherName} has marked "${unit.name || unit_name}" as covered in ${course.name} on ${dateCovered}.`,
                type: 'unit_covered',
                priority: 'medium'
            });
        }

        res.status(201).json({
            coverage_log: coverageLog,
            unit: updatedUnit,
            message: 'Unit marked as covered successfully'
        });
    } catch (error) {
        console.error('markUnitCovered error:', error);
        res.status(500).json({ error: 'Failed to mark unit as covered' });
    }
}

/**
 * GET /api/unit-coverage/logs
 * Returns coverage logs, filterable by course_id, teacher_id, academic_period.
 * Teachers see only their own logs. Admins see all.
 */
export async function getCoverageLogs(req, res) {
    try {
        const { course_id, teacher_id, academic_period, limit = 100 } = req.query;
        const role = (req.user?.role || '').toLowerCase();
        const isTeacher = role === 'teacher';

        let sql = `
            SELECT ucl.*, cu.name AS unit_name, c.name AS course_name
            FROM unit_coverage_logs ucl
            LEFT JOIN course_units cu ON cu.id = ucl.unit_id
            LEFT JOIN courses c ON c.id = ucl.course_id
            WHERE 1=1
        `;
        const params = [];

        if (isTeacher) {
            sql += ' AND ucl.teacher_id = ?';
            params.push(req.user.email || String(req.user.id));
        } else if (teacher_id) {
            sql += ' AND ucl.teacher_id = ?';
            params.push(teacher_id);
        }

        if (course_id) {
            sql += ' AND ucl.course_id = ?';
            params.push(course_id);
        }

        if (academic_period) {
            sql += ' AND ucl.academic_period = ?';
            params.push(academic_period);
        }

        sql += ' ORDER BY ucl.created_at DESC LIMIT ?';
        params.push(parseInt(limit));

        const logs = await query(sql, params);
        res.json(logs);
    } catch (error) {
        console.error('getCoverageLogs error:', error);
        res.status(500).json({ error: 'Failed to fetch coverage logs' });
    }
}

/**
 * GET /api/unit-coverage/analytics
 * Per-unit confirmation stats for teacher/admin analytics view.
 * Flags units where No + Partially > 30%.
 * Query params: course_id (required for teacher), teacher_id (admin only)
 */
export async function getCoverageAnalytics(req, res) {
    try {
        const { course_id } = req.query;
        const role = (req.user?.role || '').toLowerCase();
        const isTeacher = role === 'teacher';

        if (!course_id && isTeacher) {
            return res.status(400).json({ error: 'course_id is required' });
        }

        let sql = `
            SELECT
                ucl.unit_id,
                cu.name AS unit_name,
                ucl.course_id,
                c.name AS course_name,
                ucl.date_covered,
                ucl.teacher_name,
                COUNT(ucc.id) AS total_confirmations,
                SUM(CASE WHEN ucc.response = 'Yes' THEN 1 ELSE 0 END) AS yes_count,
                SUM(CASE WHEN ucc.response = 'Partially' THEN 1 ELSE 0 END) AS partially_count,
                SUM(CASE WHEN ucc.response = 'No' THEN 1 ELSE 0 END) AS no_count
            FROM unit_coverage_logs ucl
            LEFT JOIN course_units cu ON cu.id = ucl.unit_id
            LEFT JOIN courses c ON c.id = ucl.course_id
            LEFT JOIN unit_coverage_confirmations ucc ON ucc.coverage_log_id = ucl.id
            WHERE 1=1
        `;
        const params = [];

        if (course_id) {
            sql += ' AND ucl.course_id = ?';
            params.push(course_id);
        }

        if (isTeacher) {
            sql += ' AND ucl.teacher_id = ?';
            params.push(req.user.email || String(req.user.id));
        }

        sql += ' GROUP BY ucl.unit_id, cu.name, ucl.course_id, c.name, ucl.date_covered, ucl.teacher_name ORDER BY ucl.course_id, ucl.unit_id';

        const rows = await query(sql, params);

        // Compute percentages and flag
        const analytics = rows.map(row => {
            const total = parseInt(row.total_confirmations) || 0;
            const yes = parseInt(row.yes_count) || 0;
            const partially = parseInt(row.partially_count) || 0;
            const no = parseInt(row.no_count) || 0;
            const negRate = total > 0 ? ((partially + no) / total) : 0;
            return {
                ...row,
                yes_pct: total > 0 ? Math.round((yes / total) * 100) : 0,
                partially_pct: total > 0 ? Math.round((partially / total) * 100) : 0,
                no_pct: total > 0 ? Math.round((no / total) * 100) : 0,
                flagged: negRate >= 0.3 && total >= 3, // flag if ≥30% negative and at least 3 responses
            };
        });

        res.json(analytics);
    } catch (error) {
        console.error('getCoverageAnalytics error:', error);
        res.status(500).json({ error: 'Failed to fetch coverage analytics' });
    }
}

/**
 * GET /api/unit-coverage/admin
 * Admin overview: all courses with total units, covered count, % and flagged units.
 */
export async function getAdminOverview(req, res) {
    try {
        const { department } = req.query;

        let coursesSql = `SELECT * FROM courses WHERE status = 'Active'`;
        const params = [];
        if (department) {
            coursesSql += ' AND LOWER(department) = LOWER(?)';
            params.push(department);
        }
        coursesSql += ' ORDER BY name ASC';
        const courses = await query(coursesSql, params);

        const overview = await Promise.all(courses.map(async (course) => {
            const totalUnits = await queryOne(
                `SELECT COUNT(*) as cnt FROM course_units WHERE course_id = ? AND (is_archived = 0 OR is_archived IS NULL)`,
                [course.id]
            );
            const coveredUnits = await queryOne(
                `SELECT COUNT(DISTINCT unit_id) as cnt FROM unit_coverage_logs WHERE course_id = ?`,
                [course.id]
            );
            const totalConfirmations = await queryOne(
                `SELECT COUNT(*) as cnt FROM unit_coverage_confirmations ucc
                 JOIN unit_coverage_logs ucl ON ucl.id = ucc.coverage_log_id
                 WHERE ucl.course_id = ?`,
                [course.id]
            );
            const flaggedUnits = await query(
                `SELECT ucl.unit_id, cu.name AS unit_name,
                    SUM(CASE WHEN ucc.response IN ('No','Partially') THEN 1 ELSE 0 END) AS negative,
                    COUNT(ucc.id) AS total
                 FROM unit_coverage_logs ucl
                 LEFT JOIN unit_coverage_confirmations ucc ON ucc.coverage_log_id = ucl.id
                 LEFT JOIN course_units cu ON cu.id = ucl.unit_id
                 WHERE ucl.course_id = ?
                 GROUP BY ucl.unit_id, cu.name
                 HAVING total >= 3 AND (CAST(negative AS REAL) / total) >= 0.3`,
                [course.id]
            );

            const total = parseInt(totalUnits?.cnt) || 0;
            const covered = parseInt(coveredUnits?.cnt) || 0;
            return {
                course_id: course.id,
                course_name: course.name,
                department: course.department,
                total_units: total,
                covered_units: covered,
                coverage_pct: total > 0 ? Math.round((covered / total) * 100) : 0,
                total_confirmations: parseInt(totalConfirmations?.cnt) || 0,
                flagged_units: flaggedUnits,
            };
        }));

        res.json(overview);
    } catch (error) {
        console.error('getAdminOverview error:', error);
        res.status(500).json({ error: 'Failed to fetch admin overview' });
    }
}

/**
 * POST /api/unit-coverage/confirmations
 * Student submits or updates their confirmation for a covered unit.
 * Body: { coverage_log_id, response ('Yes'|'Partially'|'No'), comment? }
 * Rules: One per student per log; editable while active period is open.
 */
export async function submitConfirmation(req, res) {
    try {
        const { coverage_log_id, response, comment } = req.body;

        if (!coverage_log_id || !response) {
            return res.status(400).json({ error: 'coverage_log_id and response are required' });
        }
        if (!['Yes', 'Partially', 'No'].includes(response)) {
            return res.status(400).json({ error: 'response must be Yes, Partially, or No' });
        }

        const student = req.user;
        const studentId = student.student_id || String(student.id);
        const studentName = student.name || student.email;

        // Verify coverage log exists
        const log = await queryOne(
            `SELECT ucl.*, cu.name AS unit_name, c.name AS course_name
             FROM unit_coverage_logs ucl
             LEFT JOIN course_units cu ON cu.id = ucl.unit_id
             LEFT JOIN courses c ON c.id = ucl.course_id
             WHERE ucl.id = ?`,
            [coverage_log_id]
        );
        if (!log) return res.status(404).json({ error: 'Coverage log not found' });

        // Check if active period still allows edits
        const activePeriod = await queryOne(`SELECT id FROM academic_periods WHERE is_active = 1 LIMIT 1`, []);

        // Check for existing confirmation
        const existing = await queryOne(
            `SELECT * FROM unit_coverage_confirmations WHERE coverage_log_id = ? AND student_id = ?`,
            [coverage_log_id, studentId]
        );

        if (existing) {
            if (!activePeriod) {
                return res.status(403).json({ error: 'Cannot edit confirmation: academic period is closed' });
            }
            await run(
                `UPDATE unit_coverage_confirmations SET response = ?, comment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [response, comment || null, existing.id]
            );
        } else {
            await run(
                `INSERT INTO unit_coverage_confirmations (coverage_log_id, student_id, student_name, response, comment) VALUES (?, ?, ?, ?, ?)`,
                [coverage_log_id, studentId, studentName, response, comment || null]
            );
        }

        const saved = await queryOne(
            `SELECT * FROM unit_coverage_confirmations WHERE coverage_log_id = ? AND student_id = ?`,
            [coverage_log_id, studentId]
        );

        // Notify teacher
        await pushNotification({
            user_id: log.teacher_id,
            title: `Student Confirmation: ${log.unit_name}`,
            content: `${studentName} confirmed "${log.unit_name}" in ${log.course_name} as: ${response}.${comment ? ' Comment: ' + comment : ''}`,
            type: 'unit_confirmation',
            priority: response === 'No' ? 'high' : 'medium'
        });

        // Check if unit needs flagging (notify admins) after this update
        const stats = await query(
            `SELECT response, COUNT(*) as cnt FROM unit_coverage_confirmations WHERE coverage_log_id = ? GROUP BY response`,
            [coverage_log_id]
        );
        let totalResp = 0, negative = 0;
        stats.forEach(s => {
            const cnt = parseInt(s.cnt) || 0;
            totalResp += cnt;
            if (s.response === 'No' || s.response === 'Partially') negative += cnt;
        });
        if (totalResp >= 3 && (negative / totalResp) >= 0.3) {
            const admins = await query(`SELECT id FROM users WHERE role IN ('admin', 'superadmin') AND status = 'Active'`, []);
            for (const admin of admins) {
                await pushNotification({
                    user_id: String(admin.id),
                    title: `⚠️ Unit Flagged for Review: ${log.unit_name}`,
                    content: `${Math.round((negative / totalResp) * 100)}% of students reported "${log.unit_name}" (${log.course_name}) as not fully taught. Please review.`,
                    type: 'unit_flagged',
                    priority: 'high'
                });
            }
        }

        res.json({ confirmation: saved, message: existing ? 'Confirmation updated' : 'Confirmation submitted' });
    } catch (error) {
        console.error('submitConfirmation error:', error);
        res.status(500).json({ error: 'Failed to submit confirmation' });
    }
}

/**
 * GET /api/unit-coverage/confirmations
 * Returns confirmations.
 * Students see only their own. Teachers/admins see all (filterable by coverage_log_id, course_id).
 */
export async function getConfirmations(req, res) {
    try {
        const { coverage_log_id, course_id } = req.query;
        const role = (req.user?.role || '').toLowerCase();
        const isStudent = role === 'student';

        let sql = `
            SELECT ucc.*, ucl.course_id, ucl.unit_id, ucl.date_covered,
                   cu.name AS unit_name, c.name AS course_name
            FROM unit_coverage_confirmations ucc
            JOIN unit_coverage_logs ucl ON ucl.id = ucc.coverage_log_id
            LEFT JOIN course_units cu ON cu.id = ucl.unit_id
            LEFT JOIN courses c ON c.id = ucl.course_id
            WHERE 1=1
        `;
        const params = [];

        if (isStudent) {
            const studentId = req.user.student_id || String(req.user.id);
            sql += ' AND ucc.student_id = ?';
            params.push(studentId);
        }

        if (coverage_log_id) {
            sql += ' AND ucc.coverage_log_id = ?';
            params.push(coverage_log_id);
        }

        if (course_id) {
            sql += ' AND ucl.course_id = ?';
            params.push(course_id);
        }

        sql += ' ORDER BY ucc.updated_at DESC';

        const confirmations = await query(sql, params);
        res.json(confirmations);
    } catch (error) {
        console.error('getConfirmations error:', error);
        res.status(500).json({ error: 'Failed to fetch confirmations' });
    }
}

/**
 * GET /api/unit-coverage/student-progress
 * Returns per-course progress for the logged-in student:
 * total units, covered units, their confirmations.
 */
export async function getStudentProgress(req, res) {
    try {
        const student = req.user;
        const studentId = student.student_id || String(student.id);

        // Find student record to get their course
        const studentRecord = await queryOne('SELECT * FROM students WHERE id = ?', [studentId]);
        if (!studentRecord) return res.status(404).json({ error: 'Student not found' });

        const courseName = studentRecord.course;
        if (!courseName) return res.json([]);

        // Find course(s) matching student's enrolled course
        const enrolledCourses = await query(
            `SELECT * FROM courses WHERE LOWER(name) = LOWER(?) AND status = 'Active'`,
            [courseName]
        );

        const progress = await Promise.all(enrolledCourses.map(async (course) => {
            const allUnits = await query(
                `SELECT cu.*,
                    ucl.id AS log_id, ucl.date_covered, ucl.time_covered,
                    ucl.teacher_name, ucl.remarks AS coverage_remarks,
                    ucl.material_urls, ucl.academic_period
                 FROM course_units cu
                 LEFT JOIN unit_coverage_logs ucl ON ucl.unit_id = cu.id
                    AND ucl.course_id = cu.course_id
                    AND ucl.id = (
                        SELECT id FROM unit_coverage_logs
                        WHERE unit_id = cu.id AND course_id = cu.course_id
                        ORDER BY created_at DESC LIMIT 1
                    )
                 WHERE cu.course_id = ? AND (cu.is_archived = 0 OR cu.is_archived IS NULL)
                 ORDER BY cu.sort_order ASC, cu.id ASC`,
                [course.id]
            );

            // Get student's confirmations for this course
            const confirmations = await query(
                `SELECT ucc.* FROM unit_coverage_confirmations ucc
                 JOIN unit_coverage_logs ucl ON ucl.id = ucc.coverage_log_id
                 WHERE ucc.student_id = ? AND ucl.course_id = ?`,
                [studentId, course.id]
            );
            const confirmMap = {};
            confirmations.forEach(c => { confirmMap[c.coverage_log_id] = c; });

            const coveredCount = allUnits.filter(u => u.log_id).length;
            return {
                course_id: course.id,
                course_name: course.name,
                total_units: allUnits.length,
                covered_units: coveredCount,
                completion_pct: allUnits.length > 0 ? Math.round((coveredCount / allUnits.length) * 100) : 0,
                units: allUnits.map(u => ({
                    ...u,
                    is_covered: !!u.log_id,
                    student_confirmation: u.log_id ? (confirmMap[u.log_id] || null) : null,
                }))
            };
        }));

        res.json(progress);
    } catch (error) {
        console.error('getStudentProgress error:', error);
        res.status(500).json({ error: 'Failed to fetch student progress' });
    }
}

/**
 * PUT /api/unit-coverage/units/:unitId
 * Update a unit's metadata (name, description, duration, remarks, archive status).
 * Teachers can only edit units that have NOT yet been covered.
 */
export async function updateUnit(req, res) {
    try {
        const { unitId } = req.params;
        const { name, description, expected_duration, unit_remarks, is_archived } = req.body;
        const role = (req.user?.role || '').toLowerCase();

        const unit = await queryOne('SELECT * FROM course_units WHERE id = ?', [unitId]);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

        // Teachers cannot rename a unit that already has coverage logs
        if (role === 'teacher' && name !== undefined && name.trim() !== unit.name) {
            const hasCoverage = await queryOne(
                'SELECT id FROM unit_coverage_logs WHERE unit_id = ? LIMIT 1', [unitId]
            );
            if (hasCoverage) {
                return res.status(403).json({ error: 'Cannot rename a unit that has already been marked as covered' });
            }
        }

        await run(
            `UPDATE course_units
             SET name = ?, description = ?, expected_duration = ?, unit_remarks = ?,
                 is_archived = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
                name?.trim() ?? unit.name,
                description !== undefined ? description : unit.description,
                expected_duration !== undefined ? expected_duration : unit.expected_duration,
                unit_remarks !== undefined ? unit_remarks : unit.unit_remarks,
                is_archived !== undefined ? (is_archived ? 1 : 0) : unit.is_archived,
                unitId
            ]
        );

        const updated = await queryOne('SELECT * FROM course_units WHERE id = ?', [unitId]);
        res.json(updated);
    } catch (error) {
        console.error('updateUnit error:', error);
        res.status(500).json({ error: 'Failed to update unit' });
    }
}
