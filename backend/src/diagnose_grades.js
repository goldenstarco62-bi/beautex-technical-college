import 'dotenv/config';
import { query, getDb } from './config/database.js';
import mongoose from 'mongoose';

const MONGODB_URI = "mongodb+srv://dbNdinyo:Ndinyo%4039@cluster0.3xmoe2z.mongodb.net/?appName=Cluster0";

async function diagnoseGrades() {
    try {
        console.log('🍃 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        const db = mongoose.connection;
        const isMongo = true;
        console.log(`🌐 Database Type: MongoDB (Forced)`);

        if (isMongo) {
            const Grade = (await import('./models/mongo/Grade.js')).default;
            const Student = (await import('./models/mongo/Student.js')).default;
            const User = (await import('./models/mongo/User.js')).default;

            const gradesCount = await Grade.countDocuments();
            console.log(`📊 Total Grades in MongoDB: ${gradesCount}`);

            const sampleGrades = await Grade.find().limit(5).lean();
            console.log('📝 Sample Grades:');
            console.log(JSON.stringify(sampleGrades.map(g => ({
                id: g._id.toString(),
                student_id: g.student_id,
                course: g.course,
                assignment: g.assignment,
                score: g.score
            })), null, 2));

            const studentsCount = await Student.countDocuments();
            console.log(`👨‍🎓 Total Students in MongoDB: ${studentsCount}`);

            const sampleStudents = await Student.find().limit(5).lean();
            console.log('📋 Sample Students:');
            console.log(JSON.stringify(sampleStudents.map(s => ({
                id: s.id,
                name: s.name,
                email: s.email
            })), null, 2));

            const users = await User.find({ role: 'student' }).limit(5).lean();
            console.log('👥 Sample Student Users:');
            console.log(JSON.stringify(users.map(u => ({
                email: u.email,
                role: u.role
            })), null, 2));

        } else {
            const grades = await query('SELECT * FROM grades LIMIT 5');
            console.log('📊 Sample Grades (SQL):');
            console.log(JSON.stringify(grades, null, 2));

            const students = await query('SELECT id, name, email FROM students LIMIT 5');
            console.log('👨‍🎓 Sample Students (SQL):');
            console.log(JSON.stringify(students, null, 2));

            const users = await query("SELECT email, role FROM users WHERE role = 'student' LIMIT 5");
            console.log('👥 Sample Student Users (SQL):');
            console.log(JSON.stringify(users, null, 2));
        }

    } catch (err) {
        console.error('❌ Error during diagnosis:', err);
    }
    process.exit(0);
}

diagnoseGrades();
