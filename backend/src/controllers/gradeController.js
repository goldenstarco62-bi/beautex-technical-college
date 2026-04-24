import { getDb, query, queryOne, run } from '../config/database.js';
import notificationService from '../services/notificationService.js';


const isMongo = async () => !!process.env.MONGODB_URI;

export async function getAllGrades(req, res) {
    try {
        const mongo = await isMongo();
        console.log(`📡 Database Mode: ${mongo ? 'MongoDB' : 'SQL'}`);

        if (mongo) {
            const Grade = (await import('../models/mongo/Grade.js')).default;
            const Student = (await import('../models/mongo/Student.js')).default;

            let studentIdFilter = null;
            let courseFilter = null;
            let tutorCourseNames = [];

            const userRole = String(req.user?.role || '').toLowerCase().trim();
            const studentId = req.user?.student_id || req.user?.id;

            if (userRole === 'student') {
                studentIdFilter = String(studentId);
                if (!studentIdFilter || studentIdFilter === 'null') {
                    console.warn(`⚠️ Student ${req.user.email} attempted to fetch grades without a student_id or user id (Mongo)`);
                    return res.json([]);
                }
                console.log(`🔍 Filtering grades for student ID: ${studentIdFilter} (Mongo)`);
            } else if (userRole === 'teacher') {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                const userEmail = String(req.user.email || '').toLowerCase().trim();
                const faculty = await Faculty.findOne({ email: userEmail });
                if (faculty) {
                    const facultyName = faculty.name;
                    const facultyCourses = Array.isArray(faculty.courses) ? faculty.courses : [];
                    const instructorCourses = await Course.find({
                        $or: [
                            { instructor: { $regex: new RegExp(`^${facultyName}$`, 'i') } },
                            { name: { $in: facultyCourses } }
                        ],
                        status: 'Active'
                    }).select('name');
                    tutorCourseNames = instructorCourses.map(c => c.name);
                }
            } else if (req.query.course) {
                courseFilter = req.query.course;
            }

            let mongoQuery = {};
            if (studentIdFilter) mongoQuery.student_id = studentIdFilter;
            if (courseFilter) mongoQuery.course = courseFilter;
            if (tutorCourseNames.length > 0) mongoQuery.course = { $in: tutorCourseNames };

            const grades = await Grade.find(mongoQuery).sort({ created_at: -1 }).lean();

            // Populate student names
            const gradesWithNames = await Promise.all(grades.map(async (grade) => {
                const searchId = String(grade.student_id).trim();
                const student = await Student.findOne({ id: searchId });

                return {
                    ...grade,
                    _id: grade._id.toString(),
                    id: grade._id.toString(),
                    student_name: student ? student.name : 'Unknown Student',
                    student_photo: student ? student.photo : null
                };
            }));

            return res.json(gradesWithNames);
        }

        // SQL VERSION
        let sql = `
        SELECT g.*, s.name as student_name, s.photo as student_photo
        FROM grades g
        LEFT JOIN students s ON LOWER(TRIM(g.student_id)) = LOWER(TRIM(s.id))
    `;
        let params = [];
        let conditions = [];

        const userRole = (req.user?.role ? String(req.user.role) : '').toLowerCase().trim();
        const studentId = req.user?.student_id || req.user?.id;
        const isAdmin = ['admin', 'superadmin'].includes(userRole);

        console.log(`📊 Fetching grades registry - User: ${req.user?.email}, Role: "${userRole}", isAdmin: ${isAdmin}, StudentID: "${studentId}"`);

        if (userRole === 'student') {
            if (!studentId || studentId === 'null') {
                console.warn(`⚠️ Student ${req.user.email} attempted to fetch grades without a student_id`);
                return res.json([]);
            }
            conditions.push('LOWER(TRIM(g.student_id)) = LOWER(TRIM(?))');
            params.push(String(studentId).trim());
            console.log(`🔍 Applied student filter: ${studentId}`);
        } else if (userRole === 'teacher') {
            const userEmail = String(req.user.email || '').toLowerCase().trim();
            const faculty = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [userEmail]);
            if (faculty) {
                let coursesList = [];
                try {
                    if (faculty.courses && String(faculty.courses).startsWith('[')) {
                        coursesList = JSON.parse(faculty.courses);
                    } else if (faculty.courses) {
                        coursesList = faculty.courses.split(',').map(s => s.trim());
                    }
                } catch (e) { }

                const instructorCourses = await query('SELECT name FROM courses WHERE LOWER(instructor) = LOWER(?)', [faculty.name]);
                const allTutorCourses = [...new Set([...coursesList, ...instructorCourses.map(c => c.name)])];

                if (allTutorCourses.length > 0) {
                    const placeholders = allTutorCourses.map(() => '?').join(',');
                    conditions.push(`g.course IN (${placeholders})`);
                    params.push(...allTutorCourses);
                    console.log(`🔍 Applied teacher course filter: ${JSON.stringify(allTutorCourses)}`);
                } else {
                    console.log('ℹ️ Teacher has no courses assigned. Returning empty registry.');
                    return res.json([]);
                }
            } else {
                console.warn(`⚠️ Faculty profile not found for teacher: ${userEmail}. Role: ${userRole}`);
                return res.json([]);
            }
        } else if (isAdmin) {
            console.log('👑 Admin/Superadmin detected. Accessing global registry.');
            if (req.query.course) {
                conditions.push('g.course = ?');
                params.push(req.query.course);
                console.log(`🔍 Applied admin course filter: ${req.query.course}`);
            }
        } else if (req.query.course) {
            conditions.push('g.course = ?');
            params.push(req.query.course);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' ORDER BY g.id DESC';
        console.log('📡 Final SQL Query:', sql, params);

        const grades = await query(sql, params);

        // FIX: Normalize course names for Supabase/PostgreSQL (remove {"..."})
        const cleanedGrades = grades.map(g => ({
            ...g,
            course: typeof g.course === 'string' && g.course.startsWith('{') && g.course.endsWith('}')
                ? g.course.slice(1, -1).replace(/"/g, '')
                : g.course,
            student_name: typeof g.student_name === 'string' && g.student_name.startsWith('{') && g.student_name.endsWith('}')
                ? g.student_name.slice(1, -1).replace(/"/g, '')
                : g.student_name
        }));

        res.json(cleanedGrades);
    } catch (error) {
        console.error('CRITICAL: Get grades error:', error);
        res.status(500).json({ error: 'Failed to fetch academic registry records' });
    }
}

export async function getBatchStudents(req, res) {
    try {
        const { course } = req.query;
        if (!course) return res.status(400).json({ error: 'Course name is required' });

        if (await isMongo()) {
            const Student = (await import('../models/mongo/Student.js')).default;
            const students = await Student.find({ course, status: 'Active' }).select('id name course').lean();
            return res.json(students);
        }

        // Fetch all active students then filter — handles plain string, JSON array, and Postgres {} format
        const allStudents = await query('SELECT id, name, course FROM students WHERE status = ?', ['Active']);
        const normalise = (raw) => {
            if (!raw) return [];
            if (typeof raw === 'string' && raw.startsWith('{') && raw.endsWith('}')) {
                // PostgreSQL array literal: {"Course A","Course B"} or {Course A}
                return raw.slice(1, -1).split(',').map(s => s.replace(/^"|"$/g, '').trim()).filter(Boolean);
            }
            if (typeof raw === 'string' && raw.startsWith('[')) {
                try { const p = JSON.parse(raw); return Array.isArray(p) ? p.map(s => s.trim()) : [String(p).trim()]; } catch (e) { /* fall through */ }
            }
            return [String(raw).trim()].filter(Boolean);
        };
        const courseLC = course.toLowerCase().trim();
        const matchedStudents = allStudents.filter(s => normalise(s.course).some(c => c.toLowerCase() === courseLC));
        res.json(matchedStudents.map(s => ({ ...s, course: normalise(s.course) })));
    } catch (error) {
        console.error('Batch students fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch students for this course' });
    }
}

export async function createBatchGrades(req, res) {
    try {
        const { grades } = req.body;
        if (!Array.isArray(grades) || grades.length === 0) {
            return res.status(400).json({ error: 'Grades must be a non-empty array' });
        }

        const mongo = await isMongo();
        const results = [];

        if (mongo) {
            const Grade = (await import('../models/mongo/Grade.js')).default;
            for (const g of grades) {
                const newGrade = new Grade({
                    student_id: g.student_id,
                    course: g.course,
                    assignment: g.assignment,
                    month: g.month,
                    score: g.score,
                    max_score: g.max_score || 100,
                    remarks: g.remarks || ''
                });
                await newGrade.save();
                results.push(newGrade);
            }
        } else {
            for (const g of grades) {
                await run(
                    'INSERT INTO grades (student_id, course, assignment, month, score, max_score, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [g.student_id, g.course, g.assignment, g.month, g.score, g.max_score || 100, g.remarks || '']
                );
            }
        }

        // Notify students asynchronously
        for (const g of grades) {
            notificationService.notifyStudent(
                g.student_id,
                'New Grade Posted',
                `Your grade for ${g.assignment} (${g.course}) has been posted.`,
                'success'
            );
        }

        res.status(201).json({ message: `Successfully recorded ${grades.length} marks`, count: grades.length });

    } catch (error) {
        console.error('Batch grade creation error:', error);
        res.status(500).json({ error: 'Failed to record batch marks' });
    }
}

export async function createGrade(req, res) {
    try {
        const { student_id, course, assignment, month, score, max_score, remarks } = req.body;

        // Security: Trainers can only create grades for their assigned courses
        if (req.user.role === 'teacher') {
            const userEmail = String(req.user.email || '').toLowerCase().trim();
            let allowedCourses = [];

            if (await isMongo()) {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                const faculty = await Faculty.findOne({ email: userEmail });
                if (faculty) {
                    const facultyName = faculty.name;
                    const facultyCourses = Array.isArray(faculty.courses) ? faculty.courses : [];
                    const instructorCourses = await Course.find({
                        $or: [
                            { instructor: { $regex: new RegExp(`^${facultyName}$`, 'i') } },
                            { name: { $in: facultyCourses } }
                        ]
                    }).select('name');
                    allowedCourses = instructorCourses.map(c => c.name);
                }
            } else {
                const faculty = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [userEmail]);
                if (faculty) {
                    let coursesList = [];
                    try {
                        if (faculty.courses && String(faculty.courses).startsWith('[')) {
                            coursesList = JSON.parse(faculty.courses);
                        } else if (faculty.courses) {
                            coursesList = faculty.courses.split(',').map(s => s.trim());
                        }
                    } catch (e) { }
                    const instructorCourses = await query('SELECT name FROM courses WHERE LOWER(instructor) = LOWER(?)', [faculty.name]);
                    allowedCourses = [...new Set([...coursesList, ...instructorCourses.map(c => c.name)])];
                }
            }

            if (!allowedCourses.some(ac => ac.toLowerCase().trim() === course.toLowerCase().trim())) {
                return res.status(403).json({ error: `Security Protocol: You are not authorized to record grades for "${course}"` });
            }
        }

        if (await isMongo()) {
            const Grade = (await import('../models/mongo/Grade.js')).default;
            const Student = (await import('../models/mongo/Student.js')).default;

            const newGrade = new Grade({ student_id, course, assignment, month, score, max_score, remarks });
            const saved = await newGrade.save();

            // Get student info
            const student = await Student.findOne({ id: student_id });
            const gradeWithStudent = {
                ...saved.toObject(),
                id: saved._id.toString(),
                student_name: student ? student.name : 'Unknown Student',
                student_photo: student ? student.photo : null
            };

            return res.status(201).json(gradeWithStudent);
        }

        const result = await run(
            'INSERT INTO grades (student_id, course, assignment, month, score, max_score, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [student_id, course, assignment, month, score, max_score, remarks]
        );
        const grade = await queryOne('SELECT * FROM grades WHERE id = ?', [result.lastID]);

        // Notify student
        notificationService.notifyStudent(
            student_id,
            'New Grade Posted',
            `Your grade for ${assignment} (${course}) has been posted.`,
            'success'
        );

        res.status(201).json(grade);

    } catch (error) {
        console.error('Create grade error:', error);
        res.status(500).json({ error: 'Failed to create grade' });
    }
}

export async function updateGrade(req, res) {
    try {
        const gradeId = req.params.id;

        // Security check for teachers
        if (req.user.role === 'teacher') {
            const userEmail = String(req.user.email || '').toLowerCase().trim();
            let gradeCourse = null;

            if (await isMongo()) {
                const Grade = (await import('../models/mongo/Grade.js')).default;
                const rec = await Grade.findById(gradeId);
                gradeCourse = rec?.course;
            } else {
                const rec = await queryOne('SELECT course FROM grades WHERE id = ?', [gradeId]);
                gradeCourse = rec?.course;
            }

            if (!gradeCourse) return res.status(404).json({ error: 'Grade record not found' });

            let allowedCourses = [];
            if (await isMongo()) {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                const faculty = await Faculty.findOne({ email: userEmail });
                if (faculty) {
                    const facultyName = faculty.name;
                    const facultyCourses = Array.isArray(faculty.courses) ? faculty.courses : [];
                    const instructorCourses = await Course.find({
                        $or: [
                            { instructor: { $regex: new RegExp(`^${facultyName}$`, 'i') } },
                            { name: { $in: facultyCourses } }
                        ]
                    }).select('name');
                    allowedCourses = instructorCourses.map(c => c.name);
                }
            } else {
                const faculty = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [userEmail]);
                if (faculty) {
                    let coursesList = [];
                    try {
                        if (faculty.courses && String(faculty.courses).startsWith('[')) {
                            coursesList = JSON.parse(faculty.courses);
                        } else if (faculty.courses) {
                            coursesList = faculty.courses.split(',').map(s => s.trim());
                        }
                    } catch (e) { }
                    const instructorCourses = await query('SELECT name FROM courses WHERE LOWER(instructor) = LOWER(?)', [faculty.name]);
                    allowedCourses = [...new Set([...coursesList, ...instructorCourses.map(c => c.name)])];
                }
            }

            if (!allowedCourses.some(ac => ac.toLowerCase().trim() === gradeCourse.toLowerCase().trim())) {
                return res.status(403).json({ error: 'Access Denied: You cannot modify records for this course.' });
            }
        }

        if (await isMongo()) {
            const Grade = (await import('../models/mongo/Grade.js')).default;
            const Student = (await import('../models/mongo/Student.js')).default;

            // Sanitize input
            const allowedFields = ['student_id', 'course', 'assignment', 'month', 'score', 'max_score', 'remarks'];
            const updateData = {};
            Object.keys(req.body).forEach(key => {
                if (allowedFields.includes(key)) updateData[key] = req.body[key];
            });

            const updated = await Grade.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true });
            if (!updated) return res.status(404).json({ error: 'Grade not found' });

            // Get student info
            const student = await Student.findOne({ id: updated.student_id });
            const gradeWithStudent = {
                ...updated.toObject(),
                id: updated._id.toString(),
                student_name: student ? student.name : 'Unknown Student',
                student_photo: student ? student.photo : null
            };

            return res.json(gradeWithStudent);
        }

        const allowedFields = [
            'student_id', 'course', 'assignment', 'month', 'score', 'max_score', 'remarks'
        ];
        const fields = Object.keys(req.body).filter(k => allowedFields.includes(k));
        if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => req.body[f]);
        values.push(req.params.id);

        await run(`UPDATE grades SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, values);

        // Fetch the updated grade with student info joined
        const updatedGrade = await queryOne(`
            SELECT g.*, s.name as student_name, s.photo as student_photo
            FROM grades g
            LEFT JOIN students s ON LOWER(TRIM(g.student_id)) = LOWER(TRIM(s.id))
            WHERE g.id = ?
        `, [req.params.id]);

        if (!updatedGrade) return res.status(404).json({ error: 'Grade not found' });

        // Notify student
        notificationService.notifyStudent(
            updatedGrade.student_id,
            'Grade Updated',
            `Your grade for ${updatedGrade.assignment} (${updatedGrade.course}) has been updated.`,
            'info'
        );

        res.json(updatedGrade);

    } catch (error) {
        console.error('Update grade error:', error);
        res.status(500).json({ error: 'Failed to update grade' });
    }
}

export async function deleteGrade(req, res) {
    try {
        const gradeId = req.params.id;
        const { role, email } = req.user;

        if (await isMongo()) {
            const Grade = (await import('../models/mongo/Grade.js')).default;
            const grade = await Grade.findById(gradeId);
            if (!grade) return res.status(404).json({ error: 'Grade not found' });

            if (role === 'teacher') {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                const fac = await Faculty.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } });
                if (fac) {
                    const matched = await Course.find({
                        $or: [{ instructor: { $regex: new RegExp(`^${fac.name}$`, 'i') } }, { name: { $in: fac.courses || [] } }]
                    }).select('name');
                    const teacherCourses = matched.map(c => c.name);
                    if (!teacherCourses.some(tc => tc.toLowerCase().trim() === grade.course.toLowerCase().trim())) {
                        return res.status(403).json({ error: 'Forbidden: You can only delete grades for your own courses' });
                    }
                }
            }

            await Grade.findByIdAndDelete(gradeId);
            return res.json({ message: 'Grade deleted successfully' });
        }

        const grade = await queryOne('SELECT * FROM grades WHERE id = ?', [gradeId]);
        if (!grade) return res.status(404).json({ error: 'Grade not found' });

        if (role === 'teacher') {
            const fac = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [email.toLowerCase().trim()]);
            if (fac) {
                let list = [];
                try { list = typeof fac.courses === 'string' ? JSON.parse(fac.courses || '[]') : (fac.courses || []); } catch (e) { }
                const inst = await query('SELECT name FROM courses WHERE LOWER(instructor) = LOWER(?)', [fac.name]);
                const teacherCourses = [...new Set([...list, ...inst.map(c => c.name)])];
                if (!teacherCourses.some(tc => tc.toLowerCase().trim() === grade.course.toLowerCase().trim())) {
                    return res.status(403).json({ error: 'Forbidden: You can only delete grades for your own courses' });
                }
            }
        }

        const result = await run('DELETE FROM grades WHERE id = ?', [gradeId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Grade not found' });
        res.json({ message: 'Grade deleted successfully' });
    } catch (error) {
        console.error('Delete grade error:', error);
        res.status(500).json({ error: 'Failed to delete grade' });
    }
}
