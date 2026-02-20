import { queryOne, query } from '../config/database.js';

export async function getDashboardStats(req, res) {
    try {
        const [
            studentCount,
            courseCount,
            facultyCount,
            attendanceAvg,
            recentEnrollments
        ] = await Promise.all([
            queryOne('SELECT COUNT(*) as count FROM students'),
            queryOne('SELECT COUNT(*) as count FROM courses'),
            queryOne('SELECT COUNT(*) as count FROM faculty'),
            queryOne("SELECT AVG(CASE WHEN status = 'Present' THEN 1.0 ELSE 0.0 END) * 100 as avg FROM attendance"),
            query('SELECT enrolled_date as date, COUNT(*) as count FROM students GROUP BY enrolled_date ORDER BY enrolled_date DESC LIMIT 7')
        ]);

        // Correctly calculate course distribution by joining students with courses on course name
        const distribution = await query(`
            SELECT c.department as name, COUNT(s.id) as value 
            FROM courses c 
            LEFT JOIN students s ON LOWER(s.course) = LOWER(c.name)
            GROUP BY c.department
        `);

        res.json({
            summary: {
                students: parseInt(studentCount?.count || 0),
                courses: parseInt(courseCount?.count || 0),
                faculty: parseInt(facultyCount?.count || 0),
                attendance: Math.round((attendanceAvg?.avg || 0) * 10) / 10
            },
            recentEnrollments: recentEnrollments.map(r => ({ date: r.date, count: r.count })),
            courseDistribution: distribution
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
}
