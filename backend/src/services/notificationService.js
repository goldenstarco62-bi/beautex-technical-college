import { query, getActiveDbEngine } from '../config/database.js';

const isMongo = () => getActiveDbEngine() === 'mongodb';

export const notificationService = {
    /**
     * Creates a notification for a specific user or for all users (userId = null)
     */
    create: async ({ userId = null, title, content, type = 'info', priority = 'medium' }) => {
        try {
            if (isMongo()) {
                const Notification = (await import('../models/mongo/Notification.js')).default;
                await Notification.create({
                    user_id: userId,
                    title,
                    content,
                    type,
                    priority
                });
            } else {
                const isPostgres = getActiveDbEngine() === 'postgres';
                const sql = isPostgres 
                    ? 'INSERT INTO notifications (user_id, title, content, type, priority) VALUES ($1, $2, $3, $4, $5)'
                    : 'INSERT INTO notifications (user_id, title, content, type, priority) VALUES (?, ?, ?, ?, ?)';
                
                await query(sql, [userId, title, content, type, priority]);
            }
            console.log(`🔔 Notification created: ${title} -> ${userId || 'ALL'}`);
        } catch (error) {
            console.error('❌ Failed to create notification:', error);
        }
    },

    /**
     * Convenience method to notify all users
     */
    notifyAll: async (title, content, type = 'info') => {
        return notificationService.create({ userId: null, title, content, type });
    },

    /**
     * Convenience method to notify a specific user
     */
    notifyUser: async (userId, title, content, type = 'info') => {
        if (!userId) return;
        return notificationService.create({ userId, title, content, type });
    },

    /**
     * Notify a student by their student_id (resolves to user_id)
     */
    notifyStudent: async (studentId, title, content, type = 'info') => {
        try {
            let email;
            if (isMongo()) {
                const Student = (await import('../models/mongo/Student.js')).default;
                const student = await Student.findOne({ id: studentId });
                email = student?.email;
            } else {
                const student = await query('SELECT email FROM students WHERE id = ?', [studentId]);
                email = student[0]?.email;
            }

            if (!email) return;

            let userId;
            if (isMongo()) {
                const User = (await import('../models/mongo/User.js')).default;
                const user = await User.findOne({ email: email.toLowerCase() });
                userId = user?._id;
            } else {
                const user = await query('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
                userId = user[0]?.id;
            }

            if (userId) {
                await notificationService.notifyUser(String(userId), title, content, type);
            }
        } catch (error) {
            console.error('❌ notifyStudent error:', error);
        }
    }
};


export default notificationService;
