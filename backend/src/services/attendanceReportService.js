import { randomUUID } from 'crypto';
import PDFDocument from 'pdfkit';
import moment from 'moment';
import { query, getActiveDbEngine } from '../config/database.js';

const isMongo = () => getActiveDbEngine() === 'mongodb';

/**
 * Fetch all attendance data for a specific date, enriched with student and course details
 */
async function fetchAllAttendanceData(date) {
    const isMongo = getActiveDbEngine() === 'mongodb';
    
    if (isMongo) {
        const Attendance = (await import('../models/mongo/Attendance.js')).default;
        const Student = (await import('../models/mongo/Student.js')).default;
        const Course = (await import('../models/mongo/Course.js')).default;

        const startOfDay = moment(date).startOf('day').toDate();
        const endOfDay = moment(date).endOf('day').toDate();

        const attendances = await Attendance.find({
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        if (attendances.length === 0) return [];

        const enrichedData = [];
        for (const att of attendances) {
            const student = await Student.findOne({ id: att.student_id });
            const course = await Course.findOne({ name: att.course });
            
            enrichedData.push({
                department_name: course?.department || 'General',
                course_name: att.course,
                date: moment(att.date).format('YYYY-MM-DD'),
                student_name: student?.name || 'Unknown Student',
                admission_number: att.student_id,
                status: att.status,
                lecturer_name: course?.instructor || 'TBA'
            });
        }
        return enrichedData;
    } else {
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
        return await query(sql, [date]);
    }
}

/**
 * Persist a rendered report. Serverless filesystems are read-only and per-instance,
 * so the PDF bytes live in the database instead of on disk. Regenerating the same
 * department/date replaces the previous copy.
 */
async function saveAttendanceReport({ department, reportDate, fileName, buffer }) {
    const content = buffer.toString('base64');

    if (isMongo()) {
        const AttendanceReport = (await import('../models/mongo/AttendanceReport.js')).default;
        await AttendanceReport.updateOne(
            { department, report_date: reportDate },
            { $set: { filename: fileName, file_size: buffer.length, content } },
            { upsert: true }
        );
        return;
    }

    await query(
        `INSERT INTO attendance_reports (id, department, report_date, filename, file_size, content)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (department, report_date) DO UPDATE SET
            filename = EXCLUDED.filename,
            file_size = EXCLUDED.file_size,
            content = EXCLUDED.content,
            created_at = CURRENT_TIMESTAMP`,
        [randomUUID(), department, reportDate, fileName, buffer.length, content]
    );
}

export async function listSavedAttendanceReports() {
    if (isMongo()) {
        const AttendanceReport = (await import('../models/mongo/AttendanceReport.js')).default;
        const rows = await AttendanceReport.find({}, '-content').sort({ created_at: -1 }).lean();
        return rows.map(r => ({ name: r.filename, size: Number(r.file_size) || 0, createdAt: r.created_at }));
    }

    const rows = await query('SELECT filename, file_size, created_at FROM attendance_reports ORDER BY created_at DESC');
    return rows.map(r => ({ name: r.filename, size: Number(r.file_size) || 0, createdAt: r.created_at }));
}

export async function readSavedAttendanceReport(fileName) {
    if (isMongo()) {
        const AttendanceReport = (await import('../models/mongo/AttendanceReport.js')).default;
        const row = await AttendanceReport.findOne({ filename: fileName }).lean();
        return row?.content ? Buffer.from(row.content, 'base64') : null;
    }

    const rows = await query('SELECT content FROM attendance_reports WHERE filename = ?', [fileName]);
    return rows[0]?.content ? Buffer.from(rows[0].content, 'base64') : null;
}

/**
 * Generate daily attendance reports for all departments
 * @param {string} date - Date in YYYY-MM-DD format. Defaults to today.
 */
export async function generateDailyAttendanceReports(date = moment().format('YYYY-MM-DD')) {
    try {
        console.log(`📊 Starting daily attendance report generation for ${date}...`);

        // Fetch all data for the date
        const allData = await fetchAllAttendanceData(date);
        console.log(`📊 Found ${allData.length} records for ${date}`);

        if (allData.length === 0) {
            console.log(`ℹ️ No attendance records found for ${date}.`);
            return [];
        }

        // Group by Department
        const deptsGrouped = groupBy(allData, 'department_name');
        console.log(`🏢 Grouped into ${Object.keys(deptsGrouped).length} departments:`, Object.keys(deptsGrouped));
        const results = [];

        // For each department, generate a PDF
        for (const deptName in deptsGrouped) {
            console.log(`🏢 Processing department: ${deptName}`);
            const deptData = deptsGrouped[deptName];
            
            // Group by Course within department
            const coursesGrouped = groupBy(deptData, 'course_name');

            const fileName = `Attendance_Record_${deptName.replace(/\s+/g, '_')}_${date}.pdf`;
            const buffer = await createDepartmentPDF(deptName, date, coursesGrouped);

            await saveAttendanceReport({ department: deptName, reportDate: date, fileName, buffer });

            results.push({ department: deptName, fileName, size: buffer.length });
        }

        console.log(`✅ Completed report generation. Generated ${results.length} reports.`);
        return results;

    } catch (error) {
        console.error('❌ Error generating daily attendance reports:', error);
        throw error;
    }
}

/**
 * Create a professional PDF for a department
 */
async function createDepartmentPDF(deptName, date, coursesGrouped) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
        const chunks = [];

        // IMPORTANT: Register listeners BEFORE calling doc.end()
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header Section
        doc.fillColor('#800000').fontSize(20).font('Helvetica-Bold').text('BEAUTEX TECHNICAL COLLEGE', { align: 'center' });
        doc.fillColor('#000000').fontSize(14).font('Helvetica').text('DAILY CLASS ATTENDANCE RECORD', { align: 'center' });
        doc.fontSize(8).fillColor('#666666').text(`Generated at: ${moment().format('YYYY-MM-DD HH:mm:ss')}`, { align: 'center' });
        doc.moveDown();

        const totalStudents = Object.values(coursesGrouped).reduce((sum, arr) => sum + arr.length, 0);

        doc.fontSize(12).font('Helvetica-Bold').text(`Department: ${deptName}`);
        doc.font('Helvetica').text(`Total Students: ${totalStudents}`);
        doc.text(`Date: ${moment(date).format('MMMM Do, YYYY')}`);
        doc.moveDown();

        const courseList = Object.keys(coursesGrouped);

        try {
            for (const courseName of courseList) {
                const students = coursesGrouped[courseName];
                const lecturerName = students[0]?.lecturer_name || 'N/A';

                // Course section header bar
                const barY = doc.y;
                doc.fillColor('#800000').rect(30, barY, 535, 22).fill();
                doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10)
                   .text(`${courseName}   |   Trainer: ${lecturerName}   |   8:30 AM – 3:00 PM`, 35, barY + 6, { width: 525 });
                doc.fillColor('#000000').moveDown(0.3);

                // Table column widths (total = 510)
                const cols = [35, 105, 200, 75, 95];
                const tableHeaders = ['S/N', 'Admission No', 'Student Name', 'Status', 'Signature'];

                // Draw header row
                const hdrY = doc.y;
                doc.fillColor('#f0f0f0').rect(30, hdrY, 510, 22).fill();
                doc.fillColor('#333333').font('Helvetica-Bold').fontSize(9);
                let cx = 30;
                tableHeaders.forEach((h, i) => {
                    doc.text(h, cx + 4, hdrY + 7, { width: cols[i] - 8, lineBreak: false });
                    cx += cols[i];
                });

                // Draw data rows
                let rowY = hdrY + 22;
                doc.font('Helvetica').fontSize(9);

                students.forEach((s, i) => {
                    if (rowY > 740) {
                        doc.addPage();
                        rowY = 50;
                    }
                    // Alternating row fill
                    const bg = i % 2 === 0 ? '#ffffff' : '#f9f9f9';
                    doc.fillColor(bg).rect(30, rowY, 510, 20).fill();

                    doc.fillColor('#000000');
                    cx = 30;
                    const cells = [
                        String(i + 1),
                        s.admission_number || '—',
                        s.student_name || '—',
                        s.status || '—',
                        ''
                    ];
                    cells.forEach((cell, idx) => {
                        doc.text(cell, cx + 4, rowY + 5, { width: cols[idx] - 8, lineBreak: false });
                        cx += cols[idx];
                    });

                    // Bottom border of row
                    doc.moveTo(30, rowY + 20).lineTo(540, rowY + 20)
                       .strokeColor('#dddddd').lineWidth(0.5).stroke();
                    rowY += 20;
                });

                // Outer border around the table
                const tableTop = hdrY;
                const tableBot = rowY;
                doc.rect(30, tableTop, 510, tableBot - tableTop)
                   .strokeColor('#cccccc').lineWidth(0.8).stroke();

                // Column vertical lines
                cx = 30;
                cols.forEach((w) => {
                    cx += w;
                    if (cx < 540) {
                        doc.moveTo(cx, tableTop).lineTo(cx, tableBot)
                           .strokeColor('#dddddd').lineWidth(0.5).stroke();
                    }
                });

                doc.y = rowY + 12;
                doc.moveDown(0.5);

                if (courseList.indexOf(courseName) < courseList.length - 1 && doc.y > 650) {
                    doc.addPage();
                }
            }

            // End-of-report marker
            doc.moveDown(1.5);
            doc.font('Helvetica-Oblique').fontSize(8).fillColor('#888888')
               .text('— END OF DEPARTMENTAL ATTENDANCE RECORD —', { align: 'center' });

            // Page footers (requires bufferPages: true)
            const range = doc.bufferedPageRange();
            for (let i = 0; i < range.count; i++) {
                doc.switchToPage(i);
                doc.font('Helvetica').fontSize(7).fillColor('#aaaaaa')
                   .text(
                       `Page ${i + 1} of ${range.count}  |  Generated by Beautex College Management System  |  ${moment().format('YYYY-MM-DD HH:mm')}`,
                       30, doc.page.height - 35,
                       { align: 'center', width: 535 }
                   );
            }

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

// Utility: Group by key
function groupBy(array, key) {
    return array.reduce((result, currentValue) => {
        (result[currentValue[key]] = result[currentValue[key]] || []).push(currentValue);
        return result;
    }, {});
}
