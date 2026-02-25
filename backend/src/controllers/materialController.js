import { query, queryOne, run, getDb } from '../config/database.js';

const isMongo = () => !!process.env.MONGODB_URI;

/**
 * GET /materials
 * Returns material metadata ONLY — never returns the raw base64 file_url body.
 * The actual file bytes are served by the separate GET /materials/:id/download endpoint.
 * This keeps the list response small even when materials are large.
 */
export async function getMaterials(req, res) {
    try {
        const { role, email, id: userId } = req.user;
        const { courseId } = req.query;

        if (isMongo()) {
            const CourseMaterial = (await import('../models/mongo/CourseMaterial.js')).default;
            const Course = (await import('../models/mongo/Course.js')).default;
            const Faculty = (await import('../models/mongo/Faculty.js')).default;
            const Student = (await import('../models/mongo/Student.js')).default;

            let filter = {};

            if (role === 'teacher') {
                // Only materials for courses this teacher is assigned to
                const userEmail = String(email || '').toLowerCase().trim();
                const faculty = await Faculty.findOne({ email: userEmail });
                if (!faculty) return res.json([]);

                // Extract name safely (handles cases where name might be missing or in different format)
                const facultyName = faculty.name;
                const facultyCourses = Array.isArray(faculty.courses) ? faculty.courses : [];

                const teacherCourses = await Course.find({
                    $or: [
                        { instructor: { $regex: new RegExp(`^${facultyName}$`, 'i') } },
                        { name: { $in: facultyCourses } }
                    ]
                }).select('_id name');
                const courseIds = teacherCourses.map(c => String(c._id));
                filter.course_id = { $in: courseIds };
            } else if (role === 'student') {
                // Students can be enrolled in multiple courses (array)
                const userEmail = String(email || '').toLowerCase().trim();
                const student = await Student.findOne({ email: userEmail });
                if (!student) return res.json([]);

                const studentCourses = Array.isArray(student.course)
                    ? student.course
                    : [student.course].filter(Boolean);

                const matchedCourses = await Course.find({
                    name: { $in: studentCourses }
                }).select('_id');
                const courseIds = matchedCourses.map(c => String(c._id));
                if (courseIds.length === 0) return res.json([]);
                filter.course_id = { $in: courseIds };
            }

            // Additional filter by specific course
            if (courseId) {
                if (filter.course_id && filter.course_id.$in) {
                    // Restrict further to the requested courseId (if it's in the allowed set)
                    if (!filter.course_id.$in.includes(String(courseId))) return res.json([]);
                    filter.course_id = String(courseId);
                } else {
                    filter.course_id = String(courseId);
                }
            }

            const materials = await CourseMaterial.find(filter).sort({ created_at: -1 });

            // Enrich with course names, strip the raw base64 from list response
            const enriched = await Promise.all(materials.map(async (m) => {
                const obj = m.toObject();
                if (!obj.course_name && obj.course_id) {
                    const course = await Course.findById(obj.course_id).select('name').catch(() => null);
                    obj.course_name = course?.name || '';
                }
                // FIX: Strip raw base64 data from list response — replaced by download URL
                if (obj.file_url && obj.file_url.startsWith('data:')) {
                    obj.file_url = null; // Client should use /materials/:id/download
                }
                obj.download_url = `/api/materials/${obj._id}/download`;
                return obj;
            }));

            return res.json(enriched);
        }

        // ── SQLite / PostgreSQL path ──────────────────────────────────────────
        // FIX: Build two query variants — full (with optional columns) and minimal (guaranteed columns).
        // If the production DB doesn't have file_name/file_size/mime_type yet, the minimal query is used.
        const fullSelectCols = `m.id, m.course_id, m.title, m.description, m.uploaded_by, m.file_name, m.file_size, m.mime_type, m.created_at, c.name as course_name`;
        const minimalSelectCols = `m.id, m.course_id, m.title, m.description, m.uploaded_by, m.created_at, c.name as course_name`;
        // NOTE: file_url deliberately excluded from SELECT to avoid sending massive base64 in list
        let sql = `SELECT ${fullSelectCols} FROM course_materials m LEFT JOIN courses c ON m.course_id = c.id`;
        let params = [];
        const conditions = [];

        if (role === 'teacher') {
            const userEmail = String(email || '').toLowerCase().trim();
            const faculty = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [userEmail]);
            if (!faculty) return res.json([]);

            let coursesList = [];
            try {
                coursesList = typeof faculty.courses === 'string'
                    ? JSON.parse(faculty.courses || '[]')
                    : (faculty.courses || []);
            } catch (e) { }

            const placeholders = coursesList.length > 0 ? coursesList.map(() => '?').join(',') : "''";
            const tutorCourses = await query(
                `SELECT id FROM courses WHERE LOWER(instructor) = LOWER(?) OR name IN (${placeholders})`
                , [faculty.name, ...coursesList]);
            const validCourseIds = tutorCourses.map(c => String(c.id));
            if (validCourseIds.length === 0) return res.json([]);

            conditions.push(`m.course_id IN (${validCourseIds.map(() => '?').join(',')})`);
            params.push(...validCourseIds);

        } else if (role === 'student') {
            const userEmail = String(email || '').toLowerCase().trim();
            const student = await queryOne('SELECT course FROM students WHERE LOWER(email) = LOWER(?)', [userEmail]);
            if (!student) return res.json([]);

            let studentCourses = [];
            try {
                if (student.course && String(student.course).startsWith('[')) {
                    studentCourses = JSON.parse(student.course);
                } else if (student.course) {
                    studentCourses = [student.course];
                }
            } catch {
                studentCourses = [student.course].filter(Boolean);
            }
            if (!Array.isArray(studentCourses)) studentCourses = [studentCourses];
            studentCourses = studentCourses.filter(Boolean);

            if (studentCourses.length === 0) return res.json([]);

            const matchedCourses = await query(
                `SELECT id FROM courses WHERE name IN (${studentCourses.map(() => '?').join(',')})`,
                studentCourses
            );
            const courseIds = matchedCourses.map(c => String(c.id));
            if (courseIds.length === 0) return res.json([]);

            conditions.push(`m.course_id IN (${courseIds.map(() => '?').join(',')})`);
            params.push(...courseIds);
        }
        // admin/superadmin: no filter

        if (courseId) {
            conditions.push('m.course_id = ?');
            params.push(courseId);
        }

        if (conditions.length > 0) {
            sql += ` WHERE ${conditions.join(' AND ')}`;
        }
        sql += ` ORDER BY m.created_at DESC`;

        let materials;
        try {
            materials = await query(sql, params);
        } catch (queryErr) {
            // If the full query fails due to missing optional columns, retry with minimal columns
            const missingCol = queryErr.message && (
                queryErr.message.includes('file_name') ||
                queryErr.message.includes('file_size') ||
                queryErr.message.includes('mime_type') ||
                queryErr.message.includes('does not exist') ||
                queryErr.message.includes('no such column')
            );
            if (missingCol) {
                console.warn('⚠️ getMaterials: schema drift — falling back to minimal SELECT. Run the migration to add file_name/file_size/mime_type columns.');
                const fallbackSql = sql.replace(fullSelectCols, minimalSelectCols);
                materials = await query(fallbackSql, params);
            } else {
                throw queryErr;
            }
        }

        // Attach download_url to each record for the frontend to use
        const enriched = materials.map(m => ({
            ...m,
            download_url: `/api/materials/${m.id}/download`,
            // file_url is null here since we excluded it from SELECT
        }));

        return res.json(enriched);
    } catch (error) {
        console.error('getMaterials error:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * GET /materials/:id/download
 * Streams the actual file content to the client.
 * For base64 data URIs: decodes to binary and sends with proper Content-Type.
 * For external URLs: redirects to the URL.
 */
export async function downloadMaterial(req, res) {
    try {
        const { id } = req.params;
        let material;

        if (isMongo()) {
            const CourseMaterial = (await import('../models/mongo/CourseMaterial.js')).default;
            material = await CourseMaterial.findById(id);
        } else {
            // Only include file_url in this targeted query
            material = await queryOne('SELECT id, title, file_url, file_name, mime_type FROM course_materials WHERE id = ?', [id]);
        }

        if (!material) return res.status(404).json({ error: 'Material not found' });

        const fileUrl = material.file_url;

        if (!fileUrl) {
            return res.status(404).json({ error: 'No file associated with this material' });
        }

        // Handle base64 data URI (uploaded files)
        if (fileUrl.startsWith('data:')) {
            const matches = fileUrl.match(/^data:(.+?);base64,(.+)$/);
            if (!matches) return res.status(500).json({ error: 'Corrupted file data' });

            const mimeType = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            const fileName = material.file_name || `${material.title}.${mimeType.split('/')[1]}`;

            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
            res.setHeader('Content-Length', buffer.length);
            return res.send(buffer);
        }

        // External URL — redirect
        return res.redirect(302, fileUrl);
    } catch (error) {
        console.error('downloadMaterial error:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * POST /materials
 * Accepts multipart/form-data (file) or JSON (file_url).
 */
export async function uploadMaterial(req, res) {
    try {
        const { course_id, title, description } = req.body;
        const uploaded_by = req.user.name || req.user.email;

        if (!course_id || !title) {
            return res.status(400).json({ error: 'course_id and title are required.' });
        }

        let file_url = req.body.file_url || null;
        let file_name = null;
        let file_size = null;
        let mime_type = null;

        if (req.file) {
            // Convert uploaded buffer to base64 data URI
            mime_type = req.file.mimetype;
            file_name = req.file.originalname;
            file_size = req.file.size;
            const b64 = req.file.buffer.toString('base64');
            file_url = `data:${mime_type};base64,${b64}`;
        }

        if (!file_url) {
            return res.status(400).json({ error: 'A file or a file URL is required.' });
        }

        let courseNameRow = null;
        if (isMongo()) {
            const Course = (await import('../models/mongo/Course.js')).default;
            courseNameRow = await Course.findById(course_id).select('name').catch(() => null);
        } else {
            courseNameRow = await queryOne('SELECT name FROM courses WHERE id = ?', [course_id]);
        }

        if (isMongo()) {
            const CourseMaterial = (await import('../models/mongo/CourseMaterial.js')).default;
            const newMaterial = new CourseMaterial({
                course_id,
                course_name: courseNameRow?.name || '',
                title,
                description: description || '',
                file_url,
                file_name,
                file_size,
                mime_type,
                uploaded_by,
            });
            const saved = await newMaterial.save();
            // Don't send the full base64 back
            const obj = saved.toObject();
            delete obj.file_url;
            obj.download_url = `/api/materials/${saved._id}/download`;
            return res.status(201).json({ message: 'Material uploaded successfully', material: obj });
        }

        // SQL: store extra metadata columns
        // FIX: Try the full INSERT first; if columns like file_name/file_size/mime_type
        // don't exist yet in the production DB (schema drift), fall back to core columns only.
        let result;
        try {
            result = await run(
                `INSERT INTO course_materials (course_id, title, description, file_url, file_name, file_size, mime_type, uploaded_by) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [course_id, title, description || '', file_url, file_name, file_size, mime_type, uploaded_by]
            );
        } catch (insertErr) {
            // If the error is about a missing column, retry with the minimal column set
            const missingColumn = insertErr.message && (
                insertErr.message.includes('file_name') ||
                insertErr.message.includes('file_size') ||
                insertErr.message.includes('mime_type') ||
                insertErr.message.includes('does not exist') ||
                insertErr.message.includes('no such column')
            );
            if (missingColumn) {
                console.warn('⚠️ course_materials schema drift detected — falling back to minimal INSERT. Run the migration SQL to add file_name/file_size/mime_type columns.');
                result = await run(
                    `INSERT INTO course_materials (course_id, title, description, file_url, uploaded_by) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [course_id, title, description || '', file_url, uploaded_by]
                );
            } else {
                throw insertErr;
            }
        }

        res.status(201).json({
            message: 'Material uploaded successfully',
            material: {
                id: result.lastID,
                course_id, title, description, file_name, file_size, mime_type, uploaded_by,
                download_url: `/api/materials/${result.lastID}/download`
            }
        });
    } catch (error) {
        console.error('uploadMaterial error:', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * DELETE /materials/:id
 */
export async function deleteMaterial(req, res) {
    try {
        const { id } = req.params;
        const userEmail = req.user.email;
        const { role } = req.user;

        if (isMongo()) {
            const CourseMaterial = (await import('../models/mongo/CourseMaterial.js')).default;
            const material = await CourseMaterial.findById(id);
            if (!material) return res.status(404).json({ error: 'Material not found' });

            if (role !== 'admin' && role !== 'superadmin' && material.uploaded_by !== userEmail) {
                return res.status(403).json({ error: 'Unauthorized to delete this material' });
            }

            await CourseMaterial.findByIdAndDelete(id);
            return res.json({ message: 'Material deleted' });
        }

        if (role !== 'admin' && role !== 'superadmin') {
            const material = await queryOne('SELECT uploaded_by FROM course_materials WHERE id = ?', [id]);
            if (!material) return res.status(404).json({ error: 'Material not found' });
            if (material.uploaded_by !== userEmail) {
                return res.status(403).json({ error: 'Unauthorized to delete this material' });
            }
        }

        await run('DELETE FROM course_materials WHERE id = ?', [id]);
        res.json({ message: 'Material deleted' });
    } catch (error) {
        console.error('deleteMaterial error:', error);
        res.status(500).json({ error: error.message });
    }
}
