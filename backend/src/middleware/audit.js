import { run } from '../config/database.js';

export const logAudit = (action, resource = null) => {
    return async (req, res, next) => {
        const originalSend = res.send;

        res.send = function (body) {
            res.send = originalSend;
            
            // Only log successful operations (2xx) or as needed
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const userId = req.user?.id || null;
                const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
                
                let resourceId = req.params.id || null;
                let details = '';

                try {
                    if (req.method === 'POST' || req.method === 'PUT') {
                        // Sanitized body for sensitive info
                        const sanitizedBody = { ...req.body };
                        delete sanitizedBody.password;
                        delete sanitizedBody.token;
                        details = JSON.stringify(sanitizedBody);
                    }
                } catch (e) {
                    details = 'Error parsing details';
                }

                // Async logging as to not block the response
                run(
                    'INSERT INTO audit_logs (user_id, action, resource, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
                    [userId, action || `${req.method} ${req.originalUrl}`, resource, resourceId, details, ipAddress]
                ).catch(err => console.error('Failed to log audit:', err));
            }

            return originalSend.call(this, body);
        };

        next();
    };
};
