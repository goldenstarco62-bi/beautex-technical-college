import jwt from 'jsonwebtoken';

/**
 * Fire-and-forget: update last_seen_at for the authenticated user.
 * Runs asynchronously — never blocks the request pipeline.
 * FIX: Now correctly handles both MongoDB and SQLite databases.
 */
function touchLastSeen(userId) {
    const now = new Date().toISOString();
    import('../config/database.js').then(({ run: dbRun, getProcessedDatabaseUrl }) => {
        // FIX: Only run SQL update when NOT using MongoDB
        if (!process.env.MONGODB_URI) {
            dbRun('UPDATE users SET last_seen_at = ? WHERE id = ?', [now, userId]).catch(() => { });
        } else {
            // MongoDB: update via Mongoose model
            import('../models/mongo/User.js').then(({ default: User }) => {
                User.findByIdAndUpdate(userId, { last_seen_at: new Date(now) }).catch(() => { });
            }).catch(() => { });
        }
    }).catch(() => { });
}

export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;

        // Fire-and-forget heartbeat — never blocks the request
        touchLastSeen(decoded.id);

        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired. Please log in again.' });
        }
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}

export function authorizeRoles(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const userRole = String(req.user.role || '').toLowerCase().trim();
        const allowedRoles = roles.map(r => String(r).toLowerCase().trim());

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
        }
        next();
    };
}
