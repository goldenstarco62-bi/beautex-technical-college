import express from 'express';
import authRoutes from './authRoutes.js';
import studentRoutes from './studentRoutes.js';
import academicRoutes from './academicRoutes.js';
import financeRoutes from './financeRoutes.js';
import inventoryRoutes from './inventoryRoutes.js';
import systemRoutes from './systemRoutes.js';

const router = express.Router();

// Mount sub-routers (CORS and rate limits are handled at the main app level in server.js)
// IMPORTANT: academicRoutes must come BEFORE studentRoutes so that the specific
// /courses/:courseId/units/* routes take priority over the generic /courses/:id wildcard.
router.use('/', authRoutes);
router.use('/', academicRoutes);
router.use('/', studentRoutes);
router.use('/', financeRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/', systemRoutes);

// Multer error handler (file size & type errors)
router.use((err, req, res, next) => {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File is too large. Maximum size is 50 MB.' });
    }
    if (err && err.message && err.message.startsWith('File type not allowed')) {
        return res.status(415).json({ error: err.message });
    }
    next(err);
});

export default router;
