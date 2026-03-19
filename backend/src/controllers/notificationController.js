import { query, queryOne } from '../config/database.js';

const isMongo = async () => !!process.env.MONGODB_URI;

const notificationController = {
    /**
     * Returns the 20 most recent announcements, shaped as notifications.
     * Read-state is managed on the frontend via localStorage.
     */
    getAll: async (req, res) => {
        try {
            let announcements = [];

            if (await isMongo()) {
                const Announcement = (await import('../models/mongo/Announcement.js')).default;
                const docs = await Announcement.find().sort({ date: -1, _id: -1 }).limit(20).lean();
                announcements = docs.map(a => ({
                    id: String(a._id),
                    title: a.title,
                    content: a.content,
                    type: 'announcement',
                    category: a.category || 'General',
                    priority: a.priority || 'medium',
                    time: a.date || new Date().toISOString().split('T')[0],
                    author: a.author,
                    read: false // client overrides this from localStorage
                }));
            } else {
                const rows = await query(
                    'SELECT id, title, content, category, priority, date, author FROM announcements ORDER BY date DESC, id DESC LIMIT 20'
                );
                announcements = rows.map(a => ({
                    id: String(a.id),
                    title: a.title,
                    content: a.content,
                    type: 'announcement',
                    category: a.category || 'General',
                    priority: a.priority || 'medium',
                    time: a.date || '',
                    author: a.author,
                    read: false
                }));
            }

            res.json(announcements);
        } catch (error) {
            console.error('Notification fetch error:', error);
            res.status(500).json({ message: error.message });
        }
    },

    markRead: async (req, res) => {
        // Read state is stored in localStorage on the client.
        // This endpoint just acknowledges the mark-read action.
        res.json({ success: true, id: req.params.id });
    }
};

export default notificationController;
