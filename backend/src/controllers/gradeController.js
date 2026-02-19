import { getDb, query, queryOne, run } from '../config/database.js';

async function isMongo() {
    const db = await getDb();
    return db.constructor.name === 'NativeConnection';
}

export async function getAllGrades(req, res) {
    try {
        if (await isMongo()) {
            const Grade = (await import('../models/mongo/Grade.js')).default;
            const Student = (await import('../models/mongo/Student.js')).default;

            let query = {};
            if (req.user?.role === 'student') {
                const studentId = req.user.student_id;
                if (!studentId) {
                    console.warn(`⚠️ Student ${req.user.email} attempted to fetch grades without a student_id (Mongo)`);
                    return res.json([]);
                }
                query.student_id = String(studentId);
            } else if (req.query.course) {
                query.course = req.query.course;
            }

            const grades = await Grade.find(query).sort({ created_at: -1 }).lean();

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

        let sql = `
            SELECT g.*, s.name as student_name, s.photo as student_photo
            FROM grades g
            LEFT JOIN students s ON LOWER(TRIM(g.student_id)) = LOWER(TRIM(s.id))
        `;
        let params = [];

        if (req.user?.role === 'student') {
            const studentId = req.user.student_id;
            if (!studentId) {
                console.warn(`⚠️ Student ${req.user.email} attempted to fetch grades without a student_id`);
                return res.json([]); // Return empty if no ID to prevent seeing all
            }
            sql += ' WHERE LOWER(TRIM(g.student_id)) = LOWER(TRIM(?))';
            params.push(String(studentId).trim());
        } else if (req.query.course) {
            sql += ` WHERE g.course = ? `;
            params.push(req.query.course);
        }

        sql += ` ORDER BY g.id DESC `;

        const grades = await query(sql, params);
        res.json(grades);
    } catch (error) {
        console.error('Get grades error:', error);
        res.status(500).json({ error: 'Failed to fetch grades' });
    }
}

export async function createGrade(req, res) {
    try {
        const { student_id, course, assignment, month, score, max_score, remarks } = req.body;

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
