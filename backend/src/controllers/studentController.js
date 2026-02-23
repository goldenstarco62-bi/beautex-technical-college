import { getDb, query, queryOne, run } from '../config/database.js';
import { sendWelcomeEmail } from '../services/emailService.js';
import { sendLoginCredentials } from '../services/smsService.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Generate random password
function generatePassword(length = 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return password;
}

// Helper to check if using MongoDB
async function isMongo() {
    const db = await getDb();
    return db.constructor.name === 'NativeConnection';
}

export async function getAllStudents(req, res) {
    try {
        const { role, email } = req.user;
        const mongo = await isMongo();

        // Admin and Superadmin see everything
        if (role === 'admin' || role === 'superadmin') {
            if (mongo) {
                const Student = (await import('../models/mongo/Student.js')).default;
                const students = await Student.find().sort({ created_at: -1 }).lean();
                return res.json(students);
            }
            const students = await query('SELECT * FROM students ORDER BY created_at DESC');
            return res.json(students.map(s => ({
                ...s,
                course: typeof s.course === 'string' && s.course.startsWith('[') ? JSON.parse(s.course) : [s.course].filter(Boolean)
            })));
        }

        // Teachers see students in their courses
        if (role === 'teacher') {
            if (mongo) {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                const Student = (await import('../models/mongo/Student.js')).default;
                const faculty = await Faculty.findOne({ email });
                if (!faculty) return res.json([]);

                const facultyCourses = await Course.find({
                    $or: [{ instructor: faculty.name }, { name: { $in: faculty.courses || [] } }],
                    status: 'Active'
                }).select('name');
                const courseNames = facultyCourses.map(c => c.name);

                const students = await Student.find({ course: { $in: courseNames } }).sort({ created_at: -1 });
                return res.json(students);
            }

            const faculty = await queryOne('SELECT name, courses FROM faculty WHERE email = ?', [email]);
            if (!faculty) return res.json([]);

            let coursesList = [];
            try {
                coursesList = typeof faculty.courses === 'string' ? JSON.parse(faculty.courses || '[]') : (faculty.courses || []);
            } catch (e) { }

            const instructorCourses = await query('SELECT name FROM courses WHERE instructor = ?', [faculty.name]);
            const allTutorCourses = [...new Set([...coursesList, ...instructorCourses.map(c => c.name)])];

            if (allTutorCourses.length === 0) return res.json([]);

            if (allTutorCourses.length === 0) return res.json([]);

            const students = await query('SELECT * FROM students ORDER BY created_at DESC');
            const filteredStudents = students.filter(s => {
                let sCourses = [];
                try {
                    sCourses = typeof s.course === 'string' && s.course.startsWith('[') ? JSON.parse(s.course) : [s.course].filter(Boolean);
                } catch (e) { sCourses = [s.course].filter(Boolean); }
                return sCourses.some(sc => allTutorCourses.includes(sc));
            }).map(s => ({
                ...s,
                course: typeof s.course === 'string' && s.course.startsWith('[') ? JSON.parse(s.course) : [s.course].filter(Boolean)
            }));
            return res.json(filteredStudents);
        }

        // Students only see themselves
        if (role === 'student') {
            if (mongo) {
                const Student = (await import('../models/mongo/Student.js')).default;
                const students = await Student.find({ email }).lean();
                return res.json(students.map(s => ({ ...s, course: Array.isArray(s.course) ? s.course : [s.course].filter(Boolean) })));
            }
            const students = await query('SELECT * FROM students WHERE email = ?', [email]);
            return res.json(students.map(s => ({
                ...s,
                course: typeof s.course === 'string' && s.course.startsWith('[') ? JSON.parse(s.course) : [s.course].filter(Boolean)
            })));
        }

        res.json([]);
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ error: 'Failed to fetch students' });
    }
}

export async function getStudent(req, res) {
    try {
        if (await isMongo()) {
            const student = await Student.findOne({ id: req.params.id }).lean();
            if (!student) return res.status(404).json({ error: 'Student not found' });

            // IDOR Protection: Check if user is authorized to view this profile
            if (req.user.role === 'student' && req.user.student_id !== student.id) {
                return res.status(403).json({ error: 'Access denied. You can only view your own profile.' });
            }

            return res.json({
                ...student,
                course: Array.isArray(student.course) ? student.course : [student.course].filter(Boolean)
            });
        }

        const student = await queryOne('SELECT * FROM students WHERE id = ?', [req.params.id]);
        if (!student) return res.status(404).json({ error: 'Student not found' });

        // IDOR Protection: Check if user is authorized to view this profile
        if (req.user.role === 'student' && req.user.student_id !== student.id) {
            return res.status(403).json({ error: 'Access denied. You can only view your own profile.' });
        }

        res.json({
            ...student,
            course: typeof student.course === 'string' && student.course.startsWith('[') ? JSON.parse(student.course) : [student.course].filter(Boolean)
        });
    } catch (error) {
        console.error('Get student error:', error);
        res.status(500).json({ error: 'Failed to fetch student' });
    }
}

export async function createStudent(req, res) {
    try {
        const { id, name, email, course, intake, contact, photo, dob, address, guardian_name, guardian_contact, blood_group } = req.body;

        if (!id || !name || !email || !course) {
            return res.status(400).json({ error: 'ID, name, email, and course are required' });
        }

        // Generate temporary password for the student
        const temporaryPassword = generatePassword();
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

        let savedStudent;
        if (await isMongo()) {
            const Student = (await import('../models/mongo/Student.js')).default;
            const User = (await import('../models/mongo/User.js')).default;

            const newStudent = new Student({
                id, name, email, course, intake,
                gpa: 0.0,
                status: 'Active',
                contact, photo,
                enrolled_date: new Date(),
                dob, address, guardian_name, guardian_contact, blood_group
            });
            savedStudent = await newStudent.save();

            // Create user account
            const newUser = new User({
                name,
                email,
                password: hashedPassword,
                role: 'student',
                status: 'Active',
                photo,
                must_change_password: true
            });
            await newUser.save();
        } else {
            // Create student record
            const courseVal = Array.isArray(course) ? JSON.stringify(course) : course;
            await run(
                `INSERT INTO students (id, name, email, course, intake, gpa, status, contact, photo, enrolled_date, dob, address, guardian_name, guardian_contact, blood_group)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, name, email, courseVal, intake, 0.0, 'Active', contact, photo, new Date().toISOString(), dob, address, guardian_name, guardian_contact, blood_group]
            );

            // Create user account for login
            await run(
                `INSERT INTO users (name, email, password, role, status, photo, must_change_password)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [name, email, hashedPassword, 'student', 'Active', photo, true]
            );

            savedStudent = await queryOne('SELECT * FROM students WHERE id = ?', [id]);
            if (savedStudent) {
                savedStudent.course = typeof savedStudent.course === 'string' && savedStudent.course.startsWith('[') ? JSON.parse(savedStudent.course) : [savedStudent.course].filter(Boolean);
            }
        }

        // Send email notification
        try {
            console.log(`📡 Attempting to send welcome email to: ${email}`);
            await sendWelcomeEmail(email, 'student', temporaryPassword);
        } catch (emailError) {
            console.error('❌ Failed to send welcome email:', emailError);
        }

        // Send SMS notification if contact is provided
        if (contact) {
            try {
                console.log(`📡 Attempting to send SMS to: ${contact}`);
                await sendLoginCredentials(contact, email, temporaryPassword, 'student');
            } catch (smsError) {
                console.error('❌ Failed to send SMS:', smsError);
            }
        }

        res.status(201).json(savedStudent);
    } catch (error) {
        console.error('Create student error:', error);
        if (error.code === 'SQLITE_CONSTRAINT' || error.code === 23505 || error.code === 11000) {
            return res.status(400).json({ error: 'A student with this ID or email already exists.' });
        }
        res.status(500).json({ error: `Server Error: ${error.message}` });
    }
}

export async function updateStudent(req, res) {
    try {
        if (await isMongo()) {
            const Student = (await import('../models/mongo/Student.js')).default;
            const updatedStudent = await Student.findOneAndUpdate(
                { id: req.params.id },
                { $set: { ...req.body, updated_at: new Date() } },
                { new: true, runValidators: true }
            );
            if (!updatedStudent) return res.status(404).json({ error: 'Student not found' });
            return res.json(updatedStudent);
        }

        const allowedFields = [
            'name', 'email', 'course', 'intake', 'gpa', 'status', 'contact',
            'photo', 'dob', 'address', 'guardian_name', 'guardian_contact', 'blood_group'
        ];
        const fields = Object.keys(req.body).filter(k => allowedFields.includes(k));
        if (fields.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const values = fields.map(f => {
            if (f === 'course' && Array.isArray(req.body[f])) {
                return JSON.stringify(req.body[f]);
            }
            return req.body[f];
        });
        values.push(new Date().toISOString()); // updated_at
        values.push(req.params.id);

        await run(`UPDATE students SET ${setClause}, updated_at = ? WHERE id = ?`, values);
        const student = await queryOne('SELECT * FROM students WHERE id = ?', [req.params.id]);
        if (!student) return res.status(404).json({ error: 'Student not found' });

        student.course = typeof student.course === 'string' && student.course.startsWith('[') ? JSON.parse(student.course) : [student.course].filter(Boolean);
        res.json(student);
    } catch (error) {
        console.error('Update student error:', error);
        res.status(500).json({ error: 'Failed to update student profile.' });
    }
}

export async function deleteStudent(req, res) {
    try {
        if (await isMongo()) {
            const Student = (await import('../models/mongo/Student.js')).default;
            const result = await Student.findOneAndDelete({ id: req.params.id });
            if (!result) return res.status(404).json({ error: 'Student not found' });
            return res.json({ message: 'Student deleted successfully' });
        }

        const result = await run('DELETE FROM students WHERE id = ?', [req.params.id]);
        if (result.changes === 0) return res.status(404).json({ error: 'Student not found' });
        res.json({ message: 'Student deleted successfully' });
    } catch (error) {
        console.error('Delete student error:', error);
        res.status(500).json({ error: 'Failed to delete student' });
    }
}

export async function searchStudents(req, res) {
    try {
        const query = req.query.q;

        if (await isMongo()) {
            const Student = (await import('../models/mongo/Student.js')).default;
            // ReDoS Protection: Escape special characters in the query string
            const safeQuery = String(req.query.q || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(safeQuery, 'i');
            const students = await Student.find({
                $or: [{ name: regex }, { email: regex }, { id: regex }, { course: regex }]
            }).sort({ created_at: -1 });
            return res.json(students);
        }

        const students = await query(
            `SELECT * FROM students WHERE name LIKE ? OR email LIKE ? OR id LIKE ? OR course LIKE ? ORDER BY created_at DESC`,
            [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]
        );
        res.json(students.map(s => ({
            ...s,
            course: typeof s.course === 'string' && s.course.startsWith('[') ? JSON.parse(s.course) : [s.course].filter(Boolean)
        })));
    } catch (error) {
        console.error('Search students error:', error);
        res.status(500).json({ error: 'Failed to search students' });
    }
}
