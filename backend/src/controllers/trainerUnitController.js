/**
 * Trainer-Unit Assignments Controller
 * Manages the formal assignment of trainers (faculty) to specific units within a course.
 * This allows fine-grained "Trainer X teaches Unit Y in Course Z" relationships,
 * as opposed to the coarse course-level assignment stored in faculty.courses (JSON string).
 *
 * Table: trainer_unit_assignments (faculty_id, unit_id, course_id)
 */
import { query, run, queryOne, getActiveDbEngine } from '../config/database.js';

function ph(i) {
    return getActiveDbEngine() === 'postgres' ? `$${i}` : '?';
}

/**
 * GET /api/trainer-units
 * Returns all trainer-unit assignments.
 * Query params:
 *   - faculty_id: filter by trainer
 *   - course_id: filter by course
 *   - unit_id: filter by unit
 */
export async function getTrainerUnitAssignments(req, res) {
    try {
        const { faculty_id, course_id, unit_id } = req.query;

        let sql = `
            SELECT tua.id, tua.faculty_id, tua.unit_id, tua.course_id, tua.assigned_by, tua.assigned_at,
                   cu.name AS unit_name, cu.code AS unit_code, cu.status AS unit_status,
                   c.name AS course_name,
                   f.name AS faculty_name, f.email AS faculty_email, f.department AS faculty_department
            FROM trainer_unit_assignments tua
            LEFT JOIN course_units cu ON cu.id = tua.unit_id
            LEFT JOIN courses c ON c.id = tua.course_id
            LEFT JOIN faculty f ON f.id = tua.faculty_id
            WHERE 1=1
        `;
        const params = [];

        if (faculty_id) {
            sql += ` AND tua.faculty_id = ${ph(params.length + 1)}`;
            params.push(faculty_id);
        }
        if (course_id) {
            sql += ` AND tua.course_id = ${ph(params.length + 1)}`;
            params.push(course_id);
        }
        if (unit_id) {
            sql += ` AND tua.unit_id = ${ph(params.length + 1)}`;
            params.push(unit_id);
        }

        sql += ' ORDER BY c.name ASC, cu.name ASC';

        const rows = await query(sql, params);
        res.json(rows || []);
    } catch (error) {
        console.error('getTrainerUnitAssignments error:', error);
        res.status(500).json({ error: 'Failed to fetch trainer-unit assignments' });
    }
}

/**
 * GET /api/trainer-units/my-units
 * For a logged-in teacher: returns all units they are assigned to teach, with course context.
 * Used by teacher dashboard and batch result entry to pre-filter the unit dropdown.
 */
export async function getMyUnits(req, res) {
    try {
        const email = req.user?.email;
        if (!email) return res.json([]);

        const faculty = await queryOne(
            `SELECT id FROM faculty WHERE LOWER(email) = LOWER(${ph(1)})`,
            [email]
        );
        if (!faculty) return res.json([]);

        const rows = await query(
            `SELECT tua.id AS assignment_id, tua.unit_id, tua.course_id, tua.assigned_at,
                    cu.name AS unit_name, cu.code AS unit_code, cu.status AS unit_status,
                    c.name AS course_name
             FROM trainer_unit_assignments tua
             LEFT JOIN course_units cu ON cu.id = tua.unit_id
             LEFT JOIN courses c ON c.id = tua.course_id
             WHERE tua.faculty_id = ${ph(1)}
             ORDER BY c.name ASC, cu.name ASC`,
            [faculty.id]
        );
        res.json(rows || []);
    } catch (error) {
        console.error('getMyUnits error:', error);
        res.status(500).json({ error: 'Failed to fetch your unit assignments' });
    }
}

/**
 * POST /api/trainer-units
 * Assign a trainer (faculty) to a specific unit in a course.
 * Body: { faculty_id, unit_id, course_id }
 * Roles: admin, superadmin only
 */
export async function assignTrainerUnit(req, res) {
    try {
        const { faculty_id, unit_id, course_id } = req.body;

        if (!faculty_id || !unit_id || !course_id) {
            return res.status(400).json({ error: 'faculty_id, unit_id, and course_id are all required' });
        }

        // Validate references exist
        const faculty = await queryOne(`SELECT id, name FROM faculty WHERE id = ${ph(1)}`, [faculty_id]);
        if (!faculty) return res.status(404).json({ error: 'Faculty member not found' });

        const unit = await queryOne(`SELECT id, name FROM course_units WHERE id = ${ph(1)}`, [unit_id]);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

        const course = await queryOne(`SELECT id, name FROM courses WHERE id = ${ph(1)}`, [course_id]);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        // Check duplicate
        const existing = await queryOne(
            `SELECT id FROM trainer_unit_assignments WHERE faculty_id = ${ph(1)} AND unit_id = ${ph(2)} AND course_id = ${ph(3)}`,
            [faculty_id, unit_id, course_id]
        );
        if (existing) {
            return res.status(409).json({ error: `${faculty.name} is already assigned to "${unit.name}" in "${course.name}"` });
        }

        const isPg = getActiveDbEngine() === 'postgres';
        if (isPg) {
            await query(
                `INSERT INTO trainer_unit_assignments (faculty_id, unit_id, course_id, assigned_by) VALUES ($1, $2, $3, $4)`,
                [faculty_id, unit_id, course_id, req.user?.email]
            );
        } else {
            await run(
                'INSERT INTO trainer_unit_assignments (faculty_id, unit_id, course_id, assigned_by) VALUES (?, ?, ?, ?)',
                [faculty_id, unit_id, course_id, req.user?.email]
            );
        }

        res.status(201).json({
            message: `${faculty.name} assigned to unit "${unit.name}" in course "${course.name}"`,
            faculty_id, unit_id, course_id,
            unit_name: unit.name, course_name: course.name, faculty_name: faculty.name
        });
    } catch (error) {
        console.error('assignTrainerUnit error:', error);
        res.status(500).json({ error: 'Failed to create trainer-unit assignment' });
    }
}

/**
 * POST /api/trainer-units/bulk
 * Bulk-set all unit assignments for a trainer in a course (replaces existing set for that course).
 * Body: { faculty_id, course_id, unit_ids: number[] }
 * Roles: admin, superadmin only
 */
export async function bulkSetTrainerUnits(req, res) {
    try {
        const { faculty_id, course_id, unit_ids } = req.body;

        if (!faculty_id || !course_id || !Array.isArray(unit_ids)) {
            return res.status(400).json({ error: 'faculty_id, course_id, and unit_ids[] are required' });
        }

        const faculty = await queryOne(`SELECT id, name FROM faculty WHERE id = ${ph(1)}`, [faculty_id]);
        if (!faculty) return res.status(404).json({ error: 'Faculty member not found' });

        const course = await queryOne(`SELECT id, name FROM courses WHERE id = ${ph(1)}`, [course_id]);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        const isPg = getActiveDbEngine() === 'postgres';

        // Remove all existing assignments for this trainer+course combo
        await run(
            `DELETE FROM trainer_unit_assignments WHERE faculty_id = ${ph(1)} AND course_id = ${ph(2)}`,
            [faculty_id, course_id]
        );

        // Re-insert new set
        for (const uid of unit_ids) {
            if (isPg) {
                await query(
                    `INSERT INTO trainer_unit_assignments (faculty_id, unit_id, course_id, assigned_by)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (faculty_id, unit_id, course_id) DO NOTHING`,
                    [faculty_id, uid, course_id, req.user?.email]
                );
            } else {
                await run(
                    'INSERT OR IGNORE INTO trainer_unit_assignments (faculty_id, unit_id, course_id, assigned_by) VALUES (?, ?, ?, ?)',
                    [faculty_id, uid, course_id, req.user?.email]
                );
            }
        }

        // Return the updated assignments for this trainer+course
        const updated = await query(
            `SELECT tua.id, tua.unit_id, cu.name AS unit_name, cu.code AS unit_code
             FROM trainer_unit_assignments tua
             LEFT JOIN course_units cu ON cu.id = tua.unit_id
             WHERE tua.faculty_id = ${ph(1)} AND tua.course_id = ${ph(2)}
             ORDER BY cu.name ASC`,
            [faculty_id, course_id]
        );

        res.json({
            message: `${unit_ids.length} unit(s) assigned to ${faculty.name} in "${course.name}"`,
            assignments: updated
        });
    } catch (error) {
        console.error('bulkSetTrainerUnits error:', error);
        res.status(500).json({ error: 'Failed to set trainer-unit assignments' });
    }
}

/**
 * DELETE /api/trainer-units/:id
 * Remove a specific trainer-unit assignment by ID.
 * Roles: admin, superadmin only
 */
export async function removeTrainerUnit(req, res) {
    try {
        const { id } = req.params;

        const existing = await queryOne(
            `SELECT tua.id, f.name AS faculty_name, cu.name AS unit_name, c.name AS course_name
             FROM trainer_unit_assignments tua
             LEFT JOIN faculty f ON f.id = tua.faculty_id
             LEFT JOIN course_units cu ON cu.id = tua.unit_id
             LEFT JOIN courses c ON c.id = tua.course_id
             WHERE tua.id = ${ph(1)}`,
            [id]
        );
        if (!existing) return res.status(404).json({ error: 'Assignment not found' });

        await run(`DELETE FROM trainer_unit_assignments WHERE id = ${ph(1)}`, [id]);
        res.json({
            message: `Assignment removed: ${existing.faculty_name} → "${existing.unit_name}" in "${existing.course_name}"`
        });
    } catch (error) {
        console.error('removeTrainerUnit error:', error);
        res.status(500).json({ error: 'Failed to remove trainer-unit assignment' });
    }
}
