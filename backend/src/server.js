import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase, getDb, query, queryOne, run, getProcessedDatabaseUrl } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Initial parsers at start
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb', parameterLimit: 100000 }));

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174'
];

if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
    // Also allow potential Netlify subdomains or primary domains
    if (process.env.FRONTEND_URL.includes('netlify.app')) {
        const domain = process.env.FRONTEND_URL.split('//')[1];
        allowedOrigins.push(`https://${domain}`);
    }
}

// Always allow Vercel domains in production for this test deployment
allowedOrigins.push('vercel.app');

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // If in development, allow all
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }

        // If in production, check against allowedOrigins
        const isAllowed = allowedOrigins.some(o => {
            if (o === 'vercel.app') return origin.endsWith('.vercel.app');
            return origin.startsWith(o);
        });

        if (isAllowed) {
            callback(null, true);
        } else {
            console.warn(`Blocked by CORS: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

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

// Database check route for debugging
app.get('/api/db-check', ensureServices, async (req, res) => {
    try {
        const db = await getDb();
        const isMongo = db.constructor.name === 'NativeConnection';

        if (isMongo) {
            const User = (await import('./models/mongo/User.js')).default;
            const userCount = await User.countDocuments();
            return res.json({
                status: '✅ Connected to MongoDB Atlas',
                database: 'MongoDB',
                users: userCount,
                message: 'MongoDB is active.'
            });
        }

        // Supabase / PostgreSQL Check
        if (getProcessedDatabaseUrl()) {
            const userCount = await queryOne('SELECT COUNT(*) as count FROM users');
            return res.json({
                status: '✅ Connected to Supabase (PostgreSQL)',
                database: 'PostgreSQL',
                users: userCount.count,
                message: 'Supabase is active.'
            });
        }

        // SQLite Check
        const userCount = await queryOne('SELECT COUNT(*) as count FROM users');
        res.json({
            status: '✅ Connected to local SQLite',
            database: 'SQLite',
            users: userCount.count,
            message: 'SQLite is active. Vercel deployments require MongoDB or a cloud database.'
        });

    } catch (error) {
        console.error('❌ Database Check Failed:', error);
        res.status(500).json({
            status: '❌ Database Connection Failed',
            error: error.message
        });
    }
});

// Root route
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to BTTC Management System API',
        environment: process.env.NODE_ENV,
        config_check: {
            db_url_set: !!process.env.DATABASE_URL,
            mongo_uri_set: !!process.env.MONGODB_URI,
            jwt_secret_set: !!process.env.JWT_SECRET
        },
        timestamp: new Date()
    });
});

// SMTP Diagnostic Route (Hidden)
app.get('/api/diag/smtp', async (req, res) => {
    try {
        const { sendWelcomeEmail } = await import('./services/emailService.js');
        const { getDb } = await import('./config/database.js');
        const testEmail = req.query.email || process.env.SMTP_USER;

        const db = await getDb();
        const dbType = db.constructor.name === 'NativeConnection' ? 'MongoDB' : (process.env.DATABASE_URL ? 'PostgreSQL' : 'SQLite');

        if (!testEmail) {
            return res.status(400).json({
                error: 'No test email provided',
                db_type: dbType,
                smtp_user_set: !!process.env.SMTP_USER,
                smtp_pass_set: !!process.env.SMTP_PASS
            });
        }

        console.log(`📡 Triggering diagnostic email to: ${testEmail}`);
        const success = await sendWelcomeEmail(testEmail, 'Diagnostic User', 'diag123');

        res.json({
            success,
            recipient: testEmail,
            db_type: dbType,
            smtp_config: {
                user: process.env.SMTP_USER ? `${process.env.SMTP_USER.slice(0, 3)}...` : 'NOT SET',
                from_address: process.env.SMTP_USER,
                node_env: process.env.NODE_ENV
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
