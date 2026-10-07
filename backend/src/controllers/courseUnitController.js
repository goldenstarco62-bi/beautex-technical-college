/**
 * Course Unit Controller — Refactored for new academic structure.
 *
 * NEW ARCHITECTURE:
 *   - global_units:    Stand-alone unit library (unit_code, unit_name, description, status)
 *   - program_units:   Junction table mapping global_units <-> courses  (course_id, unit_id)
 *
 * LEGACY BACKWARD-COMPATIBILITY:
 *   - Reads from course_units (old table) are attempted as fallback so nothing breaks
 *     while the migration settles.
 *
 * All new data is written exclusively to global_units / program_units.
 */
import { query, run, queryOne, getActiveDbEngine } from '../config/database.js';

// Predefined units for Computer Packages courses
const COMPUTER_PACKAGES_UNITS = [
    { unit_name: 'Introduction to Computers',    unit_code: 'CP-101' },
    { unit_name: 'Microsoft Windows',            unit_code: 'CP-102' },
    { unit_name: 'Keyboarding & Typing Skills',  unit_code: 'CP-103' },
    { unit_name: 'Microsoft Word',               unit_code: 'CP-104' },
    { unit_name: 'Microsoft Excel',              unit_code: 'CP-105' },
    { unit_name: 'Microsoft PowerPoint',         unit_code: 'CP-106' },
    { unit_name: 'Microsoft Access',             unit_code: 'CP-107' },
    { unit_name: 'Microsoft Outlook',            unit_code: 'CP-108' },
    { unit_name: 'Microsoft Publisher',          unit_code: 'CP-109' },
    { unit_name: 'Internet & Digital Literacy',  unit_code: 'CP-110' },
];

function isComputerPackagesCourse(name = '') {
    return name.toLowerCase().includes('computer package');
}

function ph(i) {
    return getActiveDbEngine() === 'postgres' ? `$${i}` : '?';
}

// ── MASTER UNIT ENDPOINTS ─────────────────────────────────────────────────────

/**
 * GET /api/units
 * Returns all global units, optionally filtered by status or search term.
 * Each unit includes the list of courses it is assigned to.
 */
export async function getAllUnits(req, res) {
    try {
        const { status, search, course_id } = req.query;
        const isPg = getActiveDbEngine() === 'postgres';

        let sql = 'SELECT * FROM global_units WHERE 1=1';
        const params = [];

        if (status) {
            sql += isPg ? ` AND status = $${params.length + 1}` : ' AND status = ?';
            params.push(status);
        }
        if (search) {
            const term = `%${search}%`;
            if (isPg) {
                sql += ` AND (unit_name ILIKE $${params.length + 1} OR unit_code ILIKE $${params.length + 2})`;
                params.push(term, term);
            } else {
                sql += ' AND (unit_name LIKE ? OR unit_code LIKE ?)';
                params.push(term, term);
            }
        }
        sql += ' ORDER BY unit_name ASC';

        let units = await query(sql, params);

        // Fallback: if global_units is empty, try old course_units table
        if (!units || units.length === 0) {
            try {
                let legacySql = 'SELECT id, name AS unit_name, code AS unit_code, description, status FROM course_units WHERE 1=1';
                const legacyParams = [];
                if (status) { legacySql += isPg ? ` AND status = $1` : ' AND status = ?'; legacyParams.push(status); }
                legacySql += ' ORDER BY name ASC';
                units = await query(legacySql, legacyParams);
            } catch (_) { units = []; }
        }

        // Attach assigned courses to each unit
        const enriched = await Promise.all((units || []).map(async (u) => {
            let assignedCourses = [];
            try {
                assignedCourses = await query(
                    `SELECT pu.course_id, c.name AS course_name
                     FROM program_units pu
                     LEFT JOIN courses c ON c.id = pu.course_id
                     WHERE pu.unit_id = ${ph(1)}
                     ORDER BY c.name ASC`,
                    [u.id]
                );
            } catch (_) { /* program_units may not exist yet */ }
            const nameVal = u.unit_name || u.name || '';
            const codeVal = u.unit_code || u.code || '';
            return {
                ...u,
                name: nameVal,
                code: codeVal,
                unit_name: nameVal,
                unit_code: codeVal,
                assigned_courses: assignedCourses
            };
        }));

        res.json(enriched);
    } catch (error) {
        console.error('getAllUnits error:', error);
        res.status(500).json({ error: 'Failed to fetch units' });
    }
}

/**
 * POST /api/units
 * Creates a new global unit.
 */
export async function createUnit(req, res) {
    try {
        const { name, unit_name, code, unit_code, description, status = 'Active' } = req.body;
        const finalName = (unit_name || name || '').trim();
        const finalCode = (unit_code || code || '').trim();

        if (!finalName) return res.status(400).json({ error: 'Unit name is required' });

        const isPg = getActiveDbEngine() === 'postgres';

        // Check duplicate
        const existing = await queryOne(
            isPg
                ? 'SELECT id FROM global_units WHERE LOWER(unit_name) = LOWER($1)'
                : 'SELECT id FROM global_units WHERE LOWER(unit_name) = LOWER(?)',
            [finalName]
        );
        if (existing) return res.status(409).json({ error: 'A unit with this name already exists.' });

        // Auto-generate code if missing
        const autoCode = finalCode || finalName.substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 900 + 100);

        let result;
        if (isPg) {
            result = await query(
                'INSERT INTO global_units (unit_code, unit_name, description, status) VALUES ($1, $2, $3, $4) RETURNING *',
                [autoCode, finalName, description?.trim() || null, status]
            );
            res.status(201).json(result[0]);
        } else {
            result = await run(
                'INSERT INTO global_units (unit_code, unit_name, description, status) VALUES (?, ?, ?, ?)',
                [autoCode, finalName, description?.trim() || null, status]
            );
            const unit = await queryOne('SELECT * FROM global_units WHERE id = ?', [result.lastID]);
            res.status(201).json(unit);
        }
    } catch (error) {
        console.error('createUnit error:', error);
        res.status(500).json({ error: 'Failed to create unit' });
    }
}

/**
 * PUT /api/units/:unitId
 * Updates a global unit's fields.
 */
export async function updateUnit(req, res) {
    try {
        const { unitId } = req.params;
        const { name, unit_name, code, unit_code, description, status } = req.body;
        const isPg = getActiveDbEngine() === 'postgres';

        const unit = await queryOne(
            isPg ? 'SELECT * FROM global_units WHERE id = $1' : 'SELECT * FROM global_units WHERE id = ?',
            [unitId]
        );
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

        const updatedName   = (unit_name || name)?.trim() ?? unit.unit_name;
        const updatedCode   = (unit_code || code)?.trim() ?? unit.unit_code;
        const updatedDesc   = description !== undefined ? (description?.trim() || null) : unit.description;
        const updatedStatus = status ?? unit.status ?? 'Active';

        if (isPg) {
            await query(
                'UPDATE global_units SET unit_name=$1, unit_code=$2, description=$3, status=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$5',
                [updatedName, updatedCode, updatedDesc, updatedStatus, unitId]
            );
            const updated = await queryOne('SELECT * FROM global_units WHERE id=$1', [unitId]);
            res.json(updated);
        } else {
            await run(
                'UPDATE global_units SET unit_name=?, unit_code=?, description=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
                [updatedName, updatedCode, updatedDesc, updatedStatus, unitId]
            );
            const updated = await queryOne('SELECT * FROM global_units WHERE id=?', [unitId]);
            res.json(updated);
        }
    } catch (error) {
        console.error('updateUnit error:', error);
        res.status(500).json({ error: 'Failed to update unit' });
    }
}

/**
 * DELETE /api/units/:unitId
 * Deletes a global unit only if it has no associated assessment results.
 */
export async function deleteUnit(req, res) {
    try {
        const { unitId } = req.params;
        const isPg = getActiveDbEngine() === 'postgres';

        const unit = await queryOne(`SELECT * FROM global_units WHERE id = ${ph(1)}`, [unitId]);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

        // Check for historical records
        let total = 0;
        try {
            const markCount = await queryOne(`SELECT COUNT(*) AS cnt FROM student_unit_marks WHERE unit_id = ${ph(1)}`, [unitId]);
            total += parseInt(markCount?.cnt) || 0;
        } catch (_) {}
        try {
            const catCount = await queryOne(`SELECT COUNT(*) AS cnt FROM cat_results WHERE unit_id = ${ph(1)}`, [unitId]);
            total += parseInt(catCount?.cnt) || 0;
        } catch (_) {}
        try {
            const resultCount = await queryOne(`SELECT COUNT(*) AS cnt FROM assessment_results WHERE unit_id = ${ph(1)}`, [unitId]);
            total += parseInt(resultCount?.cnt) || 0;
        } catch (_) {}

        if (total > 0) {
            return res.status(409).json({
                error: `Cannot delete: this unit has ${total} associated record(s). Deactivate it instead to preserve historical data.`,
                hasData: true
            });
        }

        await run(`DELETE FROM program_units WHERE unit_id = ${ph(1)}`, [unitId]);
        await run(`DELETE FROM global_units WHERE id = ${ph(1)}`, [unitId]);
        res.json({ message: 'Unit deleted successfully' });
    } catch (error) {
        console.error('deleteUnit error:', error);
        res.status(500).json({ error: 'Failed to delete unit' });
    }
}

/**
 * PATCH /api/units/:unitId/status
 * Toggle unit Active/Inactive.
 */
export async function toggleUnitStatus(req, res) {
    try {
        const { unitId } = req.params;
        const { status } = req.body;

        if (!['Active', 'Inactive'].includes(status)) {
            return res.status(400).json({ error: 'Status must be Active or Inactive' });
        }

        const unit = await queryOne(`SELECT * FROM global_units WHERE id = ${ph(1)}`, [unitId]);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

        const isPg = getActiveDbEngine() === 'postgres';
        if (isPg) {
            await query(`UPDATE global_units SET status=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2`, [status, unitId]);
            const updated = await queryOne('SELECT * FROM global_units WHERE id=$1', [unitId]);
            res.json(updated);
        } else {
            await run(`UPDATE global_units SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [status, unitId]);
            const updated = await queryOne('SELECT * FROM global_units WHERE id=?', [unitId]);
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
 * List all courses a unit is assigned to via program_units.
 */
export async function getUnitCourses(req, res) {
    try {
        const { unitId } = req.params;
        const assignments = await query(
            `SELECT pu.*, c.name AS course_name, c.department, c.status AS course_status
             FROM program_units pu
             LEFT JOIN courses c ON c.id = pu.course_id
             WHERE pu.unit_id = ${ph(1)}
             ORDER BY c.name ASC`,
            [unitId]
        );
        res.json(assignments || []);
    } catch (error) {
        console.error('getUnitCourses error:', error);
        res.status(500).json({ error: 'Failed to fetch unit course assignments' });
    }
}

/**
 * POST /api/units/:unitId/courses
 * Assign a global unit to a course via program_units.
 * Body: { course_id }
 */
export async function assignUnitToCourse(req, res) {
    try {
        const { unitId } = req.params;
        const { course_id } = req.body;
        if (!course_id) return res.status(400).json({ error: 'course_id is required' });

        const uId = parseInt(unitId, 10);
        const cId = String(course_id).trim();

        if (isNaN(uId)) return res.status(400).json({ error: 'Invalid unitId' });

        const isPg = getActiveDbEngine() === 'postgres';

        const unit = await queryOne(`SELECT * FROM global_units WHERE id = ${ph(1)}`, [uId]);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

        const course = await queryOne(`SELECT * FROM courses WHERE id = ${ph(1)}`, [cId]);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        const existing = await queryOne(
            `SELECT id FROM program_units WHERE unit_id = ${ph(1)} AND course_id = ${ph(2)}`,
            [uId, cId]
        );
        if (existing) return res.status(409).json({ error: 'Unit is already assigned to this course' });

        if (isPg) {
            await query(`INSERT INTO program_units (unit_id, course_id) VALUES ($1, $2)`, [uId, cId]);
        } else {
            await run('INSERT INTO program_units (unit_id, course_id) VALUES (?, ?)', [uId, cId]);
        }

        res.status(201).json({ message: `Unit "${unit.unit_name}" assigned to "${course.name}"` });
    } catch (error) {
        console.error('assignUnitToCourse error:', error);
        res.status(500).json({ error: 'Failed to assign unit to course' });
    }
}

/**
 * DELETE /api/units/:unitId/courses/:courseId
 * Remove a unit from a course. Does NOT delete the unit or its historical records.
 */
export async function unassignUnitFromCourse(req, res) {
    try {
        const { unitId, courseId } = req.params;
        const uId = parseInt(unitId, 10);
        const cId = String(courseId).trim();

        const unit   = await queryOne(`SELECT unit_name FROM global_units WHERE id = ${ph(1)}`, [uId]);
        const course = await queryOne(`SELECT name FROM courses WHERE id = ${ph(1)}`, [cId]);

        await run(`DELETE FROM program_units WHERE unit_id = ${ph(1)} AND course_id = ${ph(2)}`, [uId, cId]);

        res.json({ message: `Unit "${unit?.unit_name || unitId}" removed from course "${course?.name || courseId}". Historical records preserved.` });
    } catch (error) {
        console.error('unassignUnitFromCourse error:', error);
        res.status(500).json({ error: 'Failed to remove unit from course' });
    }
}

/**
 * PUT /api/courses/:courseId/units/assignments
 * Bulk-set all unit assignments for a course (replaces existing).
 * Body: { unit_ids: number[] }
 */
export async function setCourseUnitAssignments(req, res) {
    try {
        const { courseId } = req.params;
        const { unit_ids } = req.body;

        if (!Array.isArray(unit_ids)) {
            return res.status(400).json({ error: 'unit_ids must be an array' });
        }

        const isPg = getActiveDbEngine() === 'postgres';

        const course = await queryOne(`SELECT * FROM courses WHERE id = ${ph(1)}`, [courseId]);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        // Remove all existing assignments for this course
        await run(`DELETE FROM program_units WHERE course_id = ${ph(1)}`, [courseId]);

        // Re-insert in order
        for (let i = 0; i < unit_ids.length; i++) {
            const uid = unit_ids[i];
            if (isPg) {
                await query(
                    `INSERT INTO program_units (unit_id, course_id) VALUES ($1, $2) ON CONFLICT (course_id, unit_id) DO NOTHING`,
                    [uid, courseId]
                );
            } else {
                await run('INSERT OR IGNORE INTO program_units (unit_id, course_id) VALUES (?, ?)', [uid, courseId]);
            }
        }

        const assignments = await query(
            `SELECT pu.unit_id, gu.unit_name AS name, gu.unit_code AS code, gu.status
             FROM program_units pu
             LEFT JOIN global_units gu ON gu.id = pu.unit_id
             WHERE pu.course_id = ${ph(1)}
             ORDER BY gu.unit_name ASC`,
            [courseId]
        );

        res.json({ message: `Course unit assignments updated. ${unit_ids.length} units assigned.`, assignments });
    } catch (error) {
        console.error('setCourseUnitAssignments error:', error);
        res.status(500).json({ error: 'Failed to update course unit assignments' });
    }
}

// ── COURSE-SCOPED UNIT ENDPOINTS ──────────────────────────────────────────────

/**
 * GET /api/courses/:courseId/units
 * Returns all active units assigned to a course via program_units.
 * Falls back to old course_units table for backward compatibility.
 */
export async function getCourseUnits(req, res) {
    try {
        const { courseId } = req.params;
        const isPg = getActiveDbEngine() === 'postgres';

        const course = await queryOne(`SELECT * FROM courses WHERE id = ${ph(1)}`, [courseId]);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        // Primary: new program_units -> global_units
        let units = await query(
            `SELECT gu.id, gu.unit_code AS code, gu.unit_name AS name, gu.description, gu.status,
                    pu.id AS assignment_id
             FROM program_units pu
             LEFT JOIN global_units gu ON gu.id = pu.unit_id
             WHERE pu.course_id = ${ph(1)} AND (gu.status IS NULL OR gu.status = 'Active')
             ORDER BY gu.unit_name ASC`,
            [courseId]
        );

        // Fallback: old course_units table
        if (!units || units.length === 0) {
            try {
                units = await query(
                    `SELECT id, course_id, name, code, description, status, sort_order FROM course_units
                     WHERE course_id = ${ph(1)} AND (status IS NULL OR status = 'Active')
                     ORDER BY sort_order ASC, id ASC`,
                    [courseId]
                );
            } catch (_) {}
        }

        // Auto-populate Computer Packages units on first access
        if ((!units || units.length === 0) && isComputerPackagesCourse(course.name)) {
            for (const u of COMPUTER_PACKAGES_UNITS) {
                // Upsert into global_units
                let unitRow = await queryOne(`SELECT id FROM global_units WHERE LOWER(unit_name) = LOWER(${ph(1)})`, [u.unit_name]);
                if (!unitRow) {
                    if (isPg) {
                        const r = await query(
                            `INSERT INTO global_units (unit_code, unit_name, status) VALUES ($1, $2, 'Active') RETURNING id`,
                            [u.unit_code, u.unit_name]
                        );
                        unitRow = r[0];
                    } else {
                        const r = await run(`INSERT INTO global_units (unit_code, unit_name, status) VALUES (?, ?, 'Active')`, [u.unit_code, u.unit_name]);
                        unitRow = { id: r.lastID };
                    }
                }
                // Link to course
                if (isPg) {
                    await query(`INSERT INTO program_units (unit_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [unitRow.id, courseId]);
                } else {
                    await run(`INSERT OR IGNORE INTO program_units (unit_id, course_id) VALUES (?, ?)`, [unitRow.id, courseId]);
                }
            }
            // Re-fetch
            units = await query(
                `SELECT gu.id, gu.unit_code AS code, gu.unit_name AS name, gu.description, gu.status
                 FROM program_units pu
                 LEFT JOIN global_units gu ON gu.id = pu.unit_id
                 WHERE pu.course_id = ${ph(1)} ORDER BY gu.unit_name ASC`,
                [courseId]
            );
            console.log(`✅ Auto-populated ${units.length} Computer Packages units for course ${courseId}`);
        }

        res.json(units || []);
    } catch (error) {
        console.error('getCourseUnits error:', error);
        res.status(500).json({ error: 'Failed to fetch course units' });
    }
}

/**
 * POST /api/courses/:courseId/units
 * Creates a new global unit AND assigns it to the course.
 */
export async function createCourseUnit(req, res) {
    try {
        const { courseId } = req.params;
        const { name, unit_name, code, unit_code, description } = req.body;
        const finalName = (unit_name || name || '').trim();
        const finalCode = (unit_code || code || '').trim();
        const isPg = getActiveDbEngine() === 'postgres';

        if (!finalName) return res.status(400).json({ error: 'Unit name is required' });

        const course = await queryOne(`SELECT id FROM courses WHERE id = ${ph(1)}`, [courseId]);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        const autoCode = finalCode || finalName.substring(0, 3).toUpperCase() + '-' + Math.floor(Math.random() * 900 + 100);

        let unit;
        if (isPg) {
            const r = await query(
                `INSERT INTO global_units (unit_code, unit_name, description, status) VALUES ($1, $2, $3, 'Active') RETURNING *`,
                [autoCode, finalName, description?.trim() || null]
            );
            unit = r[0];
            await query(`INSERT INTO program_units (unit_id, course_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [unit.id, courseId]);
        } else {
            const r = await run(
                `INSERT INTO global_units (unit_code, unit_name, description, status) VALUES (?, ?, ?, 'Active')`,
                [autoCode, finalName, description?.trim() || null]
            );
            unit = await queryOne('SELECT * FROM global_units WHERE id=?', [r.lastID]);
            await run(`INSERT OR IGNORE INTO program_units (unit_id, course_id) VALUES (?, ?)`, [unit.id, courseId]);
        }

        res.status(201).json(unit);
    } catch (error) {
        console.error('createCourseUnit error:', error);
        res.status(500).json({ error: 'Failed to create course unit' });
    }
}

/**
 * PUT /api/courses/:courseId/units/:unitId
 * Updates a unit's name, code, description (globally, since units are shared).
 */
export async function updateCourseUnit(req, res) {
    try {
        const { unitId } = req.params;
        const { name, unit_name, code, unit_code, description, status } = req.body;
        const isPg = getActiveDbEngine() === 'postgres';

        const unit = await queryOne(`SELECT * FROM global_units WHERE id = ${ph(1)}`, [unitId]);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

        const updatedName   = (unit_name || name)?.trim() ?? unit.unit_name;
        const updatedCode   = (unit_code || code)?.trim() ?? unit.unit_code;
        const updatedDesc   = description !== undefined ? (description?.trim() || null) : unit.description;
        const updatedStatus = status ?? unit.status ?? 'Active';

        if (isPg) {
            await query(
                'UPDATE global_units SET unit_name=$1, unit_code=$2, description=$3, status=$4, updated_at=CURRENT_TIMESTAMP WHERE id=$5',
                [updatedName, updatedCode, updatedDesc, updatedStatus, unitId]
            );
            const updated = await queryOne('SELECT * FROM global_units WHERE id=$1', [unitId]);
            res.json(updated);
        } else {
            await run(
                'UPDATE global_units SET unit_name=?, unit_code=?, description=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
                [updatedName, updatedCode, updatedDesc, updatedStatus, unitId]
            );
            const updated = await queryOne('SELECT * FROM global_units WHERE id=?', [unitId]);
            res.json(updated);
        }
    } catch (error) {
        console.error('updateCourseUnit error:', error);
        res.status(500).json({ error: 'Failed to update unit' });
    }
}

/**
 * DELETE /api/courses/:courseId/units/:unitId
 * Removes a unit from a course (unlinks from program_units).
 * If the unit has student records, deactivates it instead.
 */
export async function deleteCourseUnit(req, res) {
    try {
        const { courseId, unitId } = req.params;

        const unit = await queryOne(`SELECT * FROM global_units WHERE id = ${ph(1)}`, [unitId]);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

        let total = 0;
        try { const c = await queryOne(`SELECT COUNT(*) AS cnt FROM student_unit_marks WHERE unit_id = ${ph(1)}`, [unitId]); total += parseInt(c?.cnt) || 0; } catch (_) {}
        try { const c = await queryOne(`SELECT COUNT(*) AS cnt FROM assessment_results WHERE unit_id = ${ph(1)}`, [unitId]); total += parseInt(c?.cnt) || 0; } catch (_) {}

        if (total > 0) {
            await run(`DELETE FROM program_units WHERE unit_id = ${ph(1)} AND course_id = ${ph(2)}`, [unitId, courseId]);
            await run(`UPDATE global_units SET status='Inactive', updated_at=CURRENT_TIMESTAMP WHERE id = ${ph(1)}`, [unitId]);
            return res.json({ message: `Unit has ${total} student record(s). It has been deactivated and removed from this course to preserve historical data.`, deactivated: true });
        }

        await run(`DELETE FROM program_units WHERE unit_id = ${ph(1)} AND course_id = ${ph(2)}`, [unitId, courseId]);
        res.json({ message: 'Unit removed from course successfully' });
    } catch (error) {
        console.error('deleteCourseUnit error:', error);
        res.status(500).json({ error: 'Failed to remove unit from course' });
    }
}

/**
 * POST /api/courses/:courseId/units/reorder
 * No-op for new architecture (units are ordered alphabetically from global_units).
 * Kept for backward compatibility.
 */
export async function reorderCourseUnits(req, res) {
    res.json({ message: 'Units are ordered globally. Reorder is not required in the new architecture.' });
}
