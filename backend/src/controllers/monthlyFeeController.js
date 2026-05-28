import { query, queryOne, run } from '../config/database.js';
import pdfkit from 'pdfkit';
import PDFTable from 'pdfkit-table';
import ExcelJS from 'exceljs';
import moment from 'moment';

/**
 * Helper to parse text duration (e.g., "6 Months", "1 Year", "10") into number of months.
 * Handles: "6 Months", "6months", "1 Year", "8 Weeks", "10", "4 month", "2 yrs" etc.
 */
export function parseDurationToMonths(durationStr) {
    if (!durationStr) return 0;
    const cleanStr = String(durationStr).toLowerCase().trim();
    
    // Year variations: year, years, yr, yrs
    if (/yr|year/.test(cleanStr)) {
        const match = cleanStr.match(/(\d+)/);
        const years = match ? parseInt(match[0], 10) : 1;
        return years * 12;
    }
    
    // Month variations: month, months, mo, mths, mth
    if (/month|mths?|\bmo\b/.test(cleanStr)) {
        const match = cleanStr.match(/(\d+)/);
        return match ? parseInt(match[0], 10) : 1;
    }
    
    // Week variations: week, weeks, wk, wks
    if (/week|wks?/.test(cleanStr)) {
        const match = cleanStr.match(/(\d+)/);
        const weeks = match ? parseInt(match[0], 10) : 1;
        return Math.max(1, Math.round(weeks / 4.33));
    }
    
    // Fallback: if the value is purely numeric, treat it as months
    const numericOnly = cleanStr.match(/^(\d+)$/);
    if (numericOnly) {
        return parseInt(cleanStr, 10);
    }
    
    return 0;
}

/**
 * Checks if a course is eligible for monthly fee tracking (duration >= 4 months).
 */
export function isCourseEligible(durationStr) {
    const months = parseDurationToMonths(durationStr);
    return months >= 4;
}

/**
 * Finds a course from a list by name, using exact-match first, then partial/fuzzy.
 */
function findCourseByName(coursesList, targetName) {
    if (!targetName) return null;
    const target = targetName.toLowerCase().trim();
    // 1. Exact match (case-insensitive)
    let found = coursesList.find(c => c.name && c.name.toLowerCase().trim() === target);
    if (found) return found;
    // 2. Partial match: target includes or is included in course name
    found = coursesList.find(c => {
        if (!c.name) return false;
        const cName = c.name.toLowerCase().trim();
        return cName.includes(target) || target.includes(cName);
    });
    return found || null;
}

/**
 * Safely parses student course JSON arrays or strings into a clean array of course names.
 */
export function parseStudentCourses(courseVal) {
    if (!courseVal) return [];
    if (typeof courseVal !== 'string') {
        if (Array.isArray(courseVal)) return courseVal;
        return [courseVal];
    }
    const trimmed = courseVal.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
            // ignore JSON parse error, treat as plain string
        }
    }
    return trimmed.split(',').map(c => c.trim()).filter(Boolean);
}

/**
 * Parses raw JSON or comma-separated course list into a clean comma-separated display string.
 */
export function parseCourse(raw) {
    if (!raw) return 'N/A';
    try {
        if (typeof raw === 'string' && raw.startsWith('{') && raw.endsWith('}')) {
            return raw.slice(1, -1).split(',').map(s => s.replace(/^"|"$/g, '').trim()).filter(Boolean).join(', ');
        }
        if (typeof raw === 'string' && raw.startsWith('[')) {
            const parsed = JSON.parse(raw);
            return (Array.isArray(parsed) ? parsed : [parsed]).join(', ');
        }
    } catch (e) {}
    return String(raw);
}


/**
 * Syncs overall student fee summary in student_fees table based on all payments.
 */
async function syncStudentFees(studentId) {
    try {
        const paidRow = await queryOne(
            'SELECT COALESCE(SUM(amount), 0) as total_paid, MAX(payment_date) as last_date FROM payments WHERE student_id = ? AND status = ?',
            [studentId, 'Completed']
        );
        const totalPaid = parseFloat(paidRow?.total_paid || 0);
        const lastDate = paidRow?.last_date;

        let fee = await queryOne('SELECT * FROM student_fees WHERE student_id = ?', [studentId]);
        if (fee) {
            const existingTotalDue = Number(fee.total_due || 0);
            const balance = existingTotalDue > 0 ? Math.max(0, (existingTotalDue - totalPaid)) : 0;
            const status = (balance <= 0 && existingTotalDue > 0) ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Pending');

            await run(
                'UPDATE student_fees SET total_paid = ?, balance = ?, status = ?, last_payment_date = ? WHERE student_id = ?',
                [totalPaid, balance, status, lastDate, studentId]
            );
        }
    } catch (err) {
        console.error(`❌ Sync student fees failed for ${studentId}:`, err);
    }
}

/**
 * Automatically initializes monthly tracking records for eligible students for the current month.
 */
export async function autoInitializeCurrentMonth(targetYear, targetMonth) {
    try {
        const now = new Date();
        const year = targetYear || now.getFullYear();
        const month = targetMonth || (now.getMonth() + 1);
        
        const monthsNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthLabel = `${monthsNames[month - 1]} ${year}`;
        const dueDate = `${year}-${String(month).padStart(2, '0')}-10`;

        console.log(`⏳ Auto-initializing monthly fee records for: ${monthLabel}`);

        // Fetch ALL active students and their fee summaries
        const activeStudents = await query(`
            SELECT s.id, s.name, s.course, s.department, s.enrolled_date, sf.total_due
            FROM students s
            LEFT JOIN student_fees sf ON s.id = sf.student_id
            WHERE s.status = 'Active'
        `);

        // Fetch ALL courses (active AND inactive) to map durations — inactive courses can still have enrolled students
        const allCourses = await query('SELECT id, name, duration, status FROM courses');

        let newRecords = 0;
        let skippedShort = 0;
        let skippedNoMatch = 0;

        for (const student of activeStudents) {
            let maxDurationMonths = 0;
            let selectedDurationStr = null;
            const studentCourseNames = parseStudentCourses(student.course);

            for (const cName of studentCourseNames) {
                // Use fuzzy matching to find the course
                const matchedCourse = findCourseByName(allCourses, cName);
                if (matchedCourse && matchedCourse.duration) {
                    const durMonths = parseDurationToMonths(matchedCourse.duration);
                    if (durMonths > maxDurationMonths) {
                        maxDurationMonths = durMonths;
                        selectedDurationStr = matchedCourse.duration;
                    }
                }
            }

            // Fallback: if no course match found but student has a course name, try to parse it as-is
            // (e.g., student.course might already be a duration string in some legacy data)
            if (maxDurationMonths === 0 && student.course) {
                const fallbackMonths = parseDurationToMonths(student.course);
                if (fallbackMonths > 0) {
                    maxDurationMonths = fallbackMonths;
                    selectedDurationStr = student.course;
                    console.log(`  ⚠️  Using course field as duration fallback for "${student.name}": ${student.course} → ${fallbackMonths} months`);
                }
            }

            if (maxDurationMonths === 0) {
                console.log(`  ⚠️  No course match found for "${student.name}" (course: "${student.course}") — skipping`);
                skippedNoMatch++;
                continue;
            }

            if (maxDurationMonths < 4) {
                console.log(`  ℹ️  Skipping "${student.name}" — course "${student.course}" is only ${maxDurationMonths} month(s)`);
                skippedShort++;
                continue;
            }

            const durationMonths = maxDurationMonths;

            // Check if record already exists for this student/month/year
            const existing = await queryOne(
                'SELECT id FROM monthly_fee_tracking WHERE student_id = ? AND year = ? AND month = ?',
                [student.id, year, month]
            );

            if (existing) continue; // Already tracked

            // Calculate monthly amount due: total_due / duration_months
            let totalDue = parseFloat(student.total_due || 0);

            // If no total_due set, check fee_structures for tuition fee
            if (totalDue === 0 && student.course) {
                for (const cName of studentCourseNames) {
                    const courseObj = findCourseByName(allCourses, cName);
                    if (courseObj) {
                        const structure = await queryOne(
                            "SELECT amount FROM fee_structures WHERE course_id = ? AND category = 'Tuition Fee'",
                            [courseObj.id]
                        );
                        if (structure) {
                            totalDue = parseFloat(structure.amount || 0);
                            break;
                        }
                    }
                }
            }

            const amountDue = durationMonths > 0 ? Math.round(totalDue / durationMonths) : 0;

            // Calculate how much was paid in this specific month
            const payments = await query(
                'SELECT amount, payment_date FROM payments WHERE student_id = ? AND status = ?',
                [student.id, 'Completed']
            );
            let paidThisMonth = 0;
            for (const p of payments) {
                const pDate = new Date(p.payment_date);
                if (pDate.getFullYear() === year && (pDate.getMonth() + 1) === month) {
                    paidThisMonth += parseFloat(p.amount || 0);
                }
            }

            const balance = Math.max(0, amountDue - paidThisMonth);
            let status = 'Not Paid';
            if (balance <= 0 && amountDue > 0) {
                status = 'Paid';
            } else if (paidThisMonth > 0) {
                status = 'Partial';
            }

            await run(`
                INSERT INTO monthly_fee_tracking 
                (student_id, year, month, month_label, amount_due, amount_paid, balance, status, due_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [student.id, year, month, monthLabel, amountDue, paidThisMonth, balance, status, dueDate]);
            newRecords++;
            console.log(`  ✅ Added tracking for "${student.name}" | course=${student.course} (${durationMonths}mo) | amountDue=${amountDue}`);
        }

        console.log(`✅ Monthly fee init for ${monthLabel}: +${newRecords} new, ${skippedShort} skipped (short), ${skippedNoMatch} skipped (no match)`);
    } catch (err) {
        console.error('❌ Failed to auto-initialize monthly fee records:', err);
    }
}

/**
 * HTTP handler to manually initialize monthly records
 */
export async function initializeMonthlyRecords(req, res) {
    try {
        const { year, month } = req.body;
        const now = new Date();
        const targetYear = year ? parseInt(year, 10) : now.getFullYear();
        const targetMonth = month ? parseInt(month, 10) : (now.getMonth() + 1);

        if (targetMonth < 1 || targetMonth > 12) {
            return res.status(400).json({ error: 'Month must be between 1 and 12' });
        }

        await autoInitializeCurrentMonth(targetYear, targetMonth);
        return res.json({ message: 'Monthly fee records initialized successfully' });
    } catch (err) {
        console.error('Error in initializeMonthlyRecords:', err);
        return res.status(500).json({ error: err.message });
    }
}

/**
 * Gets overview / status summary for dashboard
 */
export async function getCurrentMonthStatus(req, res) {
    try {
        const now = new Date();
        const year = req.query.year ? parseInt(req.query.year, 10) : now.getFullYear();
        const month = req.query.month ? parseInt(req.query.month, 10) : (now.getMonth() + 1);
        const { status, department, course, search } = req.query;

        // First ensure records exist
        await autoInitializeCurrentMonth(year, month);

        let sql = `
            SELECT 
                COUNT(*) as total_students,
                SUM(CASE WHEN mft.status = 'Paid' THEN 1 ELSE 0 END) as paid_count,
                SUM(CASE WHEN mft.status = 'Not Paid' THEN 1 ELSE 0 END) as unpaid_count,
                SUM(CASE WHEN mft.status = 'Partial' THEN 1 ELSE 0 END) as partial_count,
                COALESCE(SUM(mft.amount_due), 0) as total_due,
                COALESCE(SUM(mft.amount_paid), 0) as total_paid,
                COALESCE(SUM(mft.balance), 0) as total_pending
            FROM monthly_fee_tracking mft
            JOIN students s ON mft.student_id = s.id
            WHERE mft.year = ? AND mft.month = ?
        `;
        const params = [year, month];

        if (status) {
            sql += ' AND mft.status = ?';
            params.push(status);
        }
        if (department) {
            sql += ' AND LOWER(TRIM(s.department)) = LOWER(TRIM(?))';
            params.push(department);
        }
        if (course) {
            sql += ' AND s.course LIKE ?';
            params.push(`%${course}%`);
        }
        if (search) {
            sql += ' AND (LOWER(s.name) LIKE ? OR LOWER(s.id) LIKE ?)';
            const wildcard = `%${search.toLowerCase().trim()}%`;
            params.push(wildcard, wildcard);
        }

        const summary = await queryOne(sql, params);
        return res.json(summary);
    } catch (err) {
        console.error('Error in getCurrentMonthStatus:', err);
        return res.status(500).json({ error: err.message });
    }
}

/**
 * Gets admin dashboard alerts regarding monthly fees
 */
export async function getAdminAlerts(req, res) {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;

        // Count defaulters (unpaid or partial)
        const counts = await queryOne(`
            SELECT 
                COUNT(*) as total_defaulters,
                COALESCE(SUM(balance), 0) as total_pending
            FROM monthly_fee_tracking
            WHERE year = ? AND month = ? AND status != 'Paid'
        `, [year, month]);

        // Department breakdown
        const deptBreakdown = await query(`
            SELECT 
                s.department, 
                COUNT(*) as count, 
                COALESCE(SUM(mft.balance), 0) as total_balance 
            FROM monthly_fee_tracking mft
            JOIN students s ON mft.student_id = s.id
            WHERE mft.year = ? AND mft.month = ? AND mft.status != 'Paid'
            GROUP BY s.department
        `, [year, month]);

        return res.json({
            defaulterCount: counts?.total_defaulters || 0,
            totalPending: counts?.total_pending || 0,
            departmentBreakdown: deptBreakdown || []
        });
    } catch (err) {
        console.error('Error in getAdminAlerts:', err);
        return res.status(500).json({ error: err.message });
    }
}

/**
 * Gets monthly tracking list for all students with filter support
 */
export async function getAllMonthlyTracking(req, res) {
    try {
        const now = new Date();
        const year = req.query.year ? parseInt(req.query.year, 10) : now.getFullYear();
        const month = req.query.month ? parseInt(req.query.month, 10) : (now.getMonth() + 1);
        const { status, department, course, search } = req.query;

        // Auto-init to make sure current records are generated
        await autoInitializeCurrentMonth(year, month);

        let sql = `
            SELECT 
                mft.*,
                s.name as student_name,
                s.course as student_course,
                s.department as student_department,
                s.intake as student_intake
            FROM monthly_fee_tracking mft
            JOIN students s ON mft.student_id = s.id
            WHERE mft.year = ? AND mft.month = ?
        `;
        const params = [year, month];

        if (status) {
            sql += ' AND mft.status = ?';
            params.push(status);
        }
        if (department) {
            sql += ' AND LOWER(TRIM(s.department)) = LOWER(TRIM(?))';
            params.push(department);
        }
        if (course) {
            sql += ' AND s.course LIKE ?';
            params.push(`%${course}%`);
        }
        if (search) {
            sql += ' AND (LOWER(s.name) LIKE ? OR LOWER(s.id) LIKE ?)';
            const wildcard = `%${search.toLowerCase().trim()}%`;
            params.push(wildcard, wildcard);
        }

        sql += ' ORDER BY s.name ASC';

        const records = await query(sql, params);
        const formattedRecords = records.map(r => ({
            ...r,
            student_course: parseCourse(r.student_course)
        }));
        return res.json(formattedRecords);
    } catch (err) {
        console.error('Error in getAllMonthlyTracking:', err);
        return res.status(500).json({ error: err.message });
    }
}

/**
 * Gets monthly records for a specific student (IDOR protected)
 */
export async function getStudentMonthlyTracking(req, res) {
    try {
        const { sid } = req.params;
        const currentRole = String(req.user.role || '').toLowerCase().trim();
        const userEmail = req.user.email;

        // If student, verify ownership
        if (currentRole === 'student') {
            const student = await queryOne('SELECT id FROM students WHERE email = ?', [userEmail]);
            if (!student || student.id !== sid) {
                return res.status(403).json({ error: 'Access denied: You can only view your own records' });
            }
        }

        const records = await query(`
            SELECT mft.*, s.name as student_name, s.course as student_course, s.department as student_department
            FROM monthly_fee_tracking mft
            JOIN students s ON mft.student_id = s.id
            WHERE mft.student_id = ?
            ORDER BY mft.year DESC, mft.month DESC
        `, [sid]);

        const formattedRecords = records.map(r => ({
            ...r,
            student_course: parseCourse(r.student_course)
        }));
        return res.json(formattedRecords);
    } catch (err) {
        console.error('Error in getStudentMonthlyTracking:', err);
        return res.status(500).json({ error: err.message });
    }
}

/**
 * Records a payment for a monthly tracking block
 */
export async function recordMonthlyPayment(req, res) {
    try {
        const { student_id, amount, method, transaction_ref, year, month, payment_date, remarks } = req.body;

        if (!student_id || !amount || !method || !year || !month) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const numericAmount = parseFloat(amount);
        const recordedBy = (req.user && (req.user.name || req.user.email)) || 'System';

        // 1. Record in overall payments ledger
        await run(`
            INSERT INTO payments 
            (student_id, amount, method, transaction_ref, recorded_by, category, payment_date, remarks, status)
            VALUES (?, ?, ?, ?, ?, 'Tuition Fee', ?, ?, 'Completed')
        `, [
            student_id, 
            numericAmount, 
            method, 
            transaction_ref || `TX-${Date.now()}`, 
            recordedBy, 
            payment_date || new Date().toISOString(),
            remarks || `Monthly tuition payment for ${month}/${year}`
        ]);

        // 2. Fetch the corresponding monthly tracking block
        let tracking = await queryOne(
            'SELECT * FROM monthly_fee_tracking WHERE student_id = ? AND year = ? AND month = ?',
            [student_id, year, month]
        );

        if (!tracking) {
            // Auto init just this student/month if missing
            await autoInitializeCurrentMonth(year, month);
            tracking = await queryOne(
                'SELECT * FROM monthly_fee_tracking WHERE student_id = ? AND year = ? AND month = ?',
                [student_id, year, month]
            );
        }

        if (tracking) {
            const amountPaid = parseFloat(tracking.amount_paid || 0) + numericAmount;
            const balance = Math.max(0, parseFloat(tracking.amount_due || 0) - amountPaid);
            let status = 'Not Paid';
            if (balance <= 0 && parseFloat(tracking.amount_due || 0) > 0) {
                status = 'Paid';
            } else if (amountPaid > 0) {
                status = 'Partial';
            }

            await run(`
                UPDATE monthly_fee_tracking 
                SET amount_paid = ?, balance = ?, status = ?, paid_date = ?, updated_at = CURRENT_TIMESTAMP
                WHERE student_id = ? AND year = ? AND month = ?
            `, [amountPaid, balance, status, payment_date || new Date().toISOString(), student_id, year, month]);
        }

        // 3. Sync the overall student fee summary ledger
        await syncStudentFees(student_id);

        return res.json({ message: 'Monthly payment recorded and synced successfully' });
    } catch (err) {
        console.error('Error in recordMonthlyPayment:', err);
        return res.status(500).json({ error: err.message });
    }
}

/**
 * Gets report data
 */
export async function getMonthlyReport(req, res) {
    try {
        const now = new Date();
        const year = req.query.year ? parseInt(req.query.year, 10) : now.getFullYear();
        const month = req.query.month ? parseInt(req.query.month, 10) : (now.getMonth() + 1);
        const { status, department, course, intake } = req.query;

        let sql = `
            SELECT 
                mft.*,
                s.name as student_name,
                s.course as student_course,
                s.department as student_department,
                s.intake as student_intake
            FROM monthly_fee_tracking mft
            JOIN students s ON mft.student_id = s.id
            WHERE mft.year = ? AND mft.month = ?
        `;
        const params = [year, month];

        if (status) {
            sql += ' AND mft.status = ?';
            params.push(status);
        }
        if (department) {
            sql += ' AND LOWER(TRIM(s.department)) = LOWER(TRIM(?))';
            params.push(department);
        }
        if (course) {
            sql += ' AND s.course LIKE ?';
            params.push(`%${course}%`);
        }
        if (intake) {
            sql += ' AND LOWER(TRIM(s.intake)) = LOWER(TRIM(?))';
            params.push(intake);
        }

        sql += ' ORDER BY s.name ASC';

        const records = await query(sql, params);
        const formattedRecords = records.map(r => ({
            ...r,
            student_course: parseCourse(r.student_course)
        }));

        // Calculate summary metrics
        let totalDue = 0;
        let totalPaid = 0;
        let totalPending = 0;
        let paidCount = 0;
        let partialCount = 0;
        let unpaidCount = 0;

        for (const rec of formattedRecords) {
            totalDue += parseFloat(rec.amount_due || 0);
            totalPaid += parseFloat(rec.amount_paid || 0);
            totalPending += parseFloat(rec.balance || 0);
            
            if (rec.status === 'Paid') paidCount++;
            else if (rec.status === 'Partial') partialCount++;
            else unpaidCount++;
        }

        return res.json({
            summary: {
                total_students: formattedRecords.length,
                paid_count: paidCount,
                unpaid_count: unpaidCount,
                partial_count: partialCount,
                total_due: totalDue,
                total_paid: totalPaid,
                total_pending: totalPending
            },
            records: formattedRecords
        });
    } catch (err) {
        console.error('Error in getMonthlyReport:', err);
        return res.status(500).json({ error: err.message });
    }
}

/**
 * Exports report in PDF or Excel formats
 */
export async function exportReport(req, res) {
    try {
        const now = new Date();
        const year = req.query.year ? parseInt(req.query.year, 10) : now.getFullYear();
        const month = req.query.month ? parseInt(req.query.month, 10) : (now.getMonth() + 1);
        const { status, department, course, intake, format } = req.query;

        const monthsNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const monthLabel = `${monthsNames[month - 1]} ${year}`;

        // Get matching records
        let sql = `
            SELECT 
                mft.*,
                s.name as student_name,
                s.course as student_course,
                s.department as student_department,
                s.intake as student_intake
            FROM monthly_fee_tracking mft
            JOIN students s ON mft.student_id = s.id
            WHERE mft.year = ? AND mft.month = ?
        `;
        const params = [year, month];

        if (status) {
            sql += ' AND mft.status = ?';
            params.push(status);
        }
        if (department) {
            sql += ' AND LOWER(TRIM(s.department)) = LOWER(TRIM(?))';
            params.push(department);
        }
        if (course) {
            sql += ' AND s.course LIKE ?';
            params.push(`%${course}%`);
        }
        if (intake) {
            sql += ' AND LOWER(TRIM(s.intake)) = LOWER(TRIM(?))';
            params.push(intake);
        }

        sql += ' ORDER BY s.name ASC';
        const rawRecords = await query(sql, params);
        const records = rawRecords.map(r => ({
            ...r,
            student_course: parseCourse(r.student_course)
        }));

        if (format === 'excel') {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Monthly Fee Tracking');

            // Set up worksheet title
            worksheet.mergeCells('A1:H1');
            worksheet.getCell('A1').value = 'BEAUTEX TECHNICAL COLLEGE';
            worksheet.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getCell('A1').fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1E3A8A' } // Deep Blue
            };
            worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center' };

            worksheet.mergeCells('A2:H2');
            worksheet.getCell('A2').value = `Monthly Fee Tracking Report - ${monthLabel}`;
            worksheet.getCell('A2').font = { size: 12, bold: true };
            worksheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center' };

            // Add table headers
            const headers = ['Student ID', 'Student Name', 'Department', 'Course', 'Intake', 'Amount Due (KSh)', 'Amount Paid (KSh)', 'Balance (KSh)', 'Status'];
            worksheet.addRow([]);
            const headerRow = worksheet.addRow(headers);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.eachCell(cell => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF3B82F6' } // Blue Accent
                };
                cell.alignment = { horizontal: 'center' };
            });

            let totalDue = 0;
            let totalPaid = 0;
            let totalPending = 0;

            // Add records
            for (const rec of records) {
                totalDue += parseFloat(rec.amount_due || 0);
                totalPaid += parseFloat(rec.amount_paid || 0);
                totalPending += parseFloat(rec.balance || 0);

                const row = worksheet.addRow([
                    rec.student_id,
                    rec.student_name,
                    rec.student_department || 'N/A',
                    rec.student_course || 'N/A',
                    rec.student_intake || 'N/A',
                    parseFloat(rec.amount_due || 0),
                    parseFloat(rec.amount_paid || 0),
                    parseFloat(rec.balance || 0),
                    rec.status
                ]);

                // Format number columns
                row.getCell(6).numFmt = '#,##0.00';
                row.getCell(7).numFmt = '#,##0.00';
                row.getCell(8).numFmt = '#,##0.00';

                // Format status colors
                const statusCell = row.getCell(9);
                statusCell.alignment = { horizontal: 'center' };
                if (rec.status === 'Paid') {
                    statusCell.font = { color: { argb: 'FF047857' }, bold: true }; // Green
                } else if (rec.status === 'Partial') {
                    statusCell.font = { color: { argb: 'FFD97706' }, bold: true }; // Orange
                } else {
                    statusCell.font = { color: { argb: 'FFDC2626' }, bold: true }; // Red
                }
            }

            // Summary row
            worksheet.addRow([]);
            const sumRow = worksheet.addRow([
                'TOTALS', '', '', '', '',
                totalDue,
                totalPaid,
                totalPending,
                ''
            ]);
            sumRow.font = { bold: true };
            sumRow.getCell(6).numFmt = '#,##0.00';
            sumRow.getCell(7).numFmt = '#,##0.00';
            sumRow.getCell(8).numFmt = '#,##0.00';

            worksheet.getColumn(1).width = 15;
            worksheet.getColumn(2).width = 25;
            worksheet.getColumn(3).width = 18;
            worksheet.getColumn(4).width = 25;
            worksheet.getColumn(5).width = 15;
            worksheet.getColumn(6).width = 18;
            worksheet.getColumn(7).width = 18;
            worksheet.getColumn(8).width = 18;
            worksheet.getColumn(9).width = 15;

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=monthly_fee_report_${month}_${year}.xlsx`);

            await workbook.xlsx.write(res);
            res.end();
        } else {
            // PDF generation using pdfkit-table
            const doc = new PDFTable({ margin: 30, size: 'A4' });
            
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=monthly_fee_report_${month}_${year}.pdf`);
            
            doc.pipe(res);

            // Document Header
            doc.fontSize(18).fillColor('#1E3A8A').text('BEAUTEX TECHNICAL COLLEGE', { align: 'center', bold: true });
            doc.fontSize(10).fillColor('#4B5563').text('Monthly Fee Tracking & Financial Status Report', { align: 'center' });
            doc.fontSize(12).fillColor('#1F2937').text(`Period: ${monthLabel}`, { align: 'center', bold: true });
            doc.moveDown(1.5);

            // Summary Info Block
            let sumDue = 0;
            let sumPaid = 0;
            let sumPending = 0;
            let countPaid = 0;
            let countPartial = 0;
            let countUnpaid = 0;

            const tableRows = [];
            for (const rec of records) {
                const due = parseFloat(rec.amount_due || 0);
                const paid = parseFloat(rec.amount_paid || 0);
                const bal = parseFloat(rec.balance || 0);

                sumDue += due;
                sumPaid += paid;
                sumPending += bal;

                if (rec.status === 'Paid') countPaid++;
                else if (rec.status === 'Partial') countPartial++;
                else countUnpaid++;

                tableRows.push([
                    rec.student_id,
                    rec.student_name,
                    rec.student_course || 'N/A',
                    due.toLocaleString(),
                    paid.toLocaleString(),
                    bal.toLocaleString(),
                    rec.status
                ]);
            }

            // Quick Stats Block
            doc.fontSize(10).fillColor('#111827');
            doc.text(`Total Students: ${records.length}   |   Paid: ${countPaid}   |   Partial: ${countPartial}   |   Unpaid: ${countUnpaid}`, { align: 'left' });
            doc.text(`Total Monthly Due: KSh ${sumDue.toLocaleString()}   |   Total Paid: KSh ${sumPaid.toLocaleString()}   |   Total Balance: KSh ${sumPending.toLocaleString()}`, { align: 'left' });
            doc.moveDown(1);

            // Build PDF Table
            const table = {
                title: "Student Payment Details",
                headers: ["Student ID", "Student Name", "Course", "Amount Due", "Amount Paid", "Balance", "Status"],
                rows: tableRows
            };

            await doc.table(table, {
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8).fillColor('#FFFFFF'),
                prepareRow: (row, i) => doc.font("Helvetica").fontSize(8).fillColor('#1F2937'),
                columnsSize: [60, 110, 110, 60, 60, 60, 50]
            });

            doc.end();
        }
    } catch (err) {
        console.error('Error in exportReport:', err);
        if (!res.headersSent) {
            return res.status(500).json({ error: err.message });
        }
    }
}
