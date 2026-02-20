import { getDb, query, queryOne, run } from '../config/database.js';

async function isMongo() {
    const db = await getDb();
    return db.constructor.name === 'NativeConnection';
}

export async function getAllCourses(req, res) {
    try {
        const { role, email } = req.user;
        const mongo = await isMongo();

        // Admin and Superadmin see everything
        if (role === 'admin' || role === 'superadmin') {
            if (mongo) {
                const Course = (await import('../models/mongo/Course.js')).default;
                const courses = await Course.find().sort({ name: 1 });
                return res.json(courses);
            }
            const courses = await query("SELECT * FROM courses WHERE status = 'Active' ORDER BY name");
            return res.json(courses);
        }

        // Teachers see courses they instruct
        if (role === 'teacher') {
            if (mongo) {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                const faculty = await Faculty.findOne({ email });
                if (!faculty) return res.json([]);

                const courses = await Course.find({
                    $or: [
                        { instructor: faculty.name },
                        { name: { $in: faculty.courses || [] } }
                    ],
                    status: 'Active'
                }).sort({ name: 1 });
                return res.json(courses);
            }

            const faculty = await queryOne('SELECT name, courses FROM faculty WHERE email = ?', [email]);
            if (!faculty) return res.json([]);

            let facultyCourses = [];
            try {
                facultyCourses = typeof faculty.courses === 'string' ? JSON.parse(faculty.courses || '[]') : (faculty.courses || []);
            } catch (e) {
                facultyCourses = [];
            }

            const placeholders = facultyCourses.length > 0 ? facultyCourses.map(() => '?').join(',') : "''";
            const courses = await query(`
                SELECT * FROM courses 
                WHERE (instructor = ? OR name IN (${placeholders}))
                AND status = 'Active' 
                ORDER BY name
            `, [faculty.name, ...facultyCourses]);
            return res.json(courses);
        }

        // Students see their enrolled course
        if (role === 'student') {
            if (mongo) {
                const Student = (await import('../models/mongo/Student.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                const studentProfile = await Student.findOne({ email });
                if (!studentProfile) return res.json([]);

                const courses = await Course.find({ name: studentProfile.course, status: 'Active' });
                return res.json(courses);
            }

            const studentProfile = await queryOne('SELECT course FROM students WHERE email = ?', [email]);
            if (!studentProfile) return res.json([]);

            const courses = await query("SELECT * FROM courses WHERE name = ? AND status = 'Active'", [studentProfile.course]);
            return res.json(courses);
        }

        res.json([]);
    } catch (error) {
        console.error('Get courses error:', error);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
}

export async function getCourse(req, res) {
    try {
        if (await isMongo()) {
            const Course = (await import('../models/mongo/Course.js')).default;
            const course = await Course.findOne({ id: req.params.id });
            if (!course) return res.status(404).json({ error: 'Course not found' });
            return res.json(course);
        }

        const course = await queryOne('SELECT * FROM courses WHERE id = ?', [req.params.id]);
        if (!course) return res.status(404).json({ error: 'Course not found' });
        res.json(course);
    } catch (error) {
        console.error('Get course error:', error);
        res.status(500).json({ error: 'Failed to fetch course' });
    }
}

export async function createCourse(req, res) {
    try {
        if (await isMongo()) {
            const Course = (await import('../models/mongo/Course.js')).default;
            const { id, name, department, instructor, duration, capacity, schedule, room } = req.body;
            const newCourse = new Course({ id, name, department, instructor, duration, capacity, schedule, room });
            const savedCourse = await newCourse.save();
            return res.status(201).json(savedCourse);
        }

        const { id, name, department, instructor, duration, capacity, schedule, room } = req.body;
        await run(
            'INSERT INTO courses (id, name, department, instructor, duration, capacity, schedule, room, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, name, department, instructor, duration, capacity, schedule, room, 'Active']
        );
        const course = await queryOne('SELECT * FROM courses WHERE id = ?', [id]);
        res.status(201).json(course);
    } catch (error) {
        console.error('Create course error:', error);
        res.status(500).json({ error: 'Failed to create course' });
    }
}

export async function updateCourse(req, res) {
    try {
        if (await isMongo()) {
            const Course = (await import('../models/mongo/Course.js')).default;
            const updatedCourse = await Course.findOneAndUpdate(
                { id: req.params.id },
                { $set: { ...req.body, updated_at: new Date() } },
                { new: true, runValidators: true }
            );
            if (!updatedCourse) return res.status(404).json({ error: 'Course not found' });
            return res.json(updatedCourse);
        }

        const allowedFields = [
            'name', 'department', 'instructor', 'duration', 'capacity', 'schedule', 'room', 'status'
        ];
        const fields = Object.keys(req.body).filter(k => allowedFields.includes(k));
        if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => req.body[f]);
        values.push(new Date().toISOString()); // updated_at
        values.push(req.params.id);

        await run(`UPDATE courses SET ${setClause}, updated_at = ? WHERE id = ?`, values);
        const course = await queryOne('SELECT * FROM courses WHERE id = ?', [req.params.id]);
        if (!course) return res.status(404).json({ error: 'Course not found' });
        res.json(course);
    } catch (error) {
        console.error('Update course error:', error);
        res.status(500).json({ error: 'Failed to update course' });
    }
}

export async function deleteCourse(req, res) {
    try {
        if (await isMongo()) {
            const Course = (await import('../models/mongo/Course.js')).default;
            const result = await Course.findOneAndDelete({ id: req.params.id });
            if (!result) return res.status(404).json({ error: 'Course not found' });
            return res.json({ message: 'Course deleted successfully' });
        }

        const result = await run('DELETE FROM courses WHERE id = ?', [req.params.id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Course not found' });
        res.json({ message: 'Course deleted successfully' });
    } catch (error) {
        console.error('Delete course error:', error);
        res.status(500).json({ error: 'Failed to delete course' });
    }
}
