import { getDb, query, queryOne, run } from '../config/database.js';

const isMongo = async () => !!process.env.MONGODB_URI;

// Helper to parse student course field robustly
function parseStudentCourses(courseField) {
    if (!courseField) return [];
    if (Array.isArray(courseField)) return courseField;
    if (typeof courseField === 'string') {
        const trimmed = courseField.trim();
        if (trimmed.startsWith('[')) {
            try {
                return JSON.parse(trimmed);
            } catch (e) {
                // fall through
            }
        }
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            return trimmed.slice(1, -1).split(',').map(s => s.replace(/^"|"$/g, '').trim()).filter(Boolean);
        }
        return trimmed.split(',').map(c => c.trim()).filter(Boolean);
    }
    return [];
}

// Helper to enrich SQLite/PostgreSQL courses with in-memory aggregated student enrollment counts
async function enrichCoursesWithEnrollment(courses) {
    if (!courses || courses.length === 0) return [];
    
    // Fetch courses from all students
    const studentCoursesList = await query("SELECT course FROM students");
    const courseCounts = {};
    for (const s of studentCoursesList) {
        const list = parseStudentCourses(s.course);
        for (const c of list) {
            const key = String(c).toLowerCase().trim();
            courseCounts[key] = (courseCounts[key] || 0) + 1;
        }
    }
    
    return courses.map(course => ({
        ...course,
        enrolled: courseCounts[String(course.name).toLowerCase().trim()] || 0
    }));
}

export async function getAllCourses(req, res) {
    try {
        const currentRole = String(req.user.role || '').toLowerCase().trim();
        const { email } = req.user;
        const mongo = await isMongo();

        // Admin and Superadmin see everything
        if (currentRole === 'admin' || currentRole === 'superadmin') {
            if (mongo) {
                const Course = (await import('../models/mongo/Course.js')).default;
                const Student = (await import('../models/mongo/Student.js')).default;
                const courses = await Course.find().sort({ name: 1 }).lean();

                // Manually add counts for Mongo
                for (const course of courses) {
                    const safeName = course.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    course.enrolled = await Student.countDocuments({
                        course: { $regex: new RegExp(`^${safeName}$`, 'i') }
                    });
                }
                return res.json(courses);
            }
            const courses = await query(`SELECT * FROM courses ORDER BY name`);
            const enriched = await enrichCoursesWithEnrollment(courses);
            return res.json(enriched);
        }

        // Teachers see courses they instruct
        if (currentRole === 'teacher') {
            if (mongo) {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                const Student = (await import('../models/mongo/Student.js')).default;
                // FIX: Case-insensitive email lookup to handle any casing mismatches
                const faculty = await Faculty.findOne({ email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
                if (!faculty) return res.json([]);

                const courses = await Course.find({
                    $or: [
                        { instructor: faculty.name },
                        { name: { $in: faculty.courses || [] } }
                    ],
                    status: 'Active'
                }).sort({ name: 1 }).lean();

                for (const course of courses) {
                    const safeName = course.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    course.enrolled = await Student.countDocuments({
                        course: { $regex: new RegExp(`^${safeName}$`, 'i') }
                    });
                }
                return res.json(courses);
            }

            const faculty = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [email]);
            if (!faculty) return res.json([]);

            let facultyCourses = [];
            if (faculty.courses) {
                try {
                    if (faculty.courses.startsWith('[')) {
                        facultyCourses = JSON.parse(faculty.courses);
                    } else {
                        facultyCourses = faculty.courses.split(',').map(s => s.trim());
                    }
                } catch (e) {
                    console.error('Error parsing faculty courses:', e);
                    facultyCourses = [];
                }
            }

            const placeholders = facultyCourses.length > 0 ? facultyCourses.map(() => '?').join(',') : "''";
            const courses = await query(`
                SELECT * FROM courses
                WHERE (instructor = ? OR name IN (${placeholders}))
                AND status = 'Active' 
                ORDER BY name
            `, [faculty.name, ...facultyCourses]);
            const enriched = await enrichCoursesWithEnrollment(courses);
            return res.json(enriched);
        }

        // Students see their enrolled courses
        if (currentRole === 'student') {
            if (mongo) {
                const Student = (await import('../models/mongo/Student.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                // FIX: Case-insensitive email lookup to handle any casing mismatches
                const studentProfile = await Student.findOne({ email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
                if (!studentProfile) return res.json([]);

                // Support array of courses
                const studentCourses = Array.isArray(studentProfile.course)
                    ? studentProfile.course
                    : [studentProfile.course].filter(Boolean);

                if (studentCourses.length === 0) return res.json([]);

                // FIX: Case-insensitive course name matching
                const courses = await Course.find({
                    name: { $in: studentCourses.map(c => new RegExp(`^${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')) },
                    status: 'Active'
                }).lean();

                for (const course of courses) {
                    const safeName = course.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    course.enrolled = await Student.countDocuments({
                        course: { $regex: new RegExp(`^${safeName}$`, 'i') }
                    });
                }
                return res.json(courses);
            }

            const studentProfile = await queryOne('SELECT course FROM students WHERE LOWER(email) = LOWER(?)', [email]);
            if (!studentProfile) return res.json([]);

            // Support JSON array strings or single course strings
            let studentCourses = [];
            try {
                const raw = studentProfile.course || '';
                if (typeof raw === 'string' && raw.startsWith('{') && raw.endsWith('}')) {
                    // PostgreSQL array literal: {"Course A","Course B"}
                    studentCourses = raw.slice(1, -1).split(',').map(s => s.replace(/^"|"$/g, '').trim()).filter(Boolean);
                } else if (typeof raw === 'string' && raw.startsWith('[')) {
                    studentCourses = JSON.parse(raw);
                } else if (raw) {
                    studentCourses = [raw];
                }
            } catch (e) {
                studentCourses = [studentProfile.course].filter(Boolean);
            }

            if (studentCourses.length === 0) return res.json([]);

            const placeholders = studentCourses.map(() => '?').join(',');
            const courses = await query(`
                SELECT * FROM courses 
                WHERE name IN (${placeholders}) AND status = 'Active'
            `, studentCourses);
            const enriched = await enrichCoursesWithEnrollment(courses);
            return res.json(enriched);
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
            const Student = (await import('../models/mongo/Student.js')).default;
            const course = await Course.findOne({ id: req.params.id }).lean();
            if (!course) return res.status(404).json({ error: 'Course not found' });

            const safeName = course.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            course.enrolled = await Student.countDocuments({
                course: { $regex: new RegExp(`^${safeName}$`, 'i') }
            });
            return res.json(course);
        }

        const course = await queryOne('SELECT * FROM courses WHERE id = ?', [req.params.id]);
        if (!course) return res.status(404).json({ error: 'Course not found' });
        const [enriched] = await enrichCoursesWithEnrollment([course]);
        res.json(enriched);
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
