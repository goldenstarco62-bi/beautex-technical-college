import { query, queryOne } from '../config/database.js';

const isMongo = async () => !!process.env.MONGODB_URI;

const notificationController = {
    /**
     * Returns the 20 most recent announcements, shaped as notifications.
     * Read-state is managed on the frontend via localStorage.
     */
    getAll: async (req, res) => {
        try {
            const userId = req.user.id;
            let notifications = [];

            if (await isMongo()) {
                const Notification = (await import('../models/mongo/Notification.js')).default;
                const docs = await Notification.find({
                    $or: [{ user_id: userId }, { user_id: null }]
                }).sort({ created_at: -1 }).limit(30).lean();

                notifications = docs.map(n => ({
                    id: String(n._id),
                    title: n.title,
                    content: n.content,
                    type: n.type || 'info',
                    category: n.type === 'announcement' ? 'General' : 'System',
                    priority: n.priority || 'medium',
                    time: n.created_at,
                    read: n.is_read
                }));
            } else {
                const isPostgres = (await import('../config/database.js')).getActiveDbEngine() === 'postgres';
                const sql = isPostgres
                    ? 'SELECT id, title, content, type, priority, created_at, is_read FROM notifications WHERE user_id = $1 OR user_id IS NULL ORDER BY created_at DESC LIMIT 30'
                    : 'SELECT id, title, content, type, priority, created_at, is_read FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT 30';
                
                const rows = await query(sql, [userId]);
                notifications = rows.map(n => ({
                    id: String(n.id),
                    title: n.title,
                    content: n.content,
                    type: n.type || 'info',
                    category: 'System',
                    priority: n.priority || 'medium',
                    time: n.created_at,
                    read: !!n.is_read
                }));
            }

            res.json(notifications);
        } catch (error) {
            console.error('Notification fetch error:', error);
            res.status(500).json({ message: error.message });
        }
    },

    markRead: async (req, res) => {
        try {
            const { id } = req.params;
            if (await isMongo()) {
                const Notification = (await import('../models/mongo/Notification.js')).default;
                await Notification.findByIdAndUpdate(id, { is_read: true });
            } else {
                const isPostgres = (await import('../config/database.js')).getActiveDbEngine() === 'postgres';
                const sql = isPostgres 
                    ? 'UPDATE notifications SET is_read = TRUE WHERE id = $1'
                    : 'UPDATE notifications SET is_read = 1 WHERE id = ?';
                await query(sql, [id]);
            }
            res.json({ success: true, id });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }

};

export default notificationController;
