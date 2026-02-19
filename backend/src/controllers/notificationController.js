import { getDb } from '../config/database.js';

const notificationController = {
    getAll: async (req, res) => {
        try {
            const database = await getDb();
            // For now, we'll return an empty array until a notifications table is implemented.
            const notifications = [];
            res.json(notifications);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    markRead: async (req, res) => {
        try {
            res.json({ message: 'Notification marked as read' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
};

export default notificationController;
