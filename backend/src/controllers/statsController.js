import { queryOne, query } from '../config/database.js';

const isMongo = async () => !!process.env.MONGODB_URI;

export async function getDashboardStats(req, res) {
    try {
        const mongo = await isMongo();

        if (mongo) {
            const Student = (await import('../models/mongo/Student.js')).default;
            const Course = (await import('../models/mongo/Course.js')).default;
            const Faculty = (await import('../models/mongo/Faculty.js')).default;
            const Attendance = (await import('../models/mongo/Attendance.js')).default;

            const [
                studentCount,
                courseCount,
                facultyCount,
                allCourses,
                allStudents,
                attendanceData,
                paymentData
            ] = await Promise.all([
                Student.countDocuments(),
                Course.countDocuments(),
                Faculty.countDocuments(),
                Course.find().lean(),
                Student.find().select('course').lean(),
                Attendance.find().select('status').lean(),
                (await import('../models/mongo/StudentFee.js')).default.find().select('total_paid').lean()
            ]);

            const totalRevenue = paymentData.reduce((sum, p) => sum + (p.total_paid || 0), 0);

            // Calculate attendance percentage
            const presentCount = attendanceData.filter(a => a.status === 'Present').length;
            const attendanceAvg = attendanceData.length > 0 ? (presentCount / attendanceData.length) * 100 : 0;

            // Calculate course distribution (count students per course)
            const distribution = allCourses.map(course => {
                const enrolled = allStudents.filter(s => {
                    const studentCourses = Array.isArray(s.course) ? s.course : [s.course];
                    return studentCourses.some(sc => String(sc).toLowerCase().trim() === String(course.name).toLowerCase().trim());
                }).length;
                return {
                    name: course.name,
                    enrolled: enrolled,
                    capacity: course.capacity || 30
                };
            });

            return res.json({
                summary: {
                    students: studentCount,
                    courses: courseCount,
                    faculty: facultyCount,
                    attendance: Math.round(attendanceAvg * 10) / 10,
                    revenue: totalRevenue
                },
                courseDistribution: distribution
            });
        }

        // SQL Implementation
        const [
            studentCount,
            courseCount,
            facultyCount,
            attendanceAvg,
            revenueData
        ] = await Promise.all([
            queryOne('SELECT COUNT(*) as count FROM students'),
            queryOne('SELECT COUNT(*) as count FROM courses'),
            queryOne('SELECT COUNT(*) as count FROM faculty'),
            queryOne("SELECT AVG(CASE WHEN status = 'Present' THEN 1.0 ELSE 0.0 END) * 100 as avg FROM attendance"),
            queryOne('SELECT SUM(total_paid) as total FROM student_fees')
        ]);

        // Improved SQL distribution: Get student count for EVERY registered course
        // Use a subquery or join to ensure courses with 0 students are included
        const distribution = await query(`
            SELECT 
                c.name, 
                c.capacity,
                (SELECT COUNT(*) FROM students s WHERE LOWER(s.course) LIKE '%' || LOWER(c.name) || '%') as enrolled
            FROM courses c
        `);

        res.json({
            summary: {
                students: parseInt(studentCount?.count || 0),
                courses: parseInt(courseCount?.count || 0),
                faculty: parseInt(facultyCount?.count || 0),
                attendance: Math.round((attendanceAvg?.avg || 0) * 10) / 10,
                revenue: parseFloat(revenueData?.total || 0)
            },
            courseDistribution: distribution
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
}
