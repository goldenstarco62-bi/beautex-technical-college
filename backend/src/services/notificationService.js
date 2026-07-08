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
    },

    /**
     * Notify multiple students in bulk by student_id list
     */
    notifyStudentsBulk: async (notificationsList) => {
        if (!Array.isArray(notificationsList) || notificationsList.length === 0) return;
        try {
            const studentIds = [...new Set(notificationsList.map(n => String(n.studentId).trim()))];
            if (studentIds.length === 0) return;

            let users = [];
            if (isMongo()) {
                const Student = (await import('../models/mongo/Student.js')).default;
                const User = (await import('../models/mongo/User.js')).default;
                const studentDocs = await Student.find({ id: { $in: studentIds } }).select('id email').lean();
                const studentEmails = studentDocs.map(s => String(s.email).toLowerCase());
                const userDocs = await User.find({ email: { $in: studentEmails } }).select('id email').lean();
                const emailToUserId = new Map(userDocs.map(u => [String(u.email).toLowerCase(), u._id]));
                users = studentDocs.map(s => ({
                    student_id: s.id,
                    user_id: emailToUserId.get(String(s.email).toLowerCase())
                })).filter(u => u.user_id);
            } else {
                const placeholders = studentIds.map(() => '?').join(',');
                users = await query(
                    `SELECT s.id AS student_id, u.id AS user_id 
                     FROM students s 
                     JOIN users u ON LOWER(s.email) = LOWER(u.email) 
                     WHERE s.id IN (${placeholders})`,
                    studentIds
                );
            }

            const userMap = new Map(users.map(u => [String(u.student_id).trim(), String(u.user_id)]));

            if (isMongo()) {
                const Notification = (await import('../models/mongo/Notification.js')).default;
                const docs = notificationsList.map(n => {
                    const userId = userMap.get(String(n.studentId).trim());
                    if (!userId) return null;
                    return {
                        user_id: userId,
                        title: n.title,
                        content: n.content,
                        type: n.type || 'info',
                        priority: 'medium'
                    };
                }).filter(Boolean);
                if (docs.length > 0) {
                    await Notification.insertMany(docs);
                }
            } else {
                const isPostgres = getActiveDbEngine() === 'postgres';
                const sql = isPostgres 
                    ? 'INSERT INTO notifications (user_id, title, content, type) VALUES ($1, $2, $3, $4)'
                    : 'INSERT INTO notifications (user_id, title, content, type) VALUES (?, ?, ?, ?)';

                const database = await getDb();
                if (isPostgres) {
                    await database.query('BEGIN');
                    try {
                        for (const n of notificationsList) {
                            const userId = userMap.get(String(n.studentId).trim());
                            if (userId) {
                                await database.query(sql, [userId, n.title, n.content, n.type || 'info']);
                            }
                        }
                        await database.query('COMMIT');
                    } catch (err) {
                        await database.query('ROLLBACK');
                        throw err;
                    }
                } else {
                    await database.run('BEGIN');
                    try {
                        for (const n of notificationsList) {
                            const userId = userMap.get(String(n.studentId).trim());
                            if (userId) {
                                await database.run(sql, [userId, n.title, n.content, n.type || 'info']);
                            }
                        }
                        await database.run('COMMIT');
                    } catch (err) {
                        await database.run('ROLLBACK');
                        throw err;
                    }
                }
            }
            console.log(`🔔 Bulk notifications created for ${notificationsList.length} students`);
        } catch (error) {
            console.error('❌ notifyStudentsBulk error:', error);
        }
    }
};


export default notificationService;
