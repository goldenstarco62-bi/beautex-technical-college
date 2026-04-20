import jwt from 'jsonwebtoken';

// In-memory cache to debounce last_seen updates (5-minute interval)
const lastSeenCache = new Map();
const HEARTBEAT_THROTTLE_MS = 5 * 60 * 1000; 


/**
 * Fire-and-forget: update last_seen_at for the authenticated user.
 * Runs asynchronously — never blocks the request pipeline.
 * FIX: Now correctly handles both MongoDB and SQLite databases.
 */
function touchLastSeen(userId) {
    const nowTs = Date.now();
    const lastUpdate = lastSeenCache.get(userId) || 0;

    // Only update DB if 5 minutes have passed since last update for this user
    if (nowTs - lastUpdate < HEARTBEAT_THROTTLE_MS) return;

    lastSeenCache.set(userId, nowTs);
    const nowStr = new Date(nowTs).toISOString();

    import('../config/database.js').then(({ run: dbRun }) => {
        if (!process.env.MONGODB_URI) {
            dbRun('UPDATE users SET last_seen_at = ? WHERE id = ?', [nowStr, userId]).catch(() => { });
        } else {
            import('../models/mongo/User.js').then(({ default: User }) => {
                User.findByIdAndUpdate(userId, { last_seen_at: new Date(nowTs) }).catch(() => { });
            }).catch(() => { });
        }
    }).catch(() => { });

    // Cleanup cache periodically (simple leak prevention)
    if (lastSeenCache.size > 1000) {
        const threshold = nowTs - (HEARTBEAT_THROTTLE_MS * 2);
        for (const [id, ts] of lastSeenCache.entries()) {
            if (ts < threshold) lastSeenCache.delete(id);
        }
    }
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

/**
 * Middleware: allows superadmin always; allows admin only if can_edit_finance is true in DB.
 * Blocks regular admins who have NOT been granted finance editing rights.
 * FIX: Now fetches fresh data from DB so permission changes are instant (don't require re-login).
 */
export async function authorizeFinanceEdit(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const role = String(req.user.role || '').toLowerCase().trim();
    if (role === 'superadmin') {
        return next();
    }

    if (role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Finance editing is restricted to authorized administrators.' });
    }

    try {
        const { queryOne } = await import('../config/database.js');
        let userRecord;
        
        if (!!process.env.MONGODB_URI) {
            const User = (await import('../models/mongo/User.js')).default;
            userRecord = await User.findById(req.user.id);
        } else {
            userRecord = await queryOne('SELECT can_edit_finance FROM users WHERE id = ?', [req.user.id]);
        }

        if (userRecord && userRecord.can_edit_finance) {
            return next();
        }

        return res.status(403).json({
            error: 'Access denied. Finance editing requires explicit permission from the Super Administrator.'
        });
    } catch (err) {
        console.error('AuthorizeFinanceEdit DB check failed:', err);
        // Fallback to token if DB check fails
        if (req.user.can_edit_finance) return next();
        res.status(500).json({ error: 'Internal server error verifying permissions' });
    }
}

/**
 * Middleware: allows superadmin always; allows admin only if can_edit_students is true in DB.
 * Allows restricted administrators to manage student-related user account functions
 * (password resets, status updates) without needing full superadmin access.
 */
export async function authorizeStudentEdit(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const role = String(req.user.role || '').toLowerCase().trim();
    if (role === 'superadmin') {
        return next();
    }

    if (role !== 'admin') {
        return res.status(403).json({ error: 'Access denied. Student registry editing is restricted to authorized administrators.' });
    }

    try {
        const { queryOne } = await import('../config/database.js');
        let userRecord;
        
        if (!!process.env.MONGODB_URI) {
            const User = (await import('../models/mongo/User.js')).default;
            userRecord = await User.findById(req.user.id);
        } else {
            userRecord = await queryOne('SELECT can_edit_students FROM users WHERE id = ?', [req.user.id]);
        }

        if (userRecord && userRecord.can_edit_students) {
            return next();
        }

        return res.status(403).json({
            error: 'Access denied. Student registry editing requires explicit permission from the Super Administrator.'
        });
    } catch (err) {
        console.error('AuthorizeStudentEdit DB check failed:', err);
        // Fallback to token if DB check fails
        if (req.user.can_edit_students) return next();
        res.status(500).json({ error: 'Internal server error verifying permissions' });
    }
}
