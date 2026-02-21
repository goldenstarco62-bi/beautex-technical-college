import xss from 'xss';

/**
 * Sanitizes an object or string to prevent XSS attacks.
 * @param {any} input - The input to sanitize
 * @returns {any} - The sanitized input
 */
export const sanitize = (input) => {
    if (typeof input === 'string') {
        return xss(input);
    }

    if (Array.isArray(input)) {
        return input.map(item => sanitize(item));
    }

    if (input !== null && typeof input === 'object') {
        const sanitizedObj = {};
        for (const [key, value] of Object.entries(input)) {
            sanitizedObj[key] = sanitize(value);
        }
        return sanitizedObj;
    }

    return input;
};

/**
 * Express middleware to sanitize request body, query, and params.
 */
export const sanitizeMiddleware = (req, res, next) => {
    if (req.body) req.body = sanitize(req.body);
    if (req.query) req.query = sanitize(req.query);
    if (req.params) req.params = sanitize(req.params);
    next();
};
