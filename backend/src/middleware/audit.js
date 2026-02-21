import { logActivity } from '../services/auditService.js';

export const logAudit = (action, resource = null) => {
    return async (req, res, next) => {
        const originalSend = res.send;

        res.send = function (body) {
            res.send = originalSend;

            // Only log successful operations (2xx)
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const userEmail = req.user?.email || 'System';
                const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

                let resourceId = req.params.id || null;
                let details = '';

                try {
                    if (req.method === 'POST' || req.method === 'PUT') {
                        const sanitizedBody = { ...req.body };
                        delete sanitizedBody.password;
                        delete sanitizedBody.token;
                        details = JSON.stringify(sanitizedBody);
                    }
                } catch (e) {
                    details = 'Error parsing details';
                }

                // Use the centralized logging service
                logActivity({
                    userEmail,
                    action: action || `${req.method} ${req.originalUrl}`,
                    resource,
                    resourceId,
                    details,
                    ipAddress
                }).catch(err => console.error('Failed to log audit:', err));
            }

            return originalSend.call(this, body);
        };

        next();
    };
};
