import jwt from 'jsonwebtoken';
import { run, getProcessedDatabaseUrl } from '../config/database.js';

/**
 * Fire-and-forget: update last_seen_at for the authenticated user.
 * Runs asynchronously — never blocks the request pipeline.
 */
function touchLastSeen(userId) {
    const now = new Date().toISOString();
    // Use a local import to avoid circular deps
    import('../config/database.js').then(({ run: dbRun, getProcessedDatabaseUrl: getDbUrl }) => {
        dbRun('UPDATE users SET last_seen_at = ? WHERE id = ?', [now, userId]).catch(() => { });
    }).catch(() => { });
}

export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT Verification Error:', err.message);
            return res.status(403).json({ error: `Invalid or expired token: ${err.message}` });
        }

        req.user = user;

        // Non-blocking: update last_seen_at in background
        if (user?.id) touchLastSeen(user.id);

        next();
    });
}

export function authorizeRoles(...roles) {
    return (req, res, next) => {
        const userRole = (req.user?.role ? String(req.user.role) : '').toLowerCase().trim();
        const allowedRoles = roles.map(r => String(r).toLowerCase().trim());

        if (!req.user || !allowedRoles.includes(userRole)) {
            return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
        }

        next();
    };
}
