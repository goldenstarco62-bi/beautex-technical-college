import { queryOne, query } from '../config/database.js';

export async function getDashboardStats(req, res) {
    try {
        const [
            studentCount,
            courseCount,
            facultyCount,
            attendanceAvg,
            recentEnrollments,
            courseDistribution
        ] = await Promise.all([
            queryOne('SELECT COUNT(*) as count FROM students'),
            queryOne('SELECT COUNT(*) as count FROM courses'),
            queryOne('SELECT COUNT(*) as count FROM faculty'),
            queryOne("SELECT AVG(CASE WHEN status = 'Present' THEN 1.0 ELSE 0.0 END) * 100 as avg FROM attendance"),
            query('SELECT enrolled_date as date, COUNT(*) as count FROM students GROUP BY enrolled_date ORDER BY enrolled_date DESC LIMIT 7'),
            query('SELECT department as name, COUNT(*) as value FROM students GROUP BY department') // This might need a join or department field in students
        ]);

        // Fix course distribution if students table doesn't have department
        // Let's assume courses have departments and students are enrolled in courses
        const distribution = await query(`
            SELECT c.department as name, COUNT(s.id) as value 
            FROM courses c 
            JOIN students s ON s.course = c.id 
            GROUP BY c.department
        `);

        res.json({
            summary: {
                students: studentCount.count,
                courses: courseCount.count,
                faculty: facultyCount.count,
                attendance: Math.round((attendanceAvg.avg || 0) * 10) / 10
            },
            recentEnrollments: recentEnrollments.map(r => ({ date: r.date, count: r.count })),
            courseDistribution: distribution
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
}
