import { getDb, query, queryOne, run } from '../config/database.js';

async function isMongo() {
    const db = await getDb();
    return db.constructor.name === 'NativeConnection';
}

export async function getAllAttendance(req, res) {
    try {
        if (await isMongo()) {
            const Attendance = (await import('../models/mongo/Attendance.js')).default;
            const attendance = await Attendance.find().sort({ date: -1 });
            return res.json(attendance);
        }

        const attendance = await query('SELECT * FROM attendance ORDER BY date DESC LIMIT 1000');
        res.json(attendance);
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
}

export async function markAttendance(req, res) {
    try {
        const { student_id, course, date, status } = req.body;

        if (await isMongo()) {
            const Attendance = (await import('../models/mongo/Attendance.js')).default;
            const newAttendance = new Attendance({ student_id, course, date, status });
            const saved = await newAttendance.save();
            return res.status(201).json(saved);
        }

        const result = await run(
            'INSERT INTO attendance (student_id, course, date, status) VALUES (?, ?, ?, ?)',
            [student_id, course, date, status]
        );
        const attendance = await queryOne('SELECT * FROM attendance WHERE id = ?', [result.lastID]);
        res.status(201).json(attendance);
    } catch (error) {
        console.error('Mark attendance error:', error);
        res.status(500).json({ error: 'Failed to mark attendance' });
    }
}

export async function updateAttendance(req, res) {
    try {
        if (await isMongo()) {
            const Attendance = (await import('../models/mongo/Attendance.js')).default;
            const updated = await Attendance.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
            if (!updated) return res.status(404).json({ error: 'Attendance record not found' });
            return res.json(updated);
        }

        const { status } = req.body;
        await run('UPDATE attendance SET status = ? WHERE id = ?', [status, req.params.id]);
        const attendance = await queryOne('SELECT * FROM attendance WHERE id = ?', [req.params.id]);
        if (!attendance) return res.status(404).json({ error: 'Attendance record not found' });
        res.json(attendance);
    } catch (error) {
        console.error('Update attendance error:', error);
        res.status(500).json({ error: 'Failed to update attendance' });
    }
}
