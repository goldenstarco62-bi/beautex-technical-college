import { getDb, query, queryOne, run, withTransaction } from '../config/database.js';
import { sendWelcomeEmail, sendAdminResetPasswordEmail } from '../services/emailService.js';
import { sendLoginCredentials } from '../services/smsService.js';
import { logActivity } from '../services/auditService.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { parseCoursesField } from '../utils/courseParser.js';
import logger from '../utils/logger.js';

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
const isMongo = async () => !!process.env.MONGODB_URI;

// Tables/collections that store a student's admission number in a `student_id`
// column. When an admission number is renamed, every one of these must be
// updated in the same transaction or the student's payments, fees, grades and
// attendance get orphaned under the old ID. Verified against the live schema.
const STUDENT_ID_REFERENCES = [
    'academic_reports',
    'attendance',
    'cat_results',
    'grades',
    'monthly_fee_notifications',
    'monthly_fee_tracking',
    'payments',
    'result_audit_logs',
    'student_daily_reports',
    'student_fees',
    'student_unit_marks',
    'unit_coverage_confirmations',
    'unit_coverage_logs',
];

// Escape user input before embedding in a RegExp (Mongo $regex injection guard).
const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Helper to parse faculty courses list robustly
function parseFacultyCourses(coursesField) {
    return parseCoursesField(coursesField);
}

export async function getAllStudents(req, res) {
    try {
        const { role, email } = req.user;
        const mongo = await isMongo();
        const limit = req.query.limit ? parseInt(req.query.limit) : null;

        // Admin and Superadmin see everything
        if (role === 'admin' || role === 'superadmin') {
            if (mongo) {
                const Student = (await import('../models/mongo/Student.js')).default;
                let q = Student.find().sort({ created_at: -1 });
                if (limit) q = q.limit(limit);
                const students = await q.lean();
                return res.json(students);
            }
            let sql = 'SELECT * FROM students ORDER BY created_at DESC';
            const params = [];
            if (limit) {
                sql += ' LIMIT ?';
                params.push(limit);
            }
            const students = await query(sql, params);
            return res.json(students.map(s => ({ ...s, course: parseCoursesField(s.course) })));
        }

        // Teachers see students in their courses
        if (role === 'teacher') {
            if (mongo) {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                const Student = (await import('../models/mongo/Student.js')).default;
                // FIX: Case-insensitive email lookup
                const emailRegex = new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
                const faculty = await Faculty.findOne({ email: { $regex: emailRegex } });
                if (!faculty) return res.json([]);

                // FIX: Case-insensitive instructor name match
                const facultyCourses = await Course.find({
                    $or: [
                        { instructor: { $regex: new RegExp(`^${faculty.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
                        { name: { $in: parseFacultyCourses(faculty.courses) } }
                    ],
                    status: 'Active'
                }).select('name');
                const courseNames = facultyCourses.map(c => c.name);

                if (courseNames.length === 0) return res.json([]);

                // FIX: Case-insensitive course name matching in student query
                // MongoDB $in on an array field is case-sensitive by default;
                // use regex per course name to handle casing mismatches.
                const courseRegexes = courseNames.map(n => new RegExp(`^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
                let q = Student.find({ course: { $in: courseRegexes } }).sort({ created_at: -1 });
                if (limit) q = q.limit(limit);
                const students = await q.lean();
                return res.json(students.map(s => ({
                    ...s,
                    course: Array.isArray(s.course) ? s.course : [s.course].filter(Boolean)
                })));
            }

            const userEmail = String(email || '').toLowerCase().trim();
            const faculty = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [userEmail]);
            if (!faculty) return res.json([]);

            const coursesList = parseFacultyCourses(faculty.courses);

            // FIX: Case-insensitive instructor course lookup
            const instructorCourses = await query('SELECT name FROM courses WHERE LOWER(instructor) = LOWER(?)', [faculty.name]);
            const allTutorCourses = [...new Set([...coursesList.map(c => c.toLowerCase().trim()), ...instructorCourses.map(c => c.name.toLowerCase().trim())])];

            if (allTutorCourses.length === 0) return res.json([]);

            const students = await query('SELECT * FROM students ORDER BY created_at DESC');

            // Helper: normalise any course storage format to a lowercase string array for filtering
            const parseCourse = (raw) => parseCoursesField(raw).map(c => c.toLowerCase().trim());

            let filteredStudents = students.filter(s => {
                const sCourses = parseCourse(s.course);
                return sCourses.some(sc => allTutorCourses.includes(sc));
            }).map(s => ({ ...s, course: parseCoursesField(s.course) }));

            if (limit) {
                filteredStudents = filteredStudents.slice(0, limit);
            }
            return res.json(filteredStudents);
        }

        // Students only see themselves
        if (role === 'student') {
            const userEmail = String(email || '').toLowerCase().trim();
            if (mongo) {
                const Student = (await import('../models/mongo/Student.js')).default;
                // FIX: Case-insensitive email lookup to handle any casing mismatches
                const emailRegex = new RegExp(`^${userEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
                const students = await Student.find({ email: { $regex: emailRegex } }).lean();
                return res.json(students.map(s => ({ ...s, course: Array.isArray(s.course) ? s.course : [s.course].filter(Boolean) })));
            }
            const students = await query('SELECT * FROM students WHERE LOWER(email) = LOWER(?)', [userEmail]);
            return res.json(students.map(s => ({ ...s, course: parseCoursesField(s.course) })));
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
            // FIX: Import Student model - was missing causing ReferenceError crash
            const Student = (await import('../models/mongo/Student.js')).default;
            const student = await Student.findOne({ id: req.params.id }).lean();
            if (!student) return res.status(404).json({ error: 'Student not found' });

            // IDOR Protection: Check if user is authorized to view this profile
            if (req.user.role === 'student' && String(req.user.student_id) !== String(student.id)) {
                return res.status(403).json({ error: 'Access denied. You can only view your own profile.' });
            }

            if (req.user.role === 'teacher') {
                const Faculty = (await import('../models/mongo/Faculty.js')).default;
                const Course = (await import('../models/mongo/Course.js')).default;
                const emailRegex = new RegExp(`^${req.user.email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
                const faculty = await Faculty.findOne({ email: { $regex: emailRegex } });
                if (!faculty) return res.status(403).json({ error: 'Access denied. Faculty record not found.' });

                const facultyCourses = await Course.find({
                    $or: [
                        { instructor: { $regex: new RegExp(`^${faculty.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
                        { name: { $in: parseFacultyCourses(faculty.courses) } }
                    ],
                    status: 'Active'
                }).select('name');
                const courseNames = facultyCourses.map(c => c.name.toLowerCase().trim());
                
                const sCourses = (Array.isArray(student.course) ? student.course : [student.course]).map(c => String(c).toLowerCase().trim());
                const isAuthorized = sCourses.some(sc => courseNames.includes(sc));
                if (!isAuthorized) {
                    return res.status(403).json({ error: 'Access denied. You are not authorized to view this student.' });
                }
            }

            return res.json({
                ...student,
                course: Array.isArray(student.course) ? student.course : [student.course].filter(Boolean)
            });
        }

        const student = await queryOne('SELECT * FROM students WHERE id = ?', [req.params.id]);
        if (!student) return res.status(404).json({ error: 'Student not found' });

        // IDOR Protection: Check if user is authorized to view this profile
        if (req.user.role === 'student' && String(req.user.student_id) !== String(student.id)) {
            return res.status(403).json({ error: 'Access denied. You can only view your own profile.' });
        }

        if (req.user.role === 'teacher') {
            const userEmail = String(req.user.email || '').toLowerCase().trim();
            const faculty = await queryOne('SELECT name, courses FROM faculty WHERE LOWER(email) = LOWER(?)', [userEmail]);
            if (!faculty) return res.status(403).json({ error: 'Access denied. Faculty record not found.' });

            const coursesList = parseFacultyCourses(faculty.courses);
            const instructorCourses = await query('SELECT name FROM courses WHERE LOWER(instructor) = LOWER(?)', [faculty.name]);
            const allTutorCourses = [...new Set([...coursesList.map(c => c.toLowerCase().trim()), ...instructorCourses.map(c => c.name.toLowerCase().trim())])];

            const sCourses = parseCoursesField(student.course).map(c => c.toLowerCase().trim());
            const isAuthorized = sCourses.some(sc => allTutorCourses.includes(sc));
            if (!isAuthorized) {
                return res.status(403).json({ error: 'Access denied. You are not authorized to view this student.' });
            }
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
        const { id, name, intake, contact, photo, dob, address, guardian_name, guardian_contact, blood_group } = req.body;
        const email = String(req.body.email || '').toLowerCase().trim();
        const course = req.body.course;

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
            const courseArr = Array.isArray(course) ? course : [course].filter(Boolean);

            // Format dates to YYYY-MM-DD for database compatibility (PostgreSQL DATE type)
            const formatDate = (dateStr) => {
                if (!dateStr) return null;
                try {
                    const date = new Date(dateStr);
                    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
                } catch {
                    return null;
                }
            };

            const enrolledDate = formatDate(req.body.enrolled_date) || new Date().toISOString().split('T')[0];
            const completionDate = formatDate(req.body.completion_date);
            const dobDate = formatDate(dob);

            // Run both inserts in parallel — students and users tables are independent
            await Promise.all([
                run(
                    `INSERT INTO students (id, name, email, course, intake, gpa, status, contact, photo, enrolled_date, completion_date, dob, address, guardian_name, guardian_contact, blood_group)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [id, name, email, courseVal, intake, 0.0, 'Active', contact, photo, enrolledDate, completionDate, dobDate, address, guardian_name, guardian_contact, blood_group]
                ),
                run(
                    `INSERT INTO users (name, email, password, role, status, photo, must_change_password)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [name, email, hashedPassword, 'student', 'Active', photo, true]
                )
            ]);

            // Build response from known data — avoids an extra SELECT round-trip
            savedStudent = {
                id, name, email, course: courseArr, intake,
                gpa: 0.0, status: 'Active', contact, photo,
                enrolled_date: enrolledDate, completion_date: completionDate,
                dob: dobDate, address, guardian_name, guardian_contact, blood_group,
                created_at: new Date().toISOString()
            };
        }

        // Respond immediately — notifications are fire-and-forget (non-blocking)
        res.status(201).json(savedStudent);

        // Send email notification asynchronously (does not block the response)
        sendWelcomeEmail(email, 'student', temporaryPassword)
            .then(() => console.log(`[student] Welcome email dispatched to: ${email}`))
            .catch(err => console.error('[student] Failed to send welcome email:', err.message));

        // Send SMS notification asynchronously if contact is provided
        if (contact) {
            sendLoginCredentials(contact, email, temporaryPassword, 'student')
                .then(() => console.log(`[student] SMS dispatched to: ${contact}`))
                .catch(err => console.error('[student] Failed to send SMS:', err.message));
        }
    } catch (error) {
        console.error('Create student error:', error);
        
        // Handle unique constraint violations across different DB engines
        // SQLITE_CONSTRAINT: SQLite
        // 23505: PostgreSQL (string)
        // 11000: MongoDB (number or string)
        const isDuplicate = 
            error.code === 'SQLITE_CONSTRAINT' || 
            error.code === '23505' || 
            error.code === 23505 || 
            error.code === 11000 || 
            error.code === '11000' ||
            (error.message && error.message.includes('unique constraint'));

        if (isDuplicate) {
            return res.status(400).json({ error: 'A student with this ID or email already exists. Please verify the credentials.' });
        }
        logger.error({ err: error }, 'createStudent: unhandled error');
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function updateStudent(req, res) {
    try {
        const studentId = req.params.id;
        const newEmail = req.body.email ? String(req.body.email).toLowerCase().trim() : null;

        if (await isMongo()) {
            const Student = (await import('../models/mongo/Student.js')).default;
            const User = (await import('../models/mongo/User.js')).default;

            const oldStudent = await Student.findOne({ id: studentId });
            if (!oldStudent) return res.status(404).json({ error: 'Student not found' });

            // Detect admission-number rename and guard against collisions
            const newStudentId = req.body.id ? String(req.body.id).trim() : null;
            const isIdChanged = Boolean(newStudentId && newStudentId !== studentId);
            if (isIdChanged) {
                const conflict = await Student.findOne({ id: { $regex: new RegExp(`^${escapeRegExp(newStudentId)}$`, 'i') } });
                if (conflict) {
                    return res.status(400).json({ error: `Admission number "${newStudentId}" is already assigned to another student.` });
                }
            }

            const oldEmail = oldStudent.email ? String(oldStudent.email).toLowerCase().trim() : null;
            const isEmailChanged = Boolean(newEmail && oldEmail && newEmail !== oldEmail);

            if (isEmailChanged) {
                const existingUser = await User.findOne({ email: newEmail });
                if (existingUser && existingUser.email !== oldEmail) {
                    return res.status(400).json({ error: 'The email address is already in use by another account.' });
                }
            }

            const updatePayload = { ...req.body, updated_at: new Date() };
            if (newEmail) updatePayload.email = newEmail;

            const updatedStudent = await Student.findOneAndUpdate(
                { id: studentId },
                { $set: updatePayload },
                { new: true, runValidators: true }
            );

            // Cascade the rename to every collection referencing the old ID.
            // Includes both SQL-style and mongoose-pluralized collection names;
            // updateMany on a non-existent collection is a harmless no-op.
            if (isIdChanged) {
                const db = Student.collection.db;
                const idFilter = { $regex: new RegExp(`^${escapeRegExp(String(studentId).trim())}$`, 'i') };
                const mongoCollections = [
                    'academicreports', 'academic_reports',
                    'attendances', 'attendance',
                    'catresults', 'cat_results',
                    'grades',
                    'monthlyfeenotifications', 'monthly_fee_notifications',
                    'monthlyfeetracking', 'monthly_fee_tracking',
                    'payments',
                    'resultauditlogs', 'result_audit_logs',
                    'studentdailyreports', 'student_daily_reports',
                    'studentfees', 'student_fees',
                    'studentunitmarks', 'student_unit_marks',
                    'unitcoverageconfirmations', 'unit_coverage_confirmations',
                    'unitcoveragelogs', 'unit_coverage_logs',
                ];
                for (const name of mongoCollections) {
                    await db.collection(name).updateMany({ student_id: idFilter }, { $set: { student_id: newStudentId } });
                }
                logger.info({ oldId: studentId, newId: newStudentId }, 'Student admission number renamed with cascading references (Mongo)');
            }

            let passwordResetSent = false;
            if (isEmailChanged) {
                const tempPassword = generatePassword();
                const hashedPassword = await bcrypt.hash(tempPassword, 10);

                const user = await User.findOne({ email: oldEmail });
                if (user) {
                    user.email = newEmail;
                    user.password = hashedPassword;
                    user.must_change_password = true;
                    if (req.body.name) user.name = req.body.name;
                    await user.save();
                } else {
                    const newUser = new User({
                        name: updatedStudent.name || req.body.name,
                        email: newEmail,
                        password: hashedPassword,
                        role: 'student',
                        status: 'Active',
                        must_change_password: true
                    });
                    await newUser.save();
                }

                sendAdminResetPasswordEmail(newEmail, tempPassword)
                    .then(() => console.log(`[student] Password reset email sent to new address: ${newEmail}`))
                    .catch(err => console.error('[student] Failed to send reset email to new address:', err.message));
                passwordResetSent = true;
            }

            return res.json({
                ...updatedStudent.toObject(),
                password_reset_sent: passwordResetSent,
                message: isEmailChanged ? 'Student details updated and password reset email sent to new address.' : 'Student details updated successfully.'
            });
        }

        // SQL Mode (SQLite / PostgreSQL)
        const oldStudent = await queryOne('SELECT * FROM students WHERE id = ?', [studentId]);
        if (!oldStudent) return res.status(404).json({ error: 'Student not found' });

        const oldEmail = oldStudent.email ? String(oldStudent.email).toLowerCase().trim() : null;
        const isEmailChanged = Boolean(newEmail && oldEmail && newEmail !== oldEmail);

        if (isEmailChanged) {
            const existingUser = await queryOne('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [newEmail]);
            if (existingUser) {
                return res.status(400).json({ error: 'The email address is already in use by another account.' });
            }
        }

        // 'id' (admission number) is handled separately below to allow PK renames
        const allowedFields = [
            'name', 'email', 'course', 'intake', 'gpa', 'status', 'contact',
            'photo', 'dob', 'address', 'guardian_name', 'guardian_contact', 'blood_group',
            'completion_date', 'enrolled_date',
            'id_status', 'passport_status'
        ];

        // Detect if the admission number itself is being changed
        const newStudentId = req.body.id ? String(req.body.id).trim() : null;
        const isIdChanged = Boolean(newStudentId && newStudentId !== studentId);

        // Check the new ID is not already taken by another student
        if (isIdChanged) {
            const conflict = await queryOne('SELECT id FROM students WHERE id = ?', [newStudentId]);
            if (conflict) {
                return res.status(400).json({ error: `Admission number "${newStudentId}" is already assigned to another student.` });
            }
        }

        const fields = Object.keys(req.body).filter(k => allowedFields.includes(k));
        const updatedAt = new Date().toISOString();

        // Phase 1: Update the non-PK fields (if any)
        if (fields.length > 0) {
            const setClause = fields.map(f => `${f} = ?`).join(', ');
            const values = fields.map(f => {
                if (f === 'course' && Array.isArray(req.body[f])) {
                    return JSON.stringify(req.body[f]);
                }
                if (f === 'email') {
                    return newEmail;
                }
                return req.body[f];
            });
            values.push(updatedAt); // updated_at
            values.push(studentId); // WHERE id = ?

            const result = await run(`UPDATE students SET ${setClause}, updated_at = ? WHERE id = ?`, values);
            if (result.changes === 0) return res.status(404).json({ error: 'Student not found' });
        }

        // Phase 2: Rename the primary key if the admission number changed,
        // cascading to every table that references the old ID — atomically,
        // so a failure anywhere rolls the whole rename back.
        if (isIdChanged) {
            const isPostgres = !!process.env.DATABASE_URL?.trim();
            await withTransaction(async () => {
                await run('UPDATE students SET id = ? WHERE id = ?', [newStudentId, studentId]);
                for (const table of STUDENT_ID_REFERENCES) {
                    // Not all tables exist in every engine/deployment (SQLite
                    // fallback ships a subset) — skip missing ones.
                    const exists = isPostgres
                        ? await queryOne(`SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?`, [table])
                        : await queryOne(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?`, [table]);
                    if (!exists) continue;
                    await run(
                        `UPDATE ${table} SET student_id = ? WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))`,
                        [newStudentId, studentId]
                    );
                }
            });
            logger.info({ oldId: studentId, newId: newStudentId }, 'Student admission number renamed with cascading references');
        }

        // The effective student ID going forward
        const effectiveId = isIdChanged ? newStudentId : studentId;

        let passwordResetSent = false;
        if (isEmailChanged) {
            const tempPassword = generatePassword();
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            const user = await queryOne('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [oldEmail]);
            if (user) {
                await run('UPDATE users SET email = ?, password = ?, must_change_password = ? WHERE id = ?', [newEmail, hashedPassword, 1, user.id]);
            } else {
                await run('INSERT INTO users (name, email, password, role, status, must_change_password) VALUES (?, ?, ?, ?, ?, ?)', [req.body.name || oldStudent.name, newEmail, hashedPassword, 'student', 'Active', 1]);
            }

            sendAdminResetPasswordEmail(newEmail, tempPassword)
                .then(() => console.log(`[student] Password reset email sent to new address: ${newEmail}`))
                .catch(err => console.error('[student] Failed to send reset email to new address:', err.message));
            passwordResetSent = true;
        }

        const courseRaw = req.body.course;
        const courseArr = Array.isArray(courseRaw)
            ? courseRaw
            : (typeof courseRaw === 'string' && courseRaw.startsWith('[') ? JSON.parse(courseRaw) : [courseRaw].filter(Boolean));

        const updatedFields = {};
        fields.forEach(f => {
            updatedFields[f] = f === 'course' ? courseArr : (f === 'email' ? newEmail : req.body[f]);
        });

        const messageStr = [
            isIdChanged ? `Admission number updated to "${newStudentId}".` : null,
            isEmailChanged ? 'Password reset email sent to new address.' : null,
            'Student details updated successfully.'
        ].filter(Boolean).join(' ');

        res.json({
            id: effectiveId,
            ...updatedFields,
            updated_at: updatedAt,
            password_reset_sent: passwordResetSent,
            message: messageStr
        });
    } catch (error) {
        console.error('Update student error:', error);
        res.status(500).json({ error: 'Failed to update student profile.' });
    }
}

export async function deleteStudent(req, res) {
    try {
        const studentId = req.params.id;

        // Prevent deleting the superadmin's own account (if for some reason student_id matches)
        if (String(req.user.id) === String(studentId)) {
            return res.status(403).json({ error: 'You cannot delete your own account.' });
        }

        if (await isMongo()) {
            const Student = (await import('../models/mongo/Student.js')).default;
            const User = (await import('../models/mongo/User.js')).default;

            const student = await Student.findOne({ id: studentId });
            if (!student) return res.status(404).json({ error: 'Student not found' });

            // Delete user first
            await User.findOneAndDelete({ email: student.email });
            // Delete student profile
            await Student.findOneAndDelete({ id: studentId });

            return res.json({ message: 'Student and associated user account deleted successfully' });
        }

        const student = await queryOne('SELECT email FROM students WHERE id = ?', [studentId]);
        if (!student) return res.status(404).json({ error: 'Student not found' });

        // Delete user first
        await run('DELETE FROM users WHERE email = ?', [student.email]);
        // Delete student profile
        const result = await run('DELETE FROM students WHERE id = ?', [studentId]);

        if (result.changes === 0) return res.status(404).json({ error: 'Student not found' });
        res.json({ message: 'Student and associated user account deleted successfully' });
    } catch (error) {
        console.error('Delete student error:', error);
        res.status(500).json({ error: 'Failed to delete student' });
    }
}

export async function searchStudents(req, res) {
    try {
        // FIX: Use renamed variable to avoid shadowing the imported `query` DB function
        const searchTerm = req.query.q;

        if (await isMongo()) {
            const Student = (await import('../models/mongo/Student.js')).default;
            // ReDoS Protection: Escape special characters in the query string
            const safeQuery = String(searchTerm || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(safeQuery, 'i');
            const students = await Student.find({
                $or: [{ name: regex }, { email: regex }, { id: regex }, { course: regex }]
            }).sort({ created_at: -1 });
            return res.json(students);
        }

        const students = await query(
            `SELECT * FROM students WHERE name LIKE ? OR email LIKE ? OR id LIKE ? OR course LIKE ? ORDER BY created_at DESC`,
            [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`]
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

export async function bulkUpdateStatus(req, res) {
    try {
        const { ids, status } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No student IDs provided' });
        }
        if (!['Active', 'Inactive', 'Graduated'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const mongo = await isMongo();
        if (mongo) {
            const Student = (await import('../models/mongo/Student.js')).default;
            await Student.updateMany({ id: { $in: ids } }, { $set: { status } });
        } else {
            const placeholders = ids.map(() => '?').join(',');
            await run(`UPDATE students SET status = ? WHERE id IN (${placeholders})`, [status, ...ids]);
        }

        res.json({ message: `Successfully updated status for ${ids.length} students` });
    } catch (error) {
        console.error('Bulk update status error:', error);
        res.status(500).json({ error: 'Failed to update students' });
    }
}

/**
 * POST /students/:id/document-log
 * Records a document generation event (School ID or Passport) and updates the
 * student's id_status / passport_status field.
 *
 * Body: { docType: 'id' | 'passport', action: 'generate' | 'regenerate' }
 */
export async function logDocumentGeneration(req, res) {
    try {
        const studentId = req.params.id;
        const { docType, action } = req.body;

        if (!['id', 'passport'].includes(docType)) {
            return res.status(400).json({ error: 'Invalid docType. Must be "id" or "passport".' });
        }
        if (!['generate', 'regenerate'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action. Must be "generate" or "regenerate".' });
        }

        const statusField = docType === 'id' ? 'id_status' : 'passport_status';
        const newStatus = 'Generated';
        const eventLabel = docType === 'id'
            ? (action === 'regenerate' ? 'School ID Regenerated' : 'School ID Generated')
            : (action === 'regenerate' ? 'Student Passport Regenerated' : 'Student Passport Generated');

        const mongo = await isMongo();
        if (mongo) {
            const Student = (await import('../models/mongo/Student.js')).default;
            const student = await Student.findOne({ id: studentId });
            if (!student) return res.status(404).json({ error: 'Student not found' });

            await Student.findOneAndUpdate(
                { id: studentId },
                { $set: { [statusField]: newStatus, updated_at: new Date() } }
            );
        } else {
            const existing = await import('../config/database.js').then(m => m.queryOne('SELECT id FROM students WHERE id = ?', [studentId]));
            if (!existing) return res.status(404).json({ error: 'Student not found' });

            await run(`UPDATE students SET ${statusField} = ?, updated_at = ? WHERE id = ?`, [
                newStatus,
                new Date().toISOString(),
                studentId
            ]);
        }

        // Write audit log
        await logActivity({
            action: eventLabel,
            entity: 'students',
            entityId: studentId,
            userId: req.user?.id || req.user?.email,
            details: `${eventLabel} for student ${studentId} by ${req.user?.email}`
        });

        return res.json({ message: eventLabel, status: newStatus });
    } catch (error) {
        console.error('logDocumentGeneration error:', error);
        res.status(500).json({ error: 'Failed to log document generation.' });
    }
}
