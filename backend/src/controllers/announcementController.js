import { getDb, query, queryOne, run } from '../config/database.js';
import { sendAnnouncementEmail } from '../services/emailService.js';

const isMongo = async () => !!process.env.MONGODB_URI;

/**
 * Fetch ALL user emails from across the system: users + students + faculty tables.
 * Deduplicates to avoid sending the same person multiple emails.
 */
async function getAllUserEmails() {
    try {
        const mongo = await isMongo();
        const emailSet = new Set();

        if (mongo) {
            // Pull from User model
            const User = (await import('../models/mongo/User.js')).default;
            const users = await User.find({}, 'email').lean();
            users.forEach(u => u.email && emailSet.add(u.email.toLowerCase().trim()));

            // Pull from Faculty model
            try {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const faculty = await Faculty.find({}, 'email').lean();
                faculty.forEach(f => f.email && emailSet.add(f.email.toLowerCase().trim()));
            } catch (e) { console.warn('Faculty email fetch skipped:', e.message); }

            // Pull from Student model
            try {
                const Student = (await import('../models/mongo/Student.js')).default;
                const students = await Student.find({}, 'email').lean();
                students.forEach(s => s.email && emailSet.add(s.email.toLowerCase().trim()));
            } catch (e) { console.warn('Student email fetch skipped:', e.message); }

        } else {
            // SQL path — pull from all three tables
            const [userRows, facultyRows, studentRows] = await Promise.all([
                query('SELECT email FROM users').catch(() => []),
                query('SELECT email FROM faculty').catch(() => []),
                query('SELECT email FROM students').catch(() => []),
            ]);
            [...userRows, ...facultyRows, ...studentRows]
                .map(r => r.email)
                .filter(Boolean)
                .forEach(e => emailSet.add(e.toLowerCase().trim()));
        }

        const emails = [...emailSet].filter(Boolean);
        console.log(`📋 Email recipients gathered: ${emails.length} unique address(es).`);
        return emails;
    } catch (err) {
        console.error('⚠️  Could not fetch user emails for announcement notification:', err.message);
        return [];
    }
}


export async function getAllAnnouncements(req, res) {
    try {
        if (await isMongo()) {
            const Announcement = (await import('../models/mongo/Announcement.js')).default;
            const announcements = await Announcement.find().sort({ date: -1, _id: -1 });
            return res.json(announcements);
        }

        const announcements = await query('SELECT * FROM announcements ORDER BY date DESC, id DESC');
        res.json(announcements);
    } catch (error) {
        console.error('Get announcements error:', error);
        res.status(500).json({ error: 'Failed to fetch announcements' });
    }
}

export async function createAnnouncement(req, res) {
    try {
        const { title, content, author, category, priority, date } = req.body;

        let savedAnnouncement;

        if (await isMongo()) {
            const Announcement = (await import('../models/mongo/Announcement.js')).default;
            const newAnnouncement = new Announcement({ title, content, author, category, priority, date });
            savedAnnouncement = await newAnnouncement.save();
            res.status(201).json(savedAnnouncement);
        } else {
            const result = await run(
                'INSERT INTO announcements (title, content, author, category, priority, date) VALUES (?, ?, ?, ?, ?, ?)',
                [title, content, author, category, priority, date || new Date().toISOString().split('T')[0]]
            );
            savedAnnouncement = await queryOne('SELECT * FROM announcements WHERE id = ?', [result.lastID]);
            res.status(201).json(savedAnnouncement);
        }

        // ✉️ Send email notifications in the background
        getAllUserEmails()
            .then(emails => {
                if (emails && emails.length > 0) {
                    console.log(`📢 Announcement Broadcast: Found ${emails.length} active recipient(s).`);
                    console.log(`📧 Dispatching bulletins to: ${emails.slice(0, 5).join(', ')}${emails.length > 5 ? '...' : ''}`);
                    return sendAnnouncementEmail(savedAnnouncement, emails);
                } else {
                    console.warn('⚠️ No active user emails found for announcement notification.');
                }
            })
            .catch(err => {
                console.error('❌ Critical failure in background announcement broadcast:', err.stack || err);
            });

    } catch (error) {
        console.error('Create announcement error:', error);
        res.status(500).json({ error: 'Failed to create announcement' });
    }
}

export async function updateAnnouncement(req, res) {
    try {
        if (await isMongo()) {
            const Announcement = (await import('../models/mongo/Announcement.js')).default;
            const updated = await Announcement.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
            if (!updated) return res.status(404).json({ error: 'Announcement not found' });
            return res.json(updated);
        }

        const allowedFields = ['title', 'content', 'author', 'category', 'priority', 'date'];
        const fields = Object.keys(req.body).filter(k => allowedFields.includes(k));
        if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => req.body[f]);
        values.push(req.params.id);

        await run(`UPDATE announcements SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);
        const announcement = await queryOne('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
        if (!announcement) return res.status(404).json({ error: 'Announcement not found' });
        res.json(announcement);
    } catch (error) {
        console.error('Update announcement error:', error);
        res.status(500).json({ error: 'Failed to update announcement' });
    }
}

export async function deleteAnnouncement(req, res) {
    try {
        if (await isMongo()) {
            const Announcement = (await import('../models/mongo/Announcement.js')).default;
            const result = await Announcement.findByIdAndDelete(req.params.id);
            if (!result) return res.status(404).json({ error: 'Announcement not found' });
            return res.json({ message: 'Announcement deleted successfully' });
        }

        const result = await run('DELETE FROM announcements WHERE id = ?', [req.params.id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Announcement not found' });
        res.json({ message: 'Announcement deleted successfully' });
    } catch (error) {
        console.error('Delete announcement error:', error);
        res.status(500).json({ error: 'Failed to delete announcement' });
    }
}
