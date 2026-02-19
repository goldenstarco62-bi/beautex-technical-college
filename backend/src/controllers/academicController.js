import { query, queryOne, run } from '../config/database.js';

// Departments
export async function getDepartments(req, res) {
    try {
        const depts = await query('SELECT * FROM departments ORDER BY name');
        res.json(depts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function createDepartment(req, res) {
    try {
        const { name, head_of_department, description } = req.body;
        await run(
            'INSERT INTO departments (name, head_of_department, description) VALUES (?, ?, ?)',
            [name, head_of_department, description]
        );
        res.status(201).json({ message: 'Department created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// Academic Periods
export async function getAcademicPeriods(req, res) {
    try {
        const periods = await query('SELECT * FROM academic_periods ORDER BY start_date DESC');
        res.json(periods);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function createAcademicPeriod(req, res) {
    try {
        const { name, start_date, end_date } = req.body;
        await run(
            'INSERT INTO academic_periods (name, start_date, end_date) VALUES (?, ?, ?)',
            [name, start_date, end_date]
        );
        res.status(201).json({ message: 'Academic period created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function setActivePeriod(req, res) {
    try {
        const { id } = req.params;
        // Reset all
        await run('UPDATE academic_periods SET is_active = 0');
        // Set new active
        await run('UPDATE academic_periods SET is_active = 1, status = "Ongoing" WHERE id = ?', [id]);
        res.json({ message: 'Active period updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// Student Promotion
export async function promoteStudents(req, res) {
    try {
        const { studentIds, targetStatus } = req.body;
        if (!Array.isArray(studentIds)) return res.status(400).json({ error: 'studentIds must be an array' });

        const placeholders = studentIds.map(() => '?').join(',');
        await run(`UPDATE students SET status = ? WHERE id IN (${placeholders})`, [targetStatus, ...studentIds]);

        res.json({ message: `${studentIds.length} students promoted to ${targetStatus}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
