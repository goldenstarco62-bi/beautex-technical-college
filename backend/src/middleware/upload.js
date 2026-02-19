import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage — preserve original filename with timestamp prefix
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Sanitize original name: remove spaces & special chars, add timestamp
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .substring(0, 60);
        const uniqueName = `${Date.now()}_${base}${ext}`;
        cb(null, uniqueName);
    }
});

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

// Max file size: 50 MB
export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 }
});

export const uploadDir_path = uploadDir;
