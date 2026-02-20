import { getDb, query, queryOne, run } from '../config/database.js';

async function isMongo() {
    const db = await getDb();
    return db.constructor.name === 'NativeConnection';
}

export async function getAllSessions(req, res) {
    try {
        const { role, email } = req.user;
        const mongo = await isMongo();

        // Admin and Superadmin see everything
        if (role === 'admin' || role === 'superadmin') {
            if (mongo) {
                const Session = (await import('../models/mongo/Session.js')).default;
                const sessions = await Session.find().sort({ day: 1, time: 1 });
                return res.json(sessions);
            }
            const sessions = await query('SELECT * FROM sessions ORDER BY day, time');
            return res.json(sessions);
        }

        // Teachers see sessions they teach
        if (role === 'teacher') {
            if (mongo) {
                const Session = (await import('../models/mongo/Session.js')).default;
                const sessions = await Session.find({ teacher_email: email }).sort({ day: 1, time: 1 });
                return res.json(sessions);
            }
            const sessions = await query('SELECT * FROM sessions WHERE teacher_email = ? ORDER BY day, time', [email]);
            return res.json(sessions);
        }

        // Students see sessions for their enrolled course
        if (role === 'student') {
            if (mongo) {
                const Student = (await import('../models/mongo/Student.js')).default;
                const Session = (await import('../models/mongo/Session.js')).default;
                const sp = await Student.findOne({ email });
                if (!sp) return res.json([]);
                const sessions = await Session.find({ course: sp.course }).sort({ day: 1, time: 1 });
                return res.json(sessions);
            }
            const sp = await queryOne('SELECT course FROM students WHERE email = ?', [email]);
            if (!sp) return res.json([]);
            const sessions = await query('SELECT * FROM sessions WHERE course = ? ORDER BY day, time', [sp.course]);
            return res.json(sessions);
        }

        res.json([]);
    } catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
}

export async function createSession(req, res) {
    try {
        const { day, time, course, room, instructor, teacher_email } = req.body;

        if (await isMongo()) {
            const Session = (await import('../models/mongo/Session.js')).default;
            const newSession = new Session({ day, time, course, room, instructor, teacher_email });
            const saved = await newSession.save();
            return res.status(201).json(saved);
        }

        const result = await run(
            'INSERT INTO sessions (day, time, course, room, instructor, teacher_email) VALUES (?, ?, ?, ?, ?, ?)',
            [day, time, course, room, instructor, teacher_email]
        );
        const session = await queryOne('SELECT * FROM sessions WHERE id = ?', [result.lastID]);
        res.status(201).json(session);
    } catch (error) {
        console.error('Create session error:', error);
        res.status(500).json({ error: 'Failed to create session' });
    }
}

export async function deleteSession(req, res) {
    try {
        if (await isMongo()) {
            const Session = (await import('../models/mongo/Session.js')).default;
            const result = await Session.findByIdAndDelete(req.params.id);
            if (!result) return res.status(404).json({ error: 'Session not found' });
            return res.json({ message: 'Session deleted successfully' });
        }

        const result = await run('DELETE FROM sessions WHERE id = ?', [req.params.id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Session not found' });
        res.json({ message: 'Session deleted successfully' });
    } catch (error) {
        console.error('Delete session error:', error);
        res.status(500).json({ error: 'Failed to delete session' });
    }
}
