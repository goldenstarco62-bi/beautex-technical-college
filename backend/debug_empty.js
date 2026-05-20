import 'dotenv/config';
import { query } from './src/config/database.js';

async function debugQuery() {
    const date = new Date().toISOString().split('T')[0];
    console.log('Searching for date:', date);
    
    const sql = `
        SELECT 
            COALESCE(c.department, 'General') as department_name,
            c.name as course_name,
            a.date,
            s.name as student_name,
            s.id as admission_number,
            a.status,
            c.instructor as lecturer_name
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        JOIN courses c ON a.course = c.name
        WHERE a.date = ?
        ORDER BY c.department, c.name, s.name
    `;
    
    try {
        const rows = await query(sql, [date]);
        console.log('Rows found:', rows.length);
        if (rows.length > 0) {
            console.log('Sample row:', JSON.stringify(rows[0], null, 2));
        } else {
            console.log('No rows found. Checking individual components...');
            
            const attendance = await query('SELECT student_id, course, date FROM attendance WHERE date = ?', [date]);
            console.log('Attendance records for today:', attendance.length);
            if (attendance.length > 0) {
                const sampleA = attendance[0];
                console.log('Sample Attendance:', sampleA);
                
                const student = await query('SELECT id, name FROM students WHERE id = ?', [sampleA.student_id]);
                console.log('Matching Student:', student);
                
                const course = await query('SELECT id, name FROM courses WHERE name = ?', [sampleA.course]);
                console.log('Matching Course (by name):', course);

                const courseById = await query('SELECT id, name FROM courses WHERE id = ?', [sampleA.course]);
                console.log('Matching Course (by ID):', courseById);
            }
        }
    } catch (err) {
        console.error('Query failed:', err);
    } finally {
        process.exit();
    }
}

debugQuery();
