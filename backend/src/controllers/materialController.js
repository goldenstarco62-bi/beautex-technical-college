import { query, queryOne, run } from '../config/database.js';

export async function getMaterials(req, res) {
    try {
        const { role, email } = req.user;
        const { courseId } = req.query;

        // Admin and Superadmin see everything
        if (role === 'admin' || role === 'superadmin') {
            let sql = `SELECT m.*, c.name as course_name FROM course_materials m LEFT JOIN courses c ON m.course_id = c.id`;
            let params = [];
            if (courseId) {
                sql += ` WHERE m.course_id = ?`;
                params.push(courseId);
            }
            sql += ` ORDER BY m.created_at DESC`;
            const materials = await query(sql, params);
            return res.json(materials);
        }

        // Teachers see materials for their courses
        if (role === 'teacher') {
            const faculty = await queryOne('SELECT name, courses FROM faculty WHERE email = ?', [email]);
            if (!faculty) return res.json([]);

            let coursesList = [];
            try {
                coursesList = typeof faculty.courses === 'string' ? JSON.parse(faculty.courses || '[]') : (faculty.courses || []);
            } catch (e) { }

            const placeholders = coursesList.length > 0 ? coursesList.map(() => '?').join(',') : "''";
            const tutorCourses = await query(`
                SELECT id FROM courses 
                WHERE instructor = ? OR name IN (${placeholders})
            `, [faculty.name, ...coursesList]);
            const validCourseIds = tutorCourses.map(c => String(c.id));

            if (validCourseIds.length === 0) return res.json([]);

            let sql = `
                SELECT m.*, c.name as course_name 
                FROM course_materials m 
                LEFT JOIN courses c ON m.course_id = c.id 
                WHERE m.course_id IN (${validCourseIds.map(() => '?').join(',')})
            `;
            let params = [...validCourseIds];

            if (courseId) {
                if (validCourseIds.includes(String(courseId))) {
                    sql += ` AND m.course_id = ?`;
                    params.push(courseId);
                } else {
                    return res.json([]); // Unauthorized access to this course's materials
                }
            }

            sql += ` ORDER BY m.created_at DESC`;
            const materials = await query(sql, params);
            return res.json(materials);
        }

        // Students see materials for their enrolled course
        if (role === 'student') {
            const student = await queryOne('SELECT course FROM students WHERE email = ?', [email]);
            if (!student) return res.json([]);

            const course = await queryOne('SELECT id FROM courses WHERE name = ?', [student.course]);
            if (!course) return res.json([]);

            const materials = await query(
                'SELECT m.*, c.name as course_name FROM course_materials m LEFT JOIN courses c ON m.course_id = c.id WHERE m.course_id = ? ORDER BY m.created_at DESC',
                [course.id]
            );
            return res.json(materials);
        }

        res.json([]);
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
