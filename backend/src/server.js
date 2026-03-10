import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { initializeDatabase, getDb, query, queryOne, run, getProcessedDatabaseUrl } from './config/database.js';
import { authenticateToken, authorizeRoles } from './middleware/auth.js';
import { sanitizeMiddleware } from './utils/sanitize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Initial parsers at start (Security: Reduced limits to prevent DoS)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb', parameterLimit: 1000 }));

// Global XSS Sanitization
app.use(sanitizeMiddleware);

// HTTPS Redirection for Production (Vercel/Heroku/Cloud)
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect(`https://${req.headers.host}${req.url}`);
        }
        next();
    });
}

// Advanced Security Headers (CSP)
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline often needed for dev/simple react apps
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'", "https:", "wss:", "http://localhost:5000", "http://127.0.0.1:5000"],
            frameAncestors: ["'none'"],
        },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xContentTypeOptions: true,
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
    ieNoOpen: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: { policy: 'none' },
    xssFilter: true,
}));
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    // Deployed frontend — always allowed
    'https://bttc.vercel.app',
    'https://beautexcollege-01.vercel.app',
    'https://beautex-technical-college-pvk4.vercel.app'
];

if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
    // Also allow potential Netlify subdomains or primary domains
    if (process.env.FRONTEND_URL.includes('netlify.app')) {
        const domain = process.env.FRONTEND_URL.split('//')[1];
        allowedOrigins.push(`https://${domain}`);
    }
}

// FIX: Removed wildcard 'vercel.app' that allowed ANY Vercel deployment to access the API.
// Only explicitly listed origins are permitted in production.
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);

        // If in development, allow all
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }

        // In production: check against the explicit allowedOrigins list only
        const isAllowed = allowedOrigins.some(o => origin === o || origin.startsWith(o));

        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn(`Blocked by CORS: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Rate Limiting Configuration: Strict Brute Force Protection
const authLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    limit: 5, // Limit each IP to 5 FAILED attempts per windowMs
    message: { error: 'Too many failed login attempts. For security, your IP has been blocked for 30 minutes.' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Only failed attempts (4xx/5xx) count towards the limit
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    limit: 100, // Limit each IP to 100 requests per minute
    message: { error: 'Too many requests. Please slow down.' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});

// Apply global rate limiter
app.use('/api/', apiLimiter);

// Specific limiter for sensitive auth routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// Request logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Health check route (No DB required)
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', uptime: process.uptime(), timestamp: new Date() });
});

// Utility to catch errors during request handling
process.on('uncaughtException', (err) => {
    console.error('🔥 CRITICAL UNCAUGHT EXCEPTION:', err);
});

// Initialize database (deferred to first request or async background)
let dbInitialized = false;
let loadedApiRoutes = null;

const ensureServices = async (req, res, next) => {
    try {
        if (!dbInitialized) {
            console.log('🏗️ First request received. Initializing services...');
            await initializeDatabase();
            dbInitialized = true;
        }

        if (!loadedApiRoutes) {
            console.log('💉 Lazy loading API routes...');
            const { default: routes } = await import('./routes/api.js');
            loadedApiRoutes = routes;
        }

        next();
    } catch (error) {
        console.error('❌ Service initialization failed:', error);
        res.status(500).json({
            error: 'Service initialization failed. Website is partially offline.',
            details: error.message
        });
    }
};

// Internal API routes (Lazy Loaded)
app.use('/api', ensureServices, (req, res, next) => {
    if (loadedApiRoutes) {
        return loadedApiRoutes(req, res, next);
    }
    next();
});



// Root route
app.get('/', async (req, res) => {
    let dbType = 'Unknown';
    if (process.env.MONGODB_URI?.trim()) dbType = 'MongoDB';
    else if (process.env.DATABASE_URL?.trim()) dbType = 'PostgreSQL (Supabase)';
    else dbType = 'SQLite';

    res.json({
        message: 'Welcome to BTTC Management System API',
        environment: process.env.NODE_ENV,
        active_database: dbType,
        ver_check: '1.2.0',
        config_check: {
            db_url_set: !!process.env.DATABASE_URL?.trim(),
            mongo_uri_set: !!process.env.MONGODB_URI?.trim(),
            jwt_secret_set: !!process.env.JWT_SECRET?.trim()
        },
        timestamp: new Date()
    });
});



// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server only when NOT running as a Vercel serverless function
// (On Vercel, the exported `app` is used directly — no TCP listener needed)
if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`\n🚀 Server running on http://localhost:${PORT}`);
        console.log(`📚 API Documentation: http://localhost:${PORT}/api`);
        console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
}

export default app;
