import { getDb, run } from '../config/database.js';

export async function logActivity({ userEmail, action, resource, resourceId, details, ipAddress }) {
    try {
        const db = await getDb();

        if (!!process.env.MONGODB_URI) {
            const AuditLog = (await import('../models/mongo/AuditLog.js')).default;
            const newLog = new AuditLog({
                user_email: userEmail,
                action,
                resource,
                resource_id: resourceId,
                details,
                ip_address: ipAddress
            });
            await newLog.save();
        } else {
            await run(
                'INSERT INTO audit_logs (user_email, action, resource, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
                [userEmail, action, resource, resourceId, details, ipAddress]
            );
        }
    } catch (error) {
        console.error('Failed to log activity:', error);
    }
}
