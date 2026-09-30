/**
 * Course Unit Controller
 * Manages global master units and their course assignments.
 * Units exist independently of courses; they can be assigned/unassigned.
 * Historical records (marks, coverage) remain intact when units are renamed or deactivated.
 */
import { query, run, queryOne, getActiveDbEngine } from '../config/database.js';

// Predefined units for Computer Packages courses
const COMPUTER_PACKAGES_UNITS = [
    'Introduction to Computers',
    'Microsoft Windows',
    'Keyboarding & Typing Skills',
    'Microsoft Word',
    'Microsoft Excel',
    'Microsoft PowerPoint',
    'Microsoft Access',
    'Microsoft Outlook',
    'Microsoft Publisher',
    'Internet & Digital Literacy',
];

// Helper: Check if course name matches Computer Packages
function isComputerPackagesCourse(name = '') {
    return name.toLowerCase().includes('computer package');
}

// Helper: placeholder for DB engine-aware queries
function placeholder(i) {
    return getActiveDbEngine() === 'postgres' ? `$${i}` : '?';
}

// ── MASTER UNIT ENDPOINTS ─────────────────────────────────────────────────────

/**
 * GET /api/units
 * Returns all master units (optionally filtered by status or search).
 */
export async function getAllUnits(req, res) {
    try {
        const { status, search, course_id } = req.query;
        const engine = getActiveDbEngine();
        const isPg = engine === 'postgres';

        let sql = 'SELECT * FROM course_units WHERE (course_id IS NULL OR course_id = \'\'  OR course_id IS NOT NULL)';
        // Return all master units regardless of course_id assignment
        sql = 'SELECT cu.* FROM course_units cu WHERE 1=1';
        const params = [];

        if (status) {
            sql += isPg ? ` AND cu.status = $${params.length + 1}` : ' AND cu.status = ?';
            params.push(status);
        }
        if (search) {
            const term = `%${search}%`;
            if (isPg) {
                sql += ` AND (cu.name ILIKE $${params.length + 1} OR cu.code ILIKE $${params.length + 2})`;
                params.push(term, term);
            } else {
                sql += ' AND (cu.name LIKE ? OR cu.code LIKE ?)';
                params.push(term, term);
            }
        }

        sql += ' ORDER BY cu.name ASC';

        const units = await query(sql, params);

        // For each unit, attach the list of courses it is assigned to
        const enriched = await Promise.all(units.map(async (u) => {
            let assignedCourses = [];
            try {
                const assignments = await query(
                    `SELECT cua.course_id, c.name AS course_name
                     FROM course_unit_assignments cua
                     LEFT JOIN courses c ON c.id = cua.course_id
                     WHERE cua.unit_id = ${isPg ? '$1' : '?'}
                     ORDER BY c.name ASC`,
                    [u.id]
                );
                assignedCourses = assignments;

                // Also include courses where unit was added the old way (course_id on course_units)
                if (u.course_id) {
                    const alreadyListed = assignedCourses.some(a => a.course_id === u.course_id);
                    if (!alreadyListed) {
                        const c = await queryOne(`SELECT id, name FROM courses WHERE id = ${isPg ? '$1' : '?'}`, [u.course_id]);
                        if (c) assignedCourses.push({ course_id: c.id, course_name: c.name });
                    }
                }
            } catch (_) { /* table may not exist yet */ }
            return { ...u, assigned_courses: assignedCourses };
        }));

        res.json(enriched);
    } catch (error) {
        console.error('getAllUnits error:', error);
        res.status(500).json({ error: 'Failed to fetch units' });
    }
}

/**
 * POST /api/units
 * Creates a new master unit (not yet assigned to any course).
 */
export async function createUnit(req, res) {
    try {
        const { name, code, description, status = 'Active' } = req.body;

        if (!name?.trim()) return res.status(400).json({ error: 'Unit name is required' });

        const engine = getActiveDbEngine();
        const isPg = engine === 'postgres';

        // Check for duplicate name
        const existing = await queryOne(
            isPg
                ? 'SELECT id FROM course_units WHERE LOWER(name) = LOWER($1)'
                : 'SELECT id FROM course_units WHERE LOWER(name) = LOWER(?)',
            [name.trim()]
        );
        if (existing) return res.status(409).json({ error: 'A unit with this name already exists. Please choose a different name.' });

        let result;
        if (isPg) {
            result = await query(
                'INSERT INTO course_units (name, code, description, status, sort_order, course_id) VALUES ($1, $2, $3, $4, 0, NULL) RETURNING *',
                [name.trim(), code?.trim() || null, description?.trim() || null, status]
            );
            res.status(201).json(result.rows[0]);
        } else {
            result = await run(
                "INSERT INTO course_units (name, code, description, status, sort_order) VALUES (?, ?, ?, ?, 0)",
                [name.trim(), code?.trim() || null, description?.trim() || null, status]
            );
            const unit = await queryOne('SELECT * FROM course_units WHERE id = ?', [result.lastID]);
            res.status(201).json(unit);
        }
    } catch (error) {
        console.error('createUnit error:', error);
        res.status(500).json({ error: 'Failed to create unit' });
    }
}

/**
 * PUT /api/units/:unitId
 * Updates unit name, code, description, or status.
 * Existing student records stay connected via unit_id (safe rename).
 */
export async function updateUnit(req, res) {
    try {
        const { unitId } = req.params;
        const { name, code, description, status } = req.body;

        const engine = getActiveDbEngine();
        const isPg = engine === 'postgres';

        const unit = await queryOne(
            isPg ? 'SELECT * FROM course_units WHERE id = $1' : 'SELECT * FROM course_units WHERE id = ?',
            [unitId]
        );
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

        const updatedName = name?.trim() ?? unit.name;
        const updatedCode = code !== undefined ? (code?.trim() || null) : unit.code;
        const updatedDesc = description !== undefined ? (description?.trim() || null) : unit.description;
        const updatedStatus = status ?? unit.status ?? 'Active';

        if (isPg) {
            await query(
                'UPDATE course_units SET name = $1, code = $2, description = $3, status = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5',
                [updatedName, updatedCode, updatedDesc, updatedStatus, unitId]
            );
            const updated = await queryOne('SELECT * FROM course_units WHERE id = $1', [unitId]);
            res.json(updated);
        } else {
            await run(
                'UPDATE course_units SET name = ?, code = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [updatedName, updatedCode, updatedDesc, updatedStatus, unitId]
            );
            const updated = await queryOne('SELECT * FROM course_units WHERE id = ?', [unitId]);
            res.json(updated);
        }
    } catch (error) {
        console.error('updateUnit error:', error);
        res.status(500).json({ error: 'Failed to update unit' });
    }
}

/**
 * DELETE /api/units/:unitId
 * Deletes a unit only if it has no associated student records or coverage.
 * Otherwise returns 409 and suggests deactivating instead.
 */
export async function deleteUnit(req, res) {
    try {
        const { unitId } = req.params;
        const engine = getActiveDbEngine();
        const isPg = engine === 'postgres';
        const ph = (i) => isPg ? `$${i}` : '?';

        const unit = await queryOne(
            `SELECT * FROM course_units WHERE id = ${ph(1)}`, [unitId]
        );
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

        // Check for historical records
        const markCount = await queryOne(
            `SELECT COUNT(*) AS cnt FROM student_unit_marks WHERE unit_id = ${ph(1)}`, [unitId]
        );
        const coverageCount = await queryOne(
            `SELECT COUNT(*) AS cnt FROM unit_coverage_logs WHERE unit_id = ${ph(1)}`, [unitId]
        );
        const catCount = await queryOne(
            `SELECT COUNT(*) AS cnt FROM cat_results WHERE unit_id = ${ph(1)}`, [unitId]
        );

        const total = (parseInt(markCount?.cnt) || 0) + (parseInt(coverageCount?.cnt) || 0) + (parseInt(catCount?.cnt) || 0);
        if (total > 0) {
            return res.status(409).json({
                error: `Cannot delete: this unit has ${total} associated student record(s). Deactivate it instead to preserve historical data.`,
                hasData: true,
                counts: {
                    marks: parseInt(markCount?.cnt) || 0,
                    coverage: parseInt(coverageCount?.cnt) || 0,
                    cat: parseInt(catCount?.cnt) || 0,
                }
            });
        }

        await run(`DELETE FROM course_unit_assignments WHERE unit_id = ${ph(1)}`, [unitId]);
        await run(`DELETE FROM course_units WHERE id = ${ph(1)}`, [unitId]);
        res.json({ message: 'Unit deleted successfully' });
    } catch (error) {
        console.error('deleteUnit error:', error);
        res.status(500).json({ error: 'Failed to delete unit' });
    }
}

/**
 * PATCH /api/units/:unitId/status
 * Toggle unit Active/Inactive status.
 */
export async function toggleUnitStatus(req, res) {
    try {
        const { unitId } = req.params;
        const { status } = req.body; // 'Active' or 'Inactive'
        const engine = getActiveDbEngine();
        const isPg = engine === 'postgres';
        const ph = (i) => isPg ? `$${i}` : '?';

        if (!['Active', 'Inactive'].includes(status)) {
            return res.status(400).json({ error: 'Status must be Active or Inactive' });
        }

        const unit = await queryOne(`SELECT * FROM course_units WHERE id = ${ph(1)}`, [unitId]);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

        if (isPg) {
            await query(
                `UPDATE course_units SET status = ${ph(1)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${ph(2)}`,
                [status, unitId]
            );
            const updated = await queryOne(`SELECT * FROM course_units WHERE id = ${ph(1)}`, [unitId]);
            res.json(updated);
        } else {
            await run(
                `UPDATE course_units SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [status, unitId]
            );
            const updated = await queryOne('SELECT * FROM course_units WHERE id = ?', [unitId]);
            res.json(updated);
        }
    } catch (error) {
        console.error('toggleUnitStatus error:', error);
        res.status(500).json({ error: 'Failed to update unit status' });
    }
}

// ── COURSE ASSIGNMENT ENDPOINTS ───────────────────────────────────────────────

/**
 * GET /api/units/:unitId/courses
 * List all courses a unit is assigned to.
 */
export async function getUnitCourses(req, res) {
    try {
        const { unitId } = req.params;
        const engine = getActiveDbEngine();
        const isPg = engine === 'postgres';
        const ph = (i) => isPg ? `$${i}` : '?';

        const assignments = await query(
            `SELECT cua.*, c.name AS course_name, c.department, c.status AS course_status
             FROM course_unit_assignments cua
             LEFT JOIN courses c ON c.id = cua.course_id
             WHERE cua.unit_id = ${ph(1)}
             ORDER BY c.name ASC`,
            [unitId]
        );
        res.json(assignments);
    } catch (error) {
        console.error('getUnitCourses error:', error);
        res.status(500).json({ error: 'Failed to fetch unit course assignments' });
    }
}

/**
 * POST /api/units/:unitId/courses
 * Assign a unit to a course.
 * Body: { course_id }
 */
export async function assignUnitToCourse(req, res) {
    try {
        const { unitId } = req.params;
        const { course_id } = req.body;
        if (!course_id) return res.status(400).json({ error: 'course_id is required' });

        const engine = getActiveDbEngine();
        const isPg = engine === 'postgres';
        const ph = (i) => isPg ? `$${i}` : '?';

        const unit = await queryOne(`SELECT * FROM course_units WHERE id = ${ph(1)}`, [unitId]);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

        const course = await queryOne(`SELECT * FROM courses WHERE id = ${ph(1)}`, [course_id]);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        const existing = await queryOne(
            `SELECT id FROM course_unit_assignments WHERE unit_id = ${ph(1)} AND course_id = ${ph(2)}`,
            [unitId, course_id]
        );
        if (existing) return res.status(409).json({ error: 'Unit is already assigned to this course' });

        // Determine next sort_order for this course
        const maxOrder = await queryOne(
            `SELECT MAX(sort_order) AS max_order FROM course_unit_assignments WHERE course_id = ${ph(1)}`,
            [course_id]
        );
        const nextOrder = (parseInt(maxOrder?.max_order) ?? -1) + 1;

        if (isPg) {
            await query(
                `INSERT INTO course_unit_assignments (unit_id, course_id, sort_order) VALUES (${ph(1)}, ${ph(2)}, ${ph(3)})`,
                [unitId, course_id, nextOrder]
            );
        } else {
            await run(
                'INSERT INTO course_unit_assignments (unit_id, course_id, sort_order) VALUES (?, ?, ?)',
                [unitId, course_id, nextOrder]
            );
        }

        res.status(201).json({ message: `Unit "${unit.name}" assigned to "${course.name}"` });
    } catch (error) {
        console.error('assignUnitToCourse error:', error);
        res.status(500).json({ error: 'Failed to assign unit to course' });
    }
}

/**
 * DELETE /api/units/:unitId/courses/:courseId
 * Remove a unit from a course. Does NOT delete the unit or historical records.
 */
export async function unassignUnitFromCourse(req, res) {
    try {
        const { unitId, courseId } = req.params;
        const engine = getActiveDbEngine();
        const isPg = engine === 'postgres';
        const ph = (i) => isPg ? `$${i}` : '?';

        const unit = await queryOne(`SELECT name FROM course_units WHERE id = ${ph(1)}`, [unitId]);
        const course = await queryOne(`SELECT name FROM courses WHERE id = ${ph(1)}`, [courseId]);

        await run(
            `DELETE FROM course_unit_assignments WHERE unit_id = ${ph(1)} AND course_id = ${ph(2)}`,
            [unitId, courseId]
        );

        res.json({ message: `Unit "${unit?.name || unitId}" removed from course "${course?.name || courseId}". Historical records are preserved.` });
    } catch (error) {
        console.error('unassignUnitFromCourse error:', error);
        res.status(500).json({ error: 'Failed to remove unit from course' });
    }
}

/**
 * PUT /api/courses/:courseId/units/assignments
 * Bulk-set all unit assignments for a course (replaces existing set).
 * Body: { unit_ids: number[] }
 */
export async function setCourseUnitAssignments(req, res) {
    try {
        const { courseId } = req.params;
        const { unit_ids } = req.body;

        if (!Array.isArray(unit_ids)) {
            return res.status(400).json({ error: 'unit_ids must be an array' });
        }

        const engine = getActiveDbEngine();
        const isPg = engine === 'postgres';
        const ph = (i) => isPg ? `$${i}` : '?';

        const course = await queryOne(`SELECT * FROM courses WHERE id = ${ph(1)}`, [courseId]);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        // Remove all existing assignments for this course
        await run(`DELETE FROM course_unit_assignments WHERE course_id = ${ph(1)}`, [courseId]);

        // Re-insert in order
        for (let i = 0; i < unit_ids.length; i++) {
            const uid = unit_ids[i];
            if (isPg) {
                await query(
                    `INSERT INTO course_unit_assignments (unit_id, course_id, sort_order) VALUES (${ph(1)}, ${ph(2)}, ${ph(3)}) ON CONFLICT (course_id, unit_id) DO UPDATE SET sort_order = EXCLUDED.sort_order`,
                    [uid, courseId, i]
                );
            } else {
                await run(
                    'INSERT OR REPLACE INTO course_unit_assignments (unit_id, course_id, sort_order) VALUES (?, ?, ?)',
                    [uid, courseId, i]
                );
            }
        }

        const assignments = await query(
            `SELECT cua.unit_id, cu.name, cu.code, cu.status, cua.sort_order
             FROM course_unit_assignments cua
             LEFT JOIN course_units cu ON cu.id = cua.unit_id
             WHERE cua.course_id = ${ph(1)}
             ORDER BY cua.sort_order ASC`,
            [courseId]
        );

        res.json({ message: `Course unit assignments updated. ${unit_ids.length} units assigned.`, assignments });
    } catch (error) {
        console.error('setCourseUnitAssignments error:', error);
        res.status(500).json({ error: 'Failed to update course unit assignments' });
    }
}

// ── LEGACY COURSE-SCOPED ENDPOINTS (kept for backward compatibility) ───────────

/**
 * GET /api/courses/:courseId/units
 * Returns all units for a given course (legacy + assignment-based).
 */
export async function getCourseUnits(req, res) {
    try {
        const { courseId } = req.params;
        const engine = getActiveDbEngine();
        const isPg = engine === 'postgres';
        const ph = (i) => isPg ? `$${i}` : '?';

        const course = await queryOne(`SELECT * FROM courses WHERE id = ${ph(1)}`, [courseId]);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        // Get units via assignment table
        let assignedUnits = [];
        try {
            assignedUnits = await query(
                `SELECT cu.*, cua.sort_order AS assignment_order
                 FROM course_unit_assignments cua
                 LEFT JOIN course_units cu ON cu.id = cua.unit_id
                 WHERE cua.course_id = ${ph(1)} AND (cu.status IS NULL OR cu.status = 'Active')
                 ORDER BY cua.sort_order ASC, cu.name ASC`,
                [courseId]
            );
        } catch (_) { /* assignment table may not exist yet */ }

        // Also get legacy units (course_id directly on course_units)
        const legacyUnits = await query(
            `SELECT * FROM course_units WHERE course_id = ${ph(1)} AND (status IS NULL OR status = 'Active') ORDER BY sort_order ASC, id ASC`,
            [courseId]
        );

        // Merge: prefer assignment-based, de-duplicate by id
        const seen = new Set();
        const merged = [];
        for (const u of [...assignedUnits, ...legacyUnits]) {
            if (!seen.has(u.id)) { seen.add(u.id); merged.push(u); }
        }

        // Auto-populate Computer Packages units on first access
        if (merged.length === 0 && isComputerPackagesCourse(course.name)) {
            for (let i = 0; i < COMPUTER_PACKAGES_UNITS.length; i++) {
                const uName = COMPUTER_PACKAGES_UNITS[i];
                let newId;
                if (isPg) {
                    const r = await query(
                        `INSERT INTO course_units (course_id, name, sort_order, status) VALUES (${ph(1)}, ${ph(2)}, ${ph(3)}, 'Active') RETURNING id`,
                        [courseId, uName, i]
                    );
                    newId = r.rows[0].id;
                } else {
                    const r = await run(
                        "INSERT INTO course_units (course_id, name, sort_order, status) VALUES (?, ?, ?, 'Active')",
                        [courseId, uName, i]
                    );
                    newId = r.lastID;
                }
                merged.push({ id: newId, course_id: courseId, name: uName, sort_order: i, status: 'Active' });
            }
            console.log(`✅ Auto-populated ${merged.length} Computer Packages units for course ${courseId}`);
        }

        res.json(merged);
    } catch (error) {
        console.error('getCourseUnits error:', error);
        res.status(500).json({ error: 'Failed to fetch course units' });
    }
}

/**
 * POST /api/courses/:courseId/units
 * Creates a new unit (legacy) or adds existing unit to a course.
 */
export async function createCourseUnit(req, res) {
    try {
        const { courseId } = req.params;
        const { name, sort_order, code, description } = req.body;
        const engine = getActiveDbEngine();
        const isPg = engine === 'postgres';
        const ph = (i) => isPg ? `$${i}` : '?';

        if (!name?.trim()) return res.status(400).json({ error: 'Unit name is required' });

        const course = await queryOne(`SELECT id FROM courses WHERE id = ${ph(1)}`, [courseId]);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        const existingMax = await queryOne(
            `SELECT MAX(sort_order) AS max_order FROM course_units WHERE course_id = ${ph(1)}`,
            [courseId]
        );
        const nextOrder = sort_order !== undefined ? sort_order : ((parseInt(existingMax?.max_order) ?? -1) + 1);

        let unit;
        if (isPg) {
            const r = await query(
                `INSERT INTO course_units (course_id, name, code, description, sort_order, status) VALUES (${ph(1)}, ${ph(2)}, ${ph(3)}, ${ph(4)}, ${ph(5)}, 'Active') RETURNING *`,
                [courseId, name.trim(), code?.trim() || null, description?.trim() || null, nextOrder]
            );
            unit = r.rows[0];
        } else {
            const r = await run(
                "INSERT INTO course_units (course_id, name, code, description, sort_order, status) VALUES (?, ?, ?, ?, ?, 'Active')",
                [courseId, name.trim(), code?.trim() || null, description?.trim() || null, nextOrder]
            );
            unit = await queryOne('SELECT * FROM course_units WHERE id = ?', [r.lastID]);
        }

        res.status(201).json(unit);
    } catch (error) {
        console.error('createCourseUnit error:', error);
        res.status(500).json({ error: 'Failed to create course unit' });
    }
}

/**
 * PUT /api/courses/:courseId/units/:unitId
 * Updates a unit's name, code, description, or sort_order.
 */
export async function updateCourseUnit(req, res) {
    try {
        const { courseId, unitId } = req.params;
        const { name, sort_order, code, description, status } = req.body;
        const engine = getActiveDbEngine();
        const isPg = engine === 'postgres';
        const ph = (i) => isPg ? `$${i}` : '?';

        // Look up by id (unit may be assigned via assignment table or legacy course_id)
        const unit = await queryOne(`SELECT * FROM course_units WHERE id = ${ph(1)}`, [unitId]);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

        const updatedName = name !== undefined ? name.trim() : unit.name;
        const updatedOrder = sort_order !== undefined ? sort_order : unit.sort_order;
        const updatedCode = code !== undefined ? (code?.trim() || null) : unit.code;
        const updatedDesc = description !== undefined ? (description?.trim() || null) : unit.description;
        const updatedStatus = status ?? unit.status ?? 'Active';

        if (isPg) {
            await query(
                `UPDATE course_units SET name = ${ph(1)}, sort_order = ${ph(2)}, code = ${ph(3)}, description = ${ph(4)}, status = ${ph(5)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${ph(6)}`,
                [updatedName, updatedOrder, updatedCode, updatedDesc, updatedStatus, unitId]
            );
            const updated = await queryOne(`SELECT * FROM course_units WHERE id = ${ph(1)}`, [unitId]);
            res.json(updated);
        } else {
            await run(
                'UPDATE course_units SET name = ?, sort_order = ?, code = ?, description = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [updatedName, updatedOrder, updatedCode, updatedDesc, updatedStatus, unitId]
            );
            const updated = await queryOne('SELECT * FROM course_units WHERE id = ?', [unitId]);
            res.json(updated);
        }
    } catch (error) {
        console.error('updateCourseUnit error:', error);
        res.status(500).json({ error: 'Failed to update course unit' });
    }
}

/**
 * DELETE /api/courses/:courseId/units/:unitId
 * Removes the unit from the course. If it has records, deactivates instead of deleting.
 */
export async function deleteCourseUnit(req, res) {
    try {
        const { courseId, unitId } = req.params;
        const engine = getActiveDbEngine();
        const isPg = engine === 'postgres';
        const ph = (i) => isPg ? `$${i}` : '?';

        const unit = await queryOne(`SELECT * FROM course_units WHERE id = ${ph(1)}`, [unitId]);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

        // Check for associated records
        const markCount = await queryOne(`SELECT COUNT(*) AS cnt FROM student_unit_marks WHERE unit_id = ${ph(1)}`, [unitId]);
        const total = parseInt(markCount?.cnt) || 0;

        if (total > 0) {
            // Remove from assignment table only – keep the unit with Inactive status
            await run(`DELETE FROM course_unit_assignments WHERE unit_id = ${ph(1)} AND course_id = ${ph(2)}`, [unitId, courseId]);
            await run(`UPDATE course_units SET status = 'Inactive', updated_at = CURRENT_TIMESTAMP WHERE id = ${ph(1)}`, [unitId]);
            return res.json({ message: `Unit has ${total} student record(s). It has been deactivated and removed from this course to preserve historical data.`, deactivated: true });
        }

        // Remove from assignment table
        await run(`DELETE FROM course_unit_assignments WHERE unit_id = ${ph(1)} AND course_id = ${ph(2)}`, [unitId, courseId]);
        // Remove legacy course_id link if it was the owning course
        if (String(unit.course_id) === String(courseId)) {
            await run(`DELETE FROM course_units WHERE id = ${ph(1)}`, [unitId]);
        }

        res.json({ message: 'Unit removed successfully' });
    } catch (error) {
        console.error('deleteCourseUnit error:', error);
        res.status(500).json({ error: 'Failed to delete course unit' });
    }
}

/**
 * POST /api/courses/:courseId/units/reorder
 * Bulk-update sort_order for units.
 */
export async function reorderCourseUnits(req, res) {
    try {
        const { courseId } = req.params;
        const { order } = req.body;
        const engine = getActiveDbEngine();
        const isPg = engine === 'postgres';
        const ph = (i) => isPg ? `$${i}` : '?';

        if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });

        for (const item of order) {
            // Update assignment table first
            try {
                await run(
                    `UPDATE course_unit_assignments SET sort_order = ${ph(1)} WHERE id = ${ph(2)} AND course_id = ${ph(3)}`,
                    [item.sort_order, item.id, courseId]
                );
            } catch (_) { /* assignment table may not exist */ }

            // Also update legacy sort_order on course_units
            await run(
                `UPDATE course_units SET sort_order = ${ph(1)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${ph(2)} AND course_id = ${ph(3)}`,
                [item.sort_order, item.id, courseId]
            );
        }

        const units = await query(
            `SELECT * FROM course_units WHERE course_id = ${ph(1)} ORDER BY sort_order ASC, id ASC`,
            [courseId]
        );
        res.json(units);
    } catch (error) {
        console.error('reorderCourseUnits error:', error);
        res.status(500).json({ error: 'Failed to reorder units' });
    }
}
