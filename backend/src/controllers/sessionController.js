import { getDb, query, queryOne, run } from '../config/database.js';

async function isMongo() {
    const db = await getDb();
    return db.constructor.name === 'NativeConnection';
}

export async function getAllSessions(req, res) {
    try {
        if (await isMongo()) {
            const Session = (await import('../models/mongo/Session.js')).default;
            const sessions = await Session.find().sort({ day: 1, time: 1 });
            return res.json(sessions);
        }

        const sessions = await query('SELECT * FROM sessions ORDER BY day, time');
        res.json(sessions);
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
