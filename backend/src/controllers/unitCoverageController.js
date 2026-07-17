/**
 * Unit Coverage Controller — Per-Student, Intake-Aware
 * Teachers mark specific units as covered for individual students (or in batch).
 * Students confirm whether units were taught. Admins monitor per-student progress.
 */
import { query, run, queryOne } from '../config/database.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function isSimilarName(a, b) {
    const norm = s => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const an = norm(a);
    const bn = norm(b);
    if (an === bn) return true;
    if (an.includes(bn) || bn.includes(an)) return true;
    const ta = new Set(an.split(/\s+/));
    const tb = new Set(bn.split(/\s+/));
    const intersection = [...ta].filter(w => tb.has(w)).length;
    const union = new Set([...ta, ...tb]).size;
    return union > 0 && (intersection / union) >= 0.5;
}

async function getActivePeriodLabel() {
    try {
        const p = await queryOne(`SELECT name FROM academic_periods WHERE is_active = true LIMIT 1`, []);
        return p?.name || null;
    } catch {
        return null;
    }
}

function normaliseCourseField(raw) {
    if (!raw) return [];
    if (typeof raw === 'string' && raw.startsWith('{') && raw.endsWith('}')) {
        return raw.slice(1, -1).split(',').map(s => s.replace(/^"|"$/g, '').trim()).filter(Boolean);
    }
    if (typeof raw === 'string' && raw.startsWith('[')) {
        try {
            const p = JSON.parse(raw);
            return Array.isArray(p) ? p.map(s => s.trim()) : [String(p).trim()];
        } catch (e) {
            // fallback
        }
    }
    return [String(raw).trim()].filter(Boolean);
}

/**
 * Get all students enrolled in a course (by course name match), returning id, name, intake.
 */
async function getEnrolledStudents(courseId) {
    try {
        const course = await queryOne('SELECT name FROM courses WHERE id = ?', [courseId]);
        if (!course) return [];
        const courseLC = course.name.toLowerCase().trim();
        
        const allStudents = await query(
            `SELECT id, name, intake, course FROM students WHERE status = 'Active'`,
            []
        );
        
        const matchedStudents = allStudents.filter(s => 
            normaliseCourseField(s.course).some(c => c.toLowerCase().trim() === courseLC)
        );
        
        return matchedStudents.map(s => ({
            id: s.id,
            name: s.name,
            intake: s.intake
        })).sort((a, b) => {
            const intA = a.intake || '';
            const intB = b.intake || '';
            if (intA !== intB) return intA.localeCompare(intB);
            return a.name.localeCompare(b.name);
        });
    } catch (e) {
        console.warn('getEnrolledStudents error:', e.message);
        return [];
    }
}

// ── Endpoints ─────────────────────────────────────────────────────────────────

/**
 * GET /api/unit-coverage/courses/:courseId
 * Returns all units with per-student coverage status.
 * Query params:
 *   student_id — filter to a specific student's coverage view
 *
 * Response:
 *   { course, units, students }
 *   - units: each unit annotated with coverage_log for the requested student (or latest if none specified)
 *   - students: list of enrolled students with their individual progress stats
 */
export async function getCourseCoverage(req, res) {
    try {
        const { courseId } = req.params;
        const { student_id } = req.query;

        const course = await queryOne('SELECT * FROM courses WHERE id = ?', [courseId]);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        const units = await query(
            `SELECT * FROM course_units WHERE course_id = ? AND (is_archived IS NOT TRUE) ORDER BY sort_order ASC, id ASC`,
            [courseId]
        );

        // Get all enrolled students for this course
        const enrolledStudents = await getEnrolledStudents(courseId);

        // Build per-student coverage maps
        // Map: student_id -> Set of covered unit_ids
        const studentCoverageMaps = {};
        if (enrolledStudents.length > 0) {
            const allLogs = await query(
                `SELECT student_id, unit_id, id, date_covered, teacher_name FROM unit_coverage_logs
                 WHERE course_id = ? AND student_id IS NOT NULL ORDER BY created_at DESC`,
                [courseId]
            );
            for (const log of allLogs) {
                if (!studentCoverageMaps[log.student_id]) {
                    studentCoverageMaps[log.student_id] = {};
                }
                // Only keep the latest log per unit per student
                if (!studentCoverageMaps[log.student_id][log.unit_id]) {
                    studentCoverageMaps[log.student_id][log.unit_id] = log;
                }
            }
        }

        // Build students list with progress stats
        const studentsWithProgress = enrolledStudents.map(s => {
            const coverage = studentCoverageMaps[s.id] || {};
            const coveredCount = Object.keys(coverage).length;
            const total = units.length;
            return {
                ...s,
                covered_units: coveredCount,
                total_units: total,
                completion_pct: total > 0 ? Math.round((coveredCount / total) * 100) : 0,
            };
        });

        // Enrich units — if a specific student_id is requested, show their coverage per unit
        // Otherwise show summary (how many students covered each unit)
        const enriched = await Promise.all(units.map(async (unit) => {
            let coverageLog = null;
            let confirmationStats = { yes: 0, partially: 0, no: 0, total: 0 };
            let studentsWhoHaveCovered = 0;

            if (student_id) {
                // Single student view: get their specific log for this unit
                coverageLog = await queryOne(
                    `SELECT * FROM unit_coverage_logs WHERE unit_id = ? AND course_id = ? AND student_id = ? ORDER BY created_at DESC LIMIT 1`,
                    [unit.id, courseId, student_id]
                );
            } else {
                // Summary view: how many students have this unit covered
                const countResult = await queryOne(
                    `SELECT COUNT(DISTINCT student_id) as cnt FROM unit_coverage_logs WHERE unit_id = ? AND course_id = ? AND student_id IS NOT NULL`,
                    [unit.id, courseId]
                );
                studentsWhoHaveCovered = parseInt(countResult?.cnt) || 0;
                // Also get the latest log for display purposes (course-wide)
                coverageLog = await queryOne(
                    `SELECT * FROM unit_coverage_logs WHERE unit_id = ? AND course_id = ? ORDER BY created_at DESC LIMIT 1`,
                    [unit.id, courseId]
                );
            }

            // Confirmation stats (for teacher analytics)
            if (coverageLog) {
                const confirmations = await query(
                    `SELECT response, COUNT(*) as cnt FROM unit_coverage_confirmations WHERE coverage_log_id = ? GROUP BY response`,
                    [coverageLog.id]
                );
                confirmations.forEach(c => {
                    const key = c.response.toLowerCase();
                    confirmationStats[key] = parseInt(c.cnt) || 0;
                });
                confirmationStats.total = confirmationStats.yes + confirmationStats.partially + confirmationStats.no;
            }

            return {
                ...unit,
                coverage_log: coverageLog || null,
                confirmation_stats: confirmationStats,
                students_covered_count: studentsWhoHaveCovered,
                total_enrolled: enrolledStudents.length,
            };
        }));

        res.json({ course, units: enriched, students: studentsWithProgress });
    } catch (error) {
        console.error('getCourseCoverage error:', error);
        res.status(500).json({ error: 'Failed to fetch course coverage' });
    }
}

/**
 * POST /api/unit-coverage/mark
 * Teacher marks a unit as covered for one or more specific students.
 *
 * Body: {
 *   course_id, unit_id?, unit_name?, description?, expected_duration?,
 *   unit_remarks?, remarks?, material_urls?,
 *   student_ids: string[],   <-- REQUIRED: array of student IDs
 *   force_create?: boolean
 * }
 */
export async function markUnitCovered(req, res) {
    try {
        const {
            course_id, unit_id, unit_name, description, expected_duration,
            unit_remarks, remarks, material_urls, force_create, student_ids
        } = req.body;

        if (!course_id) return res.status(400).json({ error: 'course_id is required' });
        if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
            return res.status(400).json({ error: 'student_ids array is required and must not be empty' });
        }

        const course = await queryOne('SELECT * FROM courses WHERE id = ?', [course_id]);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        const teacher = req.user;
        let targetUnitId = unit_id ? parseInt(unit_id) : null;

        if (!targetUnitId) {
            if (!unit_name?.trim()) {
                return res.status(400).json({ error: 'Either unit_id or unit_name is required' });
            }

            // Duplicate detection
            if (!force_create) {
                const existingUnits = await query(
                    `SELECT * FROM course_units WHERE course_id = ? AND (is_archived IS NOT TRUE) ORDER BY sort_order ASC`,
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

        const results = [];
        const skipped = [];

        for (const studentId of student_ids) {
            // Verify student exists
            const student = await queryOne('SELECT id, name FROM students WHERE id = ?', [studentId]);
            if (!student) {
                skipped.push({ student_id: studentId, reason: 'Student not found' });
                continue;
            }

            // Check for existing coverage log for this student + unit
            const existing = await queryOne(
                `SELECT id FROM unit_coverage_logs WHERE unit_id = ? AND course_id = ? AND student_id = ?`,
                [targetUnitId, course_id, studentId]
            );

            if (existing) {
                skipped.push({ student_id: studentId, student_name: student.name, reason: 'Already covered' });
                continue;
            }

            const logResult = await run(
                `INSERT INTO unit_coverage_logs (course_id, unit_id, student_id, teacher_id, teacher_name, academic_period, date_covered, time_covered, remarks, material_urls) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [course_id, targetUnitId, studentId, teacherId, teacherName, activePeriod, dateCovered, timeCovered, remarks || null, materialUrlsStr]
            );

            results.push({ student_id: studentId, student_name: student.name, log_id: logResult.lastID });

            // Notify each student
            await pushNotification({
                user_id: student.id,
                title: `Unit Covered: ${unit.name}`,
                content: `${teacherName} has marked "${unit.name}" as covered in ${course.name} on ${dateCovered}.`,
                type: 'unit_covered',
                priority: 'medium'
            });
        }

        res.status(201).json({
            unit,
            marked: results,
            skipped,
            message: `Unit marked as covered for ${results.length} student(s). ${skipped.length} skipped.`
        });
    } catch (error) {
        console.error('markUnitCovered error:', error);
        res.status(500).json({ error: 'Failed to mark unit as covered' });
    }
}

/**
 * DELETE /api/unit-coverage/logs/:logId
 * Teacher/admin deletes (unmarks) a unit coverage log for a student.
 */
export async function deleteCoverageLog(req, res) {
    try {
        const { logId } = req.params;
        const log = await queryOne('SELECT * FROM unit_coverage_logs WHERE id = ?', [logId]);
        if (!log) return res.status(404).json({ error: 'Coverage log not found' });

        // Delete confirmations first (cascade should handle it, but be explicit)
        await run('DELETE FROM unit_coverage_confirmations WHERE coverage_log_id = ?', [logId]);
        await run('DELETE FROM unit_coverage_logs WHERE id = ?', [logId]);

        res.json({ message: 'Coverage log deleted successfully' });
    } catch (error) {
        console.error('deleteCoverageLog error:', error);
        res.status(500).json({ error: 'Failed to delete coverage log' });
    }
}

/**
 * GET /api/unit-coverage/logs
 * Returns coverage logs, filterable by course_id, student_id, teacher_id, academic_period.
 */
export async function getCoverageLogs(req, res) {
    try {
        const { course_id, teacher_id, student_id, academic_period, limit = 200 } = req.query;
        const role = (req.user?.role || '').toLowerCase();
        const isTeacher = role === 'teacher';

        let sql = `
            SELECT ucl.*, cu.name AS unit_name, c.name AS course_name,
                   s.name AS student_name, s.intake AS student_intake
            FROM unit_coverage_logs ucl
            LEFT JOIN course_units cu ON cu.id = ucl.unit_id
            LEFT JOIN courses c ON c.id = ucl.course_id
            LEFT JOIN students s ON s.id = ucl.student_id
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

        if (course_id) { sql += ' AND ucl.course_id = ?'; params.push(course_id); }
        if (student_id) { sql += ' AND ucl.student_id = ?'; params.push(student_id); }
        if (academic_period) { sql += ' AND ucl.academic_period = ?'; params.push(academic_period); }

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
 * Per-unit confirmation stats for teacher analytics.
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
                ucl.student_id,
                s.name AS student_name,
                s.intake AS student_intake,
                COUNT(ucc.id) AS total_confirmations,
                SUM(CASE WHEN ucc.response = 'Yes' THEN 1 ELSE 0 END) AS yes_count,
                SUM(CASE WHEN ucc.response = 'Partially' THEN 1 ELSE 0 END) AS partially_count,
                SUM(CASE WHEN ucc.response = 'No' THEN 1 ELSE 0 END) AS no_count
            FROM unit_coverage_logs ucl
            LEFT JOIN course_units cu ON cu.id = ucl.unit_id
            LEFT JOIN courses c ON c.id = ucl.course_id
            LEFT JOIN unit_coverage_confirmations ucc ON ucc.coverage_log_id = ucl.id
            LEFT JOIN students s ON s.id = ucl.student_id
            WHERE 1=1
        `;
        const params = [];

        if (course_id) { sql += ' AND ucl.course_id = ?'; params.push(course_id); }
        if (isTeacher) {
            sql += ' AND ucl.teacher_id = ?';
            params.push(req.user.email || String(req.user.id));
        }

        sql += ' GROUP BY ucl.unit_id, cu.name, ucl.course_id, c.name, ucl.date_covered, ucl.teacher_name, ucl.student_id, s.name, s.intake ORDER BY ucl.course_id, ucl.unit_id';

        const rows = await query(sql, params);

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
                flagged: negRate >= 0.3 && total >= 3,
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
 * Admin overview: all courses with total units, per-student coverage stats.
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
                `SELECT COUNT(*) as cnt FROM course_units WHERE course_id = ? AND (is_archived IS NOT TRUE)`,
                [course.id]
            );
            // Count distinct students who have at least one covered unit
            const studentsWithCoverage = await queryOne(
                `SELECT COUNT(DISTINCT student_id) as cnt FROM unit_coverage_logs WHERE course_id = ? AND student_id IS NOT NULL`,
                [course.id]
            );
            const totalConfirmations = await queryOne(
                `SELECT COUNT(*) as cnt FROM unit_coverage_confirmations ucc
                 JOIN unit_coverage_logs ucl ON ucl.id = ucc.coverage_log_id
                 WHERE ucl.course_id = ?`,
                [course.id]
            );

            // Enrolled students count
            const enrolledCount = await queryOne(
                `SELECT COUNT(*) as cnt FROM students WHERE LOWER(course) = LOWER(?) AND status = 'Active'`,
                [course.name]
            );

            const total = parseInt(totalUnits?.cnt) || 0;
            return {
                course_id: course.id,
                course_name: course.name,
                department: course.department,
                total_units: total,
                enrolled_students: parseInt(enrolledCount?.cnt) || 0,
                students_with_coverage: parseInt(studentsWithCoverage?.cnt) || 0,
                total_confirmations: parseInt(totalConfirmations?.cnt) || 0,
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
        let studentId = student.student_id;
        if (!studentId) {
            const profile = await queryOne('SELECT id FROM students WHERE LOWER(email) = LOWER(?)', [student.email]);
            studentId = profile ? profile.id : String(student.id);
        }
        const studentName = student.name || student.email;

        // Verify coverage log exists and belongs to this student
        const log = await queryOne(
            `SELECT ucl.*, cu.name AS unit_name, c.name AS course_name
             FROM unit_coverage_logs ucl
             LEFT JOIN course_units cu ON cu.id = ucl.unit_id
             LEFT JOIN courses c ON c.id = ucl.course_id
             WHERE ucl.id = ? AND ucl.student_id = ?`,
            [coverage_log_id, studentId]
        );
        if (!log) return res.status(404).json({ error: 'Coverage log not found or does not belong to you' });

        const activePeriod = await queryOne(`SELECT id FROM academic_periods WHERE is_active = true LIMIT 1`, []);

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

        // Flag check
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
                    title: `⚠️ Unit Flagged: ${log.unit_name}`,
                    content: `${Math.round((negative / totalResp) * 100)}% of students reported "${log.unit_name}" (${log.course_name}) as not fully taught.`,
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
 * Returns confirmations. Students see only their own.
 */
export async function getConfirmations(req, res) {
    try {
        const { coverage_log_id, course_id, student_id } = req.query;
        const role = (req.user?.role || '').toLowerCase();
        const isStudent = role === 'student';

        let sql = `
            SELECT ucc.*, ucl.course_id, ucl.unit_id, ucl.date_covered, ucl.student_id AS log_student_id,
                   cu.name AS unit_name, c.name AS course_name
            FROM unit_coverage_confirmations ucc
            JOIN unit_coverage_logs ucl ON ucl.id = ucc.coverage_log_id
            LEFT JOIN course_units cu ON cu.id = ucl.unit_id
            LEFT JOIN courses c ON c.id = ucl.course_id
            WHERE 1=1
        `;
        const params = [];

        if (isStudent) {
            let sid = req.user.student_id;
            if (!sid) {
                const profile = await queryOne('SELECT id FROM students WHERE LOWER(email) = LOWER(?)', [req.user.email]);
                sid = profile ? profile.id : String(req.user.id);
            }
            sql += ' AND ucc.student_id = ?';
            params.push(sid);
        } else if (student_id) {
            sql += ' AND ucc.student_id = ?';
            params.push(student_id);
        }

        if (coverage_log_id) { sql += ' AND ucc.coverage_log_id = ?'; params.push(coverage_log_id); }
        if (course_id) { sql += ' AND ucl.course_id = ?'; params.push(course_id); }

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
 * Per-course progress for the logged-in student, based on their specific coverage logs.
 */
export async function getStudentProgress(req, res) {
    try {
        const student = req.user;
        let studentId = student.student_id;
        if (!studentId) {
            const profile = await queryOne('SELECT id FROM students WHERE LOWER(email) = LOWER(?)', [student.email]);
            studentId = profile ? profile.id : String(student.id);
        }

        const studentRecord = await queryOne('SELECT * FROM students WHERE id = ?', [studentId]);
        if (!studentRecord) return res.status(404).json({ error: 'Student not found' });

        const studentCourses = normaliseCourseField(studentRecord.course);
        if (studentCourses.length === 0) return res.json([]);

        // Get all courses from courses table that match the student's courses (case-insensitive)
        const placeholders = studentCourses.map(() => 'LOWER(?)').join(',');
        const enrolledCourses = await query(
            `SELECT * FROM courses WHERE LOWER(name) IN (${placeholders}) AND status = 'Active'`,
            studentCourses.map(c => c.toLowerCase().trim())
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
                    AND ucl.student_id = ?
                    AND ucl.id = (
                        SELECT id FROM unit_coverage_logs
                        WHERE unit_id = cu.id AND course_id = cu.course_id AND student_id = ?
                        ORDER BY created_at DESC LIMIT 1
                    )
                 WHERE cu.course_id = ? AND (cu.is_archived IS NOT TRUE)
                 ORDER BY cu.sort_order ASC, cu.id ASC`,
                [studentId, studentId, course.id]
            );

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
 * Update a unit's metadata.
 */
export async function updateUnit(req, res) {
    try {
        const { unitId } = req.params;
        const { name, description, expected_duration, unit_remarks, is_archived } = req.body;
        const role = (req.user?.role || '').toLowerCase();

        const unit = await queryOne('SELECT * FROM course_units WHERE id = ?', [unitId]);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

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
                is_archived !== undefined ? (is_archived ? true : false) : (unit.is_archived ? true : false),
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
