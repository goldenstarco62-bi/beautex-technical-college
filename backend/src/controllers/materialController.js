import { query, queryOne, run } from '../config/database.js';

export async function getMaterials(req, res) {
    try {
        const { courseId } = req.query;
        let materials;
        if (courseId) {
            materials = await query(
                'SELECT m.*, c.name as course_name FROM course_materials m LEFT JOIN courses c ON m.course_id = c.id WHERE m.course_id = ? ORDER BY m.created_at DESC',
                [courseId]
            );
        } else {
            materials = await query(`
                SELECT m.*, c.name as course_name 
                FROM course_materials m 
                LEFT JOIN courses c ON m.course_id = c.id 
                ORDER BY m.created_at DESC
            `);
        }
        res.json(materials);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function uploadMaterial(req, res) {
    try {
        const { course_id, title, description } = req.body;
        const uploaded_by = req.user.email;

        // file_url can come from request body (link) OR from multer file upload
        let file_url = req.body.file_url || null;

        if (req.file) {
            // File uploaded via multipart/form-data (memoryStorage — no disk write on Vercel)
            // Store as a base64 data URI so it can be retrieved later.
            const mimeType = req.file.mimetype;
            const b64 = req.file.buffer.toString('base64');
            file_url = `data:${mimeType};base64,${b64}`;
        }

        if (!file_url) {
            return res.status(400).json({ error: 'A file or a file URL is required.' });
        }

        if (!course_id || !title) {
            return res.status(400).json({ error: 'course_id and title are required.' });
        }

        await run(
            'INSERT INTO course_materials (course_id, title, description, file_url, uploaded_by) VALUES (?, ?, ?, ?, ?)',
            [course_id, title, description || '', file_url, uploaded_by]
        );
        res.status(201).json({ message: 'Material uploaded successfully', file_url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function deleteMaterial(req, res) {
    try {
        const { id } = req.params;
        const userEmail = req.user.email;
        const role = req.user.role;

        // Only uploader or admin/superadmin can delete
        if (role !== 'admin' && role !== 'superadmin') {
            const material = await queryOne('SELECT * FROM course_materials WHERE id = ?', [id]);
            if (!material) return res.status(404).json({ error: 'Material not found' });
            if (material.uploaded_by !== userEmail) {
                return res.status(403).json({ error: 'Unauthorized to delete this material' });
            }
        }

        await run('DELETE FROM course_materials WHERE id = ?', [id]);
        res.json({ message: 'Material deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
