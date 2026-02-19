import multer from 'multer';

// Use memory storage — Vercel serverless has no writable disk.
// Files are stored as Buffers in req.file.buffer during the request.
const storage = multer.memoryStorage();

// File type filter — allow documents, PDFs, images, office files, videos
const fileFilter = (req, file, cb) => {
    const ALLOWED_MIME_TYPES = [
        // PDFs
        'application/pdf',
        // Images
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        // Office
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        // Text
        'text/plain', 'text/csv',
        // Archives
        'application/zip', 'application/x-zip-compressed',
        // Video
        'video/mp4', 'video/webm',
        // Audio
        'audio/mpeg', 'audio/wav',
    ];

    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type not allowed: ${file.mimetype}. Upload PDFs, Office docs, images, videos, or zip files.`), false);
    }
};

// Max file size: 10 MB (memory storage — keep this reasonable)
export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Kept for any backward-compatible imports
export const uploadDir_path = null;
