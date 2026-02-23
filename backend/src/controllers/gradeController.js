import { getDb, query, queryOne, run } from '../config/database.js';

async function isMongo() {
    return !!process.env.MONGODB_URI;
}

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
                const faculty = await Faculty.findOne({ email: req.user.email });
                if (faculty) {
                    const instructorCourses = await Course.find({
                        $or: [{ instructor: faculty.name }, { name: { $in: faculty.courses || [] } }],
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
            const faculty = await queryOne('SELECT name, courses FROM faculty WHERE email = ?', [req.user.email]);
            if (faculty) {
                let coursesList = [];
                try {
                    coursesList = typeof faculty.courses === 'string' ? JSON.parse(faculty.courses || '[]') : (faculty.courses || []);
                } catch (e) { }

                const instructorCourses = await query('SELECT name FROM courses WHERE instructor = ?', [faculty.name]);
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
                console.warn(`⚠️ Faculty profile not found for teacher: ${req.user.email}. Role: ${userRole}`);
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
        console.log(`✅ Found ${grades.length} grade records for ${req.user.email}`);
        res.json(grades);
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

        const students = await query('SELECT id, name, course FROM students WHERE course LIKE ? AND status = ?', [`%${course}%`, 'Active']);
        res.json(students.map(s => ({
            ...s,
            course: typeof s.course === 'string' && s.course.startsWith('[') ? JSON.parse(s.course) : [s.course].filter(Boolean)
        })));
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
            const faculty = await queryOne('SELECT name, courses FROM faculty WHERE email = ?', [req.user.email]);
            if (!faculty) return res.status(403).json({ error: 'Access Denied: Trainer profile not found' });

            let coursesList = [];
            try { coursesList = typeof faculty.courses === 'string' ? JSON.parse(faculty.courses || '[]') : (faculty.courses || []); } catch (e) { }

            const instructorCourses = await query('SELECT name FROM courses WHERE instructor = ?', [faculty.name]);
            const allowedCourses = [...new Set([...coursesList, ...instructorCourses.map(c => c.name)])];

            if (!allowedCourses.includes(course)) {
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
            const currentGrade = await queryOne('SELECT course FROM grades WHERE id = ?', [gradeId]);
            if (!currentGrade) return res.status(404).json({ error: 'Grade record not found' });

            const faculty = await queryOne('SELECT name, courses FROM faculty WHERE email = ?', [req.user.email]);
            let coursesList = [];
            try { coursesList = typeof faculty.courses === 'string' ? JSON.parse(faculty.courses || '[]') : (faculty.courses || []); } catch (e) { }

            const instructorCourses = await query('SELECT name FROM courses WHERE instructor = ?', [faculty.name]);
            const allowedCourses = [...new Set([...coursesList, ...instructorCourses.map(c => c.name)])];

            if (!allowedCourses.includes(currentGrade.course)) {
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
        res.json(updatedGrade);
    } catch (error) {
        console.error('Update grade error:', error);
        res.status(500).json({ error: 'Failed to update grade' });
    }
}

export async function deleteGrade(req, res) {
    try {
        if (await isMongo()) {
            const Grade = (await import('../models/mongo/Grade.js')).default;
            const result = await Grade.findByIdAndDelete(req.params.id);
            if (!result) return res.status(404).json({ error: 'Grade not found' });
            return res.json({ message: 'Grade deleted successfully' });
        }

        const result = await run('DELETE FROM grades WHERE id = ?', [req.params.id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Grade not found' });
        res.json({ message: 'Grade deleted successfully' });
    } catch (error) {
        console.error('Delete grade error:', error);
        res.status(500).json({ error: 'Failed to delete grade' });
    }
}
