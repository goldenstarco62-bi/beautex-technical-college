import { query, queryOne, run } from '../config/database.js';

const isMongo = () => !!process.env.MONGODB_URI;

// Departments
export async function getDepartments(req, res) {
    try {
        if (isMongo()) {
            const Department = (await import('../models/mongo/Department.js')).default;
            const depts = await Department.find().sort({ name: 1 });
            return res.json(depts);
        }
        const depts = await query('SELECT * FROM departments ORDER BY name');
        res.json(depts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function createDepartment(req, res) {
    try {
        const { name, head_of_department, description } = req.body;
        if (isMongo()) {
            const Department = (await import('../models/mongo/Department.js')).default;
            const newDept = new Department({ name, head_of_department, description });
            await newDept.save();
            return res.status(201).json({ message: 'Department created' });
        }
        await run(
            'INSERT INTO departments (name, head_of_department, description) VALUES (?, ?, ?)',
            [name, head_of_department, description]
        );
        res.status(201).json({ message: 'Department created' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function updateDepartment(req, res) {
    try {
        const { id } = req.params;
        const { name, head_of_department, description } = req.body;
        if (isMongo()) {
            const Department = (await import('../models/mongo/Department.js')).default;
            await Department.findByIdAndUpdate(id, { name, head_of_department, description });
            return res.json({ message: 'Department updated' });
        }
        await run(
            'UPDATE departments SET name = ?, head_of_department = ?, description = ? WHERE id = ?',
            [name, head_of_department, description, id]
        );
        res.json({ message: 'Department updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function deleteDepartment(req, res) {
    try {
        const { id } = req.params;
        if (isMongo()) {
            const Department = (await import('../models/mongo/Department.js')).default;
            await Department.findByIdAndDelete(id);
            return res.json({ message: 'Department deleted' });
        }
        await run('DELETE FROM departments WHERE id = ?', [id]);
        res.json({ message: 'Department deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// Academic Periods
export async function getAcademicPeriods(req, res) {
    try {
        if (isMongo()) {
            const AcademicPeriod = (await import('../models/mongo/AcademicPeriod.js')).default;
            const periods = await AcademicPeriod.find().sort({ start_date: -1 });
            return res.json(periods);
        }
        const periods = await query('SELECT * FROM academic_periods ORDER BY start_date DESC');
        res.json(periods);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function createAcademicPeriod(req, res) {
    try {
        const { name, start_date, end_date } = req.body;
        if (isMongo()) {
            const AcademicPeriod = (await import('../models/mongo/AcademicPeriod.js')).default;
            const newPeriod = new AcademicPeriod({ name, start_date, end_date });
            await newPeriod.save();
            return res.status(201).json({ message: 'Academic period created' });
        }
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
        if (isMongo()) {
            const AcademicPeriod = (await import('../models/mongo/AcademicPeriod.js')).default;
            // Reset all
            await AcademicPeriod.updateMany({}, { is_active: false });
            // Set new active
            await AcademicPeriod.findByIdAndUpdate(id, { is_active: true, status: 'Ongoing' });
            return res.json({ message: 'Active period updated' });
        }
        // Reset all
        await run('UPDATE academic_periods SET is_active = false');
        // Set new active
        await run('UPDATE academic_periods SET is_active = true, status = ? WHERE id = ?', ['Ongoing', id]);
        res.json({ message: 'Active period updated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function deleteAcademicPeriod(req, res) {
    try {
        const { id } = req.params;
        if (isMongo()) {
            const AcademicPeriod = (await import('../models/mongo/AcademicPeriod.js')).default;
            await AcademicPeriod.findByIdAndDelete(id);
            return res.json({ message: 'Academic period deleted' });
        }
        await run('DELETE FROM academic_periods WHERE id = ?', [id]);
        res.json({ message: 'Academic period deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// Student Promotion
export async function promoteStudents(req, res) {
    try {
        const { studentIds, targetStatus } = req.body;
        if (!Array.isArray(studentIds)) return res.status(400).json({ error: 'studentIds must be an array' });

        if (isMongo()) {
            const Student = (await import('../models/mongo/Student.js')).default;
            await Student.updateMany({ id: { $in: studentIds } }, { status: targetStatus });
            return res.json({ message: `${studentIds.length} students promoted to ${targetStatus}` });
        }

        const placeholders = studentIds.map(() => '?').join(',');
        await run(`UPDATE students SET status = ? WHERE id IN (${placeholders})`, [targetStatus, ...studentIds]);

        res.json({ message: `${studentIds.length} students promoted to ${targetStatus}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
