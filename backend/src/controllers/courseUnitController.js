/**
 * Course Unit Controller
 * Manages course-level competency units for the competency-based grading system.
 */
import { query, run, queryOne } from '../config/database.js';

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

/**
 * GET /api/courses/:courseId/units
 * Returns all units for a given course.
 * Auto-populates Computer Packages units if none exist.
 */
export async function getCourseUnits(req, res) {
    try {
        const { courseId } = req.params;

        // Verify course exists
        const course = await queryOne('SELECT * FROM courses WHERE id = ?', [courseId]);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        let units = await query(
            'SELECT * FROM course_units WHERE course_id = ? ORDER BY sort_order ASC, id ASC',
            [courseId]
        );

        // Auto-populate Computer Packages units on first access
        if (units.length === 0 && isComputerPackagesCourse(course.name)) {
            const inserts = COMPUTER_PACKAGES_UNITS.map((name, i) => ({ name, sort_order: i }));
            for (const unit of inserts) {
                await run(
                    'INSERT INTO course_units (course_id, name, sort_order) VALUES (?, ?, ?)',
                    [courseId, unit.name, unit.sort_order]
                );
            }
            units = await query(
                'SELECT * FROM course_units WHERE course_id = ? ORDER BY sort_order ASC, id ASC',
                [courseId]
            );
            console.log(`✅ Auto-populated ${units.length} Computer Packages units for course ${courseId}`);
        }

        res.json(units);
    } catch (error) {
        console.error('getCourseUnits error:', error);
        res.status(500).json({ error: 'Failed to fetch course units' });
    }
}

/**
 * POST /api/courses/:courseId/units
 * Creates a new unit for a course.
 */
export async function createCourseUnit(req, res) {
    try {
        const { courseId } = req.params;
        const { name, sort_order } = req.body;

        if (!name?.trim()) return res.status(400).json({ error: 'Unit name is required' });

        const course = await queryOne('SELECT id FROM courses WHERE id = ?', [courseId]);
        if (!course) return res.status(404).json({ error: 'Course not found' });

        // Determine next sort_order if not provided
        const existingMax = await queryOne(
            'SELECT MAX(sort_order) AS max_order FROM course_units WHERE course_id = ?',
            [courseId]
        );
        const nextOrder = sort_order !== undefined ? sort_order : ((existingMax?.max_order ?? -1) + 1);

        const result = await run(
            'INSERT INTO course_units (course_id, name, sort_order) VALUES (?, ?, ?)',
            [courseId, name.trim(), nextOrder]
        );

        const unit = await queryOne('SELECT * FROM course_units WHERE id = ?', [result.lastID]);
        res.status(201).json(unit);
    } catch (error) {
        console.error('createCourseUnit error:', error);
        res.status(500).json({ error: 'Failed to create course unit' });
    }
}

/**
 * PUT /api/courses/:courseId/units/:unitId
 * Updates a unit's name or sort_order.
 */
export async function updateCourseUnit(req, res) {
    try {
        const { courseId, unitId } = req.params;
        const { name, sort_order } = req.body;

        const unit = await queryOne(
            'SELECT * FROM course_units WHERE id = ? AND course_id = ?',
            [unitId, courseId]
        );
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

        const updatedName = name !== undefined ? name.trim() : unit.name;
        const updatedOrder = sort_order !== undefined ? sort_order : unit.sort_order;

        await run(
            'UPDATE course_units SET name = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [updatedName, updatedOrder, unitId]
        );

        const updated = await queryOne('SELECT * FROM course_units WHERE id = ?', [unitId]);
        res.json(updated);
    } catch (error) {
        console.error('updateCourseUnit error:', error);
        res.status(500).json({ error: 'Failed to update course unit' });
    }
}

/**
 * DELETE /api/courses/:courseId/units/:unitId
 * Deletes a unit (cascades to student_unit_marks via FK).
 */
export async function deleteCourseUnit(req, res) {
    try {
        const { courseId, unitId } = req.params;

        const unit = await queryOne(
            'SELECT * FROM course_units WHERE id = ? AND course_id = ?',
            [unitId, courseId]
        );
        if (!unit) return res.status(404).json({ error: 'Unit not found' });

        await run('DELETE FROM course_units WHERE id = ?', [unitId]);
        res.json({ message: 'Unit deleted successfully' });
    } catch (error) {
        console.error('deleteCourseUnit error:', error);
        res.status(500).json({ error: 'Failed to delete course unit' });
    }
}

/**
 * POST /api/courses/:courseId/units/reorder
 * Bulk-update sort_order for units.
 * Body: { order: [{ id, sort_order }, ...] }
 */
export async function reorderCourseUnits(req, res) {
    try {
        const { courseId } = req.params;
        const { order } = req.body;

        if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array' });

        for (const item of order) {
            await run(
                'UPDATE course_units SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND course_id = ?',
                [item.sort_order, item.id, courseId]
            );
        }

        const units = await query(
            'SELECT * FROM course_units WHERE course_id = ? ORDER BY sort_order ASC, id ASC',
            [courseId]
        );
        res.json(units);
    } catch (error) {
        console.error('reorderCourseUnits error:', error);
        res.status(500).json({ error: 'Failed to reorder units' });
    }
}
