import { queryOne, query } from '../config/database.js';

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

export async function getDashboardStats(req, res) {
    try {
        const mongo = await isMongo();

        // 6-month range configuration for trend data
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const last6Months = [];
        const today = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            last6Months.push({
                name: monthNames[d.getMonth()],
                year: d.getFullYear(),
                monthNum: d.getMonth(),
                enrolled: 0,
                revenue: 0
            });
        }

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
                paymentData,
                allStudentsForTrend,
                allPaymentsForTrend
            ] = await Promise.all([
                Student.countDocuments(),
                Course.countDocuments(),
                Faculty.countDocuments(),
                Course.find().lean(),
                Student.find().select('course').lean(),
                Attendance.find().select('status').lean(),
                (await import('../models/mongo/StudentFee.js')).default.find().select('total_paid total_due').lean(),
                Student.find().select('created_at').lean(),
                (await import('../models/mongo/Payment.js')).default.find({ status: 'Completed' }).select('amount payment_date').lean()
            ]);

            const totalRevenue = paymentData.reduce((sum, p) => sum + (p.total_paid || 0), 0);
            const totalDue = paymentData.reduce((sum, p) => sum + (p.total_due || 0), 0);

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

            // Populate trend metrics
            allStudentsForTrend.forEach(s => {
                const dateVal = s.created_at;
                if (!dateVal) return;
                const date = new Date(dateVal);
                const m = date.getMonth();
                const y = date.getFullYear();
                const match = last6Months.find(item => item.monthNum === m && item.year === y);
                if (match) match.enrolled += 1;
            });

            allPaymentsForTrend.forEach(p => {
                const dateVal = p.payment_date;
                if (!dateVal) return;
                const date = new Date(dateVal);
                const m = date.getMonth();
                const y = date.getFullYear();
                const match = last6Months.find(item => item.monthNum === m && item.year === y);
                if (match) match.revenue += Number(p.amount || 0);
            });

            const enrollmentTrend = last6Months.map(item => ({
                name: item.name,
                enrolled: item.enrolled
            }));

            const revenueTrend = last6Months.map(item => ({
                name: item.name,
                revenue: item.revenue
            }));

            return res.json({
                summary: {
                    students: studentCount,
                    courses: courseCount,
                    faculty: facultyCount,
                    attendance: Math.round(attendanceAvg * 10) / 10,
                    revenue: totalRevenue,
                    total_due: totalDue
                },
                courseDistribution: distribution,
                enrollmentTrend,
                revenueTrend
            });
        }

        // SQL Implementation
        const [
            studentCount,
            courseCount,
            facultyCount,
            attendanceAvg,
            revenueData,
            coursesList,
            allStudentsForTrend,
            allPaymentsForTrend
        ] = await Promise.all([
            queryOne('SELECT COUNT(*) as count FROM students'),
            queryOne('SELECT COUNT(*) as count FROM courses'),
            queryOne('SELECT COUNT(*) as count FROM faculty'),
            queryOne("SELECT AVG(CASE WHEN status = 'Present' THEN 1.0 ELSE 0.0 END) * 100 as avg FROM attendance"),
            queryOne('SELECT SUM(total_paid) as total, SUM(total_due) as due FROM student_fees'),
            query('SELECT name, capacity FROM courses'),
            query('SELECT created_at, course FROM students'),
            query("SELECT amount, payment_date FROM payments WHERE status = 'Completed'")
        ]);

        // Calculate course distribution (count students per course) in memory
        const courseCounts = {};
        allStudentsForTrend.forEach(s => {
            const list = parseStudentCourses(s.course);
            list.forEach(c => {
                const key = String(c).toLowerCase().trim();
                courseCounts[key] = (courseCounts[key] || 0) + 1;
            });
        });

        const distribution = coursesList.map(c => ({
            name: c.name,
            enrolled: courseCounts[String(c.name).toLowerCase().trim()] || 0,
            capacity: c.capacity || 30
        }));

        // Populate trend metrics
        allStudentsForTrend.forEach(s => {
            const dateVal = s.created_at;
            if (!dateVal) return;
            const date = new Date(dateVal);
            const m = date.getMonth();
            const y = date.getFullYear();
            const match = last6Months.find(item => item.monthNum === m && item.year === y);
            if (match) match.enrolled += 1;
        });

        allPaymentsForTrend.forEach(p => {
            const dateVal = p.payment_date;
            if (!dateVal) return;
            const date = new Date(dateVal);
            const m = date.getMonth();
            const y = date.getFullYear();
            const match = last6Months.find(item => item.monthNum === m && item.year === y);
            if (match) match.revenue += Number(p.amount || 0);
        });

        const enrollmentTrend = last6Months.map(item => ({
            name: item.name,
            enrolled: item.enrolled
        }));

        const revenueTrend = last6Months.map(item => ({
            name: item.name,
            revenue: item.revenue
        }));

        res.json({
            summary: {
                students: parseInt(studentCount?.count || 0),
                courses: parseInt(courseCount?.count || 0),
                faculty: parseInt(facultyCount?.count || 0),
                attendance: Math.round((attendanceAvg?.avg || 0) * 10) / 10,
                revenue: parseFloat(revenueData?.total || 0),
                total_due: parseFloat(revenueData?.due || 0)
            },
            courseDistribution: distribution,
            enrollmentTrend,
            revenueTrend
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
}

export async function globalSearch(req, res) {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) return res.json({ results: [] });

        const mongo = await isMongo();
        const searchRegex = new RegExp(q, 'i');
        const searchSql = `%${q}%`;

        let students, courses, faculty, inventory;

        if (mongo) {
            const Student = (await import('../models/mongo/Student.js')).default;
            const Course = (await import('../models/mongo/Course.js')).default;
            const Faculty = (await import('../models/mongo/Faculty.js')).default;

            [students, courses, faculty] = await Promise.all([
                Student.find({ $or: [{ name: searchRegex }, { email: searchRegex }, { id: searchRegex }] }).limit(5).lean(),
                Course.find({ name: searchRegex }).limit(5).lean(),
                Faculty.find({ name: searchRegex }).limit(5).lean()
            ]);
            inventory = []; // Mongo inventory model not yet implemented
        } else {

            [students, courses, faculty, inventory] = await Promise.all([
                query('SELECT id, name, email as sub FROM students WHERE name LIKE ? OR email LIKE ? OR id LIKE ? LIMIT 5', [searchSql, searchSql, searchSql]),
                query('SELECT id, name, department as sub FROM courses WHERE name LIKE ? LIMIT 5', [searchSql]),
                query('SELECT id, name, role as sub FROM faculty WHERE name LIKE ? LIMIT 5', [searchSql]),
                query('SELECT id, name, item_code as sub FROM inv_items WHERE name LIKE ? OR item_code LIKE ? LIMIT 5', [searchSql, searchSql])
            ]);
        }

        const results = [
            ...students.map(s => ({ type: 'student', id: s.id || s._id, name: s.name, sub: s.sub || s.email, link: '/students' })),
            ...courses.map(c => ({ type: 'course', id: c.id || c._id, name: c.name, sub: c.sub || c.department, link: '/courses' })),
            ...faculty.map(f => ({ type: 'faculty', id: f.id || f._id, name: f.name, sub: f.sub || 'Faculty', link: '/faculty' })),
            ...inventory.map(i => ({ type: 'inventory', id: i.id || i._id, name: i.name, sub: i.sub || i.item_code, link: '/inventory' }))
        ];

        res.json({ results });
    } catch (error) {
        console.error('Global search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
}
