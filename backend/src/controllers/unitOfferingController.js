/**
 * Unit Offerings Controller
 *
 * A *unit* is a subject (e.g. "Business Skills"). The same unit can be taught by several
 * lecturers to students drawn from different courses. An *offering* is one teaching
 * instance: unit + optional course + lecturer + group + term, with its own student list.
 *
 * Tables: unit_offerings (dedupe_key identity), offering_students.
 * dedupe_key format: `${unit_id}|${course_id||'*'}|${faculty_id||'*'}|${group_label||'*'}|${term||'*'}`
 */
import { query, run, queryOne, getActiveDbEngine } from '../config/database.js';

function ph(i) {
    return getActiveDbEngine() === 'postgres' ? `$${i}` : '?';
}

const buildDedupeKey = ({ unit_id, course_id, faculty_id, group_label, term }) =>
    [unit_id, course_id || '*', faculty_id || '*', group_label || '*', term || '*'].join('|');

async function resolveFaculty(req) {
    const email = req.user?.email;
    if (!email) return null;
    return queryOne(`SELECT id, name FROM faculty WHERE LOWER(email) = LOWER(${ph(1)})`, [email]);
}

/**
 * GET /api/unit-offerings
 * Admin: all offerings. Teacher: only offerings they lecture.
 * Query: unit_id, course_id, faculty_id, status
 */
export async function getOfferings(req, res) {
    try {
        const { unit_id, course_id, faculty_id, status } = req.query;
        const role = (req.user?.role || '').toLowerCase();

        let sql = `
            SELECT o.*, gu.unit_name, gu.unit_code, c.name AS course_name,
                   f.email AS faculty_email,
                   (SELECT CAST(COUNT(*) AS INTEGER) FROM offering_students os WHERE os.offering_id = o.id) AS student_count,
                   (SELECT CAST(COUNT(*) AS INTEGER) FROM cat_results cr WHERE cr.offering_id = o.id) AS marks_count
            FROM unit_offerings o
            LEFT JOIN global_units gu ON gu.id = o.unit_id
            LEFT JOIN courses c ON c.id = o.course_id
            LEFT JOIN faculty f ON f.id = o.faculty_id
            WHERE 1=1
        `;
        const params = [];

        if (role === 'teacher') {
            const faculty = await resolveFaculty(req);
            if (!faculty) return res.json([]);
            sql += ` AND (o.faculty_id = ${ph(params.length + 1)} OR o.created_by = ${ph(params.length + 2)})`;
            params.push(faculty.id, faculty.id);
        }
        if (unit_id)   { sql += ` AND o.unit_id = ${ph(params.length + 1)}`;   params.push(unit_id); }
        if (course_id) { sql += ` AND o.course_id = ${ph(params.length + 1)}`; params.push(course_id); }
        if (faculty_id){ sql += ` AND o.faculty_id = ${ph(params.length + 1)}`;params.push(faculty_id); }
        if (status)    { sql += ` AND o.status = ${ph(params.length + 1)}`;    params.push(status); }

        sql += ' ORDER BY gu.unit_name ASC, o.course_id ASC, o.group_label ASC';
        res.json(await query(sql, params) || []);
    } catch (error) {
        console.error('getOfferings error:', error);
        res.status(500).json({ error: 'Failed to fetch unit offerings' });
    }
}

/**
 * GET /api/unit-offerings/mine
 * Teacher-facing: active offerings assigned to the logged-in lecturer.
 */
export async function getMyOfferings(req, res) {
    try {
        const faculty = await resolveFaculty(req);
        if (!faculty) return res.json([]);

        const rows = await query(`
            SELECT o.id, o.unit_id, o.course_id, o.offering_name, o.group_label, o.term, o.academic_year,
                   o.status, gu.unit_name, gu.unit_code, gu.is_common, c.name AS course_name,
                   (SELECT CAST(COUNT(*) AS INTEGER) FROM offering_students os WHERE os.offering_id = o.id) AS student_count
            FROM unit_offerings o
            LEFT JOIN global_units gu ON gu.id = o.unit_id
            LEFT JOIN courses c ON c.id = o.course_id
            WHERE o.faculty_id = ${ph(1)} AND o.status = 'Active'
            ORDER BY gu.unit_name ASC, o.group_label ASC
        `, [faculty.id]);
        res.json(rows || []);
    } catch (error) {
        console.error('getMyOfferings error:', error);
        res.status(500).json({ error: 'Failed to fetch your offerings' });
    }
}

/**
 * GET /api/unit-offerings/:id — offering with its students.
 */
export async function getOffering(req, res) {
    try {
        const { id } = req.params;
        const offering = await queryOne(`
            SELECT o.*, gu.unit_name, gu.unit_code, c.name AS course_name
            FROM unit_offerings o
            LEFT JOIN global_units gu ON gu.id = o.unit_id
            LEFT JOIN courses c ON c.id = o.course_id
            WHERE o.id = ${ph(1)}
        `, [id]);
        if (!offering) return res.status(404).json({ error: 'Offering not found' });

        const students = await query(`
            SELECT s.id, s.name, s.course, s.email, s.status
            FROM offering_students os
            JOIN students s ON s.id = os.student_id
            WHERE os.offering_id = ${ph(1)}
            ORDER BY s.name ASC
        `, [id]);

        res.json({ ...offering, students: students || [] });
    } catch (error) {
        console.error('getOffering error:', error);
        res.status(500).json({ error: 'Failed to fetch offering' });
    }
}

/**
 * POST /api/unit-offerings — admin only.
 * Body: { unit_id, course_id?, offering_name?, faculty_id?, group_label?, term?, academic_year? }
 * course_id omitted/empty => cross-course offering (common unit taught to mixed courses).
 */
export async function createOffering(req, res) {
    try {
        const { unit_id, course_id, offering_name, faculty_id, group_label, term, academic_year } = req.body;
        if (!unit_id) return res.status(400).json({ error: 'unit_id is required' });

        const unit = await queryOne(`SELECT id, unit_name FROM global_units WHERE id = ${ph(1)}`, [unit_id]);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

        const courseId = course_id ? String(course_id).trim() : null;
        if (courseId) {
            const course = await queryOne(`SELECT id, name FROM courses WHERE id = ${ph(1)}`, [courseId]);
            if (!course) return res.status(404).json({ error: 'Course not found' });
        }
        const facId = faculty_id ? String(faculty_id).trim() : null;
        let facName = null;
        if (facId) {
            const fac = await queryOne(`SELECT id, name FROM faculty WHERE id = ${ph(1)}`, [facId]);
            if (!fac) return res.status(404).json({ error: 'Lecturer not found' });
            facName = fac.name;
        }

        const group = String(group_label || 'Default').trim() || 'Default';
        const dedupeKey = buildDedupeKey({ unit_id, course_id: courseId, faculty_id: facId, group_label: group, term });
        const clash = await queryOne(
            `SELECT id, offering_name FROM unit_offerings WHERE dedupe_key = ${ph(1)}`, [dedupeKey]
        );
        if (clash) {
            return res.status(409).json({
                error: `An offering for "${unit.unit_name}"${courseId ? ` in ${courseId}` : ''} with group "${group}" already exists (ID ${clash.id}). Edit it instead of creating a duplicate.`
            });
        }

        const result = await run(`
            INSERT INTO unit_offerings
              (unit_id, course_id, offering_name, faculty_id, faculty_name, group_label, term, academic_year,
               is_default, status, dedupe_key, created_by)
            VALUES (${ph(1)}, ${ph(2)}, ${ph(3)}, ${ph(4)}, ${ph(5)}, ${ph(6)}, ${ph(7)}, ${ph(8)}, FALSE, 'Active', ${ph(9)}, ${ph(10)})
        `, [unit_id, courseId, String(offering_name || unit.unit_name).trim(), facId, facName, group,
            term || null, academic_year || null, dedupeKey, String(req.user?.id || req.user?.email || '')]);

        const id = typeof result === 'object' ? (result.lastID ?? result.insertId ?? null) : null;
        const created = id ? await queryOne(`SELECT * FROM unit_offerings WHERE id = ${ph(1)}`, [id])
                           : await queryOne(`SELECT * FROM unit_offerings WHERE dedupe_key = ${ph(1)}`, [dedupeKey]);
        res.status(201).json(created || { id, dedupe_key: dedupeKey });
    } catch (error) {
        console.error('createOffering error:', error);
        res.status(500).json({ error: 'Failed to create offering' });
    }
}

/**
 * PUT /api/unit-offerings/:id — admin only. Recomputes identity and refuses collisions.
 */
export async function updateOffering(req, res) {
    try {
        const { id } = req.params;
        const existing = await queryOne(`SELECT * FROM unit_offerings WHERE id = ${ph(1)}`, [id]);
        if (!existing) return res.status(404).json({ error: 'Offering not found' });

        const next = {
            course_id: req.body.course_id !== undefined
                ? (req.body.course_id ? String(req.body.course_id).trim() : null) : existing.course_id,
            faculty_id: req.body.faculty_id !== undefined
                ? (req.body.faculty_id ? String(req.body.faculty_id).trim() : null) : existing.faculty_id,
            group_label: req.body.group_label !== undefined
                ? (String(req.body.group_label || 'Default').trim() || 'Default') : existing.group_label,
            term: req.body.term !== undefined ? (req.body.term || null) : existing.term,
        };
        const unitId = req.body.unit_id !== undefined ? req.body.unit_id : existing.unit_id;

        const updatedName = req.body.offering_name !== undefined ? String(req.body.offering_name).trim() : existing.offering_name;
        const updatedStatus = req.body.status !== undefined ? req.body.status : existing.status;
        const updatedYear = req.body.academic_year !== undefined ? (req.body.academic_year || null) : existing.academic_year;

        let facName = existing.faculty_name;
        if (next.faculty_id && next.faculty_id !== existing.faculty_id) {
            const fac = await queryOne(`SELECT id, name FROM faculty WHERE id = ${ph(1)}`, [next.faculty_id]);
            if (!fac) return res.status(404).json({ error: 'Lecturer not found' });
            facName = fac.name;
        }

        const dedupeKey = buildDedupeKey({ unit_id: unitId, ...next });
        const clash = await queryOne(
            `SELECT id FROM unit_offerings WHERE dedupe_key = ${ph(1)} AND id <> ${ph(2)}`, [dedupeKey, id]
        );
        if (clash) return res.status(409).json({ error: 'Another offering already covers this unit, course, lecturer and group.' });

        await run(`
            UPDATE unit_offerings
            SET unit_id = ${ph(1)}, course_id = ${ph(2)}, faculty_id = ${ph(3)}, faculty_name = ${ph(4)},
                group_label = ${ph(5)}, term = ${ph(6)}, academic_year = ${ph(7)}, offering_name = ${ph(8)},
                status = ${ph(9)}, dedupe_key = ${ph(10)}, updated_at = CURRENT_TIMESTAMP
            WHERE id = ${ph(11)}
        `, [unitId, next.course_id, next.faculty_id, facName, next.group_label, next.term, updatedYear,
            updatedName, updatedStatus, dedupeKey, id]);

        res.json(await queryOne(`SELECT * FROM unit_offerings WHERE id = ${ph(1)}`, [id]));
    } catch (error) {
        console.error('updateOffering error:', error);
        res.status(500).json({ error: 'Failed to update offering' });
    }
}

/**
 * DELETE /api/unit-offerings/:id — blocked while marks still reference the offering.
 */
export async function deleteOffering(req, res) {
    try {
        const { id } = req.params;
        const existing = await queryOne(`SELECT * FROM unit_offerings WHERE id = ${ph(1)}`, [id]);
        if (!existing) return res.status(404).json({ error: 'Offering not found' });

        const marks = await queryOne(`SELECT COUNT(*) AS n FROM cat_results WHERE offering_id = ${ph(1)}`, [id]);
        const markCount = Number(marks?.n || 0);
        if (markCount > 0) {
            return res.status(409).json({
                error: `This offering has ${markCount} recorded mark(s). Delete or move those results first.`
            });
        }

        await run(`DELETE FROM offering_students WHERE offering_id = ${ph(1)}`, [id]);
        await run(`DELETE FROM unit_offerings WHERE id = ${ph(1)}`, [id]);
        res.json({ success: true, deleted_id: Number(id) });
    } catch (error) {
        console.error('deleteOffering error:', error);
        res.status(500).json({ error: 'Failed to delete offering' });
    }
}

/**
 * GET /api/unit-offerings/:id/students
 */
export async function getOfferingStudents(req, res) {
    try {
        const rows = await query(`
            SELECT s.id, s.name, s.course, s.email, s.status
            FROM offering_students os JOIN students s ON s.id = os.student_id
            WHERE os.offering_id = ${ph(1)} ORDER BY s.name ASC
        `, [req.params.id]);
        res.json(rows || []);
    } catch (error) {
        console.error('getOfferingStudents error:', error);
        res.status(500).json({ error: 'Failed to fetch offering students' });
    }
}

/**
 * PUT /api/unit-offerings/:id/students — replace roster. Body: { student_ids: [...] }
 * Also used for cross-course offerings, where the roster is the only source of truth.
 */
export async function setOfferingStudents(req, res) {
    try {
        const { id } = req.params;
        const { student_ids } = req.body;
        if (!Array.isArray(student_ids)) return res.status(400).json({ error: 'student_ids must be an array' });

        const offering = await queryOne(`SELECT * FROM unit_offerings WHERE id = ${ph(1)}`, [id]);
        if (!offering) return res.status(404).json({ error: 'Offering not found' });

        const ids = [...new Set(student_ids.map(s => String(s).trim()).filter(Boolean))];
        if (ids.length) {
            const placeholders = ids.map((_, i) => ph(i + 1)).join(',');
            const found = await query(`SELECT id FROM students WHERE id IN (${placeholders})`, ids);
            const missing = ids.filter(x => !found.some(f => String(f.id) === x));
            if (missing.length) {
                return res.status(400).json({ error: `Unknown student id(s): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}` });
            }
        }

        await run(`DELETE FROM offering_students WHERE offering_id = ${ph(1)}`, [id]);
        for (const sid of ids) {
            await run(`INSERT INTO offering_students (offering_id, student_id) VALUES (${ph(1)}, ${ph(2)})`, [id, sid]);
        }

        res.json({ success: true, offering_id: Number(id), student_count: ids.length });
    } catch (error) {
        console.error('setOfferingStudents error:', error);
        res.status(500).json({ error: 'Failed to update offering students' });
    }
}

/**
 * POST /api/unit-offerings/:id/students/bulk-add — Body: { student_ids: [...] }
 */
export async function addOfferingStudents(req, res) {
    try {
        const { id } = req.params;
        const { student_ids } = req.body;
        if (!Array.isArray(student_ids) || student_ids.length === 0) {
            return res.status(400).json({ error: 'student_ids must be a non-empty array' });
        }

        const offering = await queryOne(`SELECT * FROM unit_offerings WHERE id = ${ph(1)}`, [id]);
        if (!offering) return res.status(404).json({ error: 'Offering not found' });

        let added = 0;
        for (const raw of new Set(student_ids.map(s => String(s).trim()).filter(Boolean))) {
            const exists = await queryOne(
                `SELECT 1 AS ok FROM offering_students WHERE offering_id = ${ph(1)} AND student_id = ${ph(2)}`,
                [id, raw]
            );
            if (exists) continue;
            await run(`INSERT INTO offering_students (offering_id, student_id) VALUES (${ph(1)}, ${ph(2)})`, [id, raw]);
            added++;
        }
        res.json({ success: true, offering_id: Number(id), added });
    } catch (error) {
        console.error('addOfferingStudents error:', error);
        res.status(500).json({ error: 'Failed to add students to offering' });
    }
}

/**
 * DELETE /api/unit-offerings/:id/students/:studentId
 */
export async function removeOfferingStudent(req, res) {
    try {
        const { id, studentId } = req.params;
        const result = await run(`DELETE FROM offering_students WHERE offering_id = ${ph(1)} AND student_id = ${ph(2)}`, [id, studentId]);
        if (result && result.changes === 0) return res.status(404).json({ error: 'Student is not in this offering' });
        res.json({ success: true, offering_id: Number(id), student_id: studentId });
    } catch (error) {
        console.error('removeOfferingStudent error:', error);
        res.status(500).json({ error: 'Failed to remove student from offering' });
    }
}
