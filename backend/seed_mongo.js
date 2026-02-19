import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from './src/models/mongo/User.js';
import Student from './src/models/mongo/Student.js';
import Course from './src/models/mongo/Course.js';
import Faculty from './src/models/mongo/Faculty.js';

dotenv.config();

const seedData = async () => {
    try {
        const MONGODB_URI = process.env.MONGODB_URI;
        if (!MONGODB_URI) {
            console.error('❌ MONGODB_URI is not defined in .env');
            process.exit(1);
        }

        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB for seeding...');

        // Clear existing data
        await User.deleteMany({});
        await Student.deleteMany({});
        await Course.deleteMany({});
        await Faculty.deleteMany({});

        console.log('🗑️  Cleared existing collections.');

        // Seed Superadmin
        const hashedPassword = await bcrypt.hash('admin123', 10);
        const admin = await User.create({
            email: 'admin@beautex.edu',
            password: hashedPassword,
            role: 'superadmin',
            status: 'Active'
        });
        console.log('👤 Created Superadmin');

        // Seed Course
        const course = await Course.create({
            code: 'COS001',
            name: 'Cosmetology',
            department: 'Beauty',
            instructor: 'Jane Doe',
            capacity: 30,
            enrolled: 1
        });
        console.log('📚 Created Course');

        // Seed Student
        await Student.create({
            student_id: 'STU001',
            name: 'Alice Smith',
            email: 'alice@example.com',
            course: 'Cosmetology',
            enrollment_date: new Date()
        });
        console.log('🎓 Created Student');

        // Seed Faculty
        await Faculty.create({
            name: 'Jane Doe',
            email: 'jane@beautex.edu',
            department: 'Beauty',
            designation: 'Senior Instructor',
            courses: ['Cosmetology']
        });
        console.log('👩‍🏫 Created Faculty');

        console.log('\n✨ Database seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

seedData();
