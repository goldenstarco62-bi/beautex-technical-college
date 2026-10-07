import { query, queryOne, run, withTransaction, getProcessedDatabaseUrl, getCurrentDateSQL, getDateIntervalSQL, getActiveDbEngine } from '../config/database.js';
import notificationService from '../services/notificationService.js';
import { syncStudentMonthlyFeeTracking } from './monthlyFeeController.js';
import crypto from 'crypto';
import logger from '../utils/logger.js';


const isMongo = () => !!process.env.MONGODB_URI;

/**
 * Length-safe, constant-time string comparison to prevent timing attacks
 * when verifying the M-Pesa webhook shared secret.
 */
function safeEqual(a, b) {
    const bufA = Buffer.from(String(a ?? ''));
    const bufB = Buffer.from(String(b ?? ''));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

/** Escape regex metacharacters before interpolating user input into a RegExp. */
function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Safely parses student course JSON arrays or strings into a clean single course name.
 */
function getPrimaryCourseName(courseVal) {
    if (!courseVal) return '';
    if (typeof courseVal !== 'string') {
        if (Array.isArray(courseVal)) return courseVal[0] || '';
        return String(courseVal);
    }
    const trimmed = courseVal.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed[0] || '';
            return String(parsed);
        } catch (e) {
            // ignore JSON parse error, treat as plain string
        }
    }
    const split = trimmed.split(',');
    return split[0] ? split[0].trim() : '';
}

/**
 * Centrally recalculates and updates a student's fee summary based on their payment history.
 * This is the source of truth for all financial status updates.
 */
async function internalSyncStudentFee(studentId) {
    try {
        if (isMongo()) {
            const Payment = (await import('../models/mongo/Payment.js')).default;
            const StudentFee = (await import('../models/mongo/StudentFee.js')).default;
            const Student = (await import('../models/mongo/Student.js')).default;
            const FeeStructure = (await import('../models/mongo/FeeStructure.js')).default;
            const Course = (await import('../models/mongo/Course.js')).default;

            const student = await Student.findOne({ id: { $regex: new RegExp(`^${escapeRegExp(String(studentId).trim())}$`, 'i') } });
            const canonicalId = student ? student.id : studentId;

            const payments = await Payment.find({ student_id: { $regex: new RegExp(`^${escapeRegExp(String(canonicalId).trim())}$`, 'i') } });
            const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            let lastPaymentDate = null;
            if (payments.length > 0) {
                const dates = payments.map(p => new Date(p.payment_date)).filter(d => !isNaN(d));
                if (dates.length > 0) lastPaymentDate = new Date(Math.max(...dates));
            }

            let fee = await StudentFee.findOne({ student_id: canonicalId });

            // If no fee summary exists, try to initialize it
            if (!fee) {
                let totalDue = 0;
                if (student?.course) {
                    const primaryCourseName = getPrimaryCourseName(student.course);
                    const courseObj = await Course.findOne({ name: { $regex: new RegExp(`^${escapeRegExp(primaryCourseName)}$`, 'i') } });
                    if (courseObj) {
                        const structure = await FeeStructure.findOne({ course_id: courseObj._id, category: 'Tuition Fee' });
                        if (structure) totalDue = structure.amount;
                    }
                }
                fee = new StudentFee({ student_id: canonicalId, total_due: totalDue });
            }

            const balance = Math.max(0, fee.total_due - totalPaid);
            const status = (balance <= 0 && fee.total_due > 0) ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Pending');

            await StudentFee.findOneAndUpdate(
                { student_id: canonicalId },
                { total_paid: totalPaid, balance, status, last_payment_date: lastPaymentDate },
                { upsert: true, new: true }
            );
        } else {
            // SQL Path
            const student = await queryOne('SELECT id, course FROM students WHERE LOWER(TRIM(id)) = LOWER(TRIM(?))', [studentId]);
            const canonicalId = student ? student.id : studentId;

            const paidRow = await queryOne(
                'SELECT COALESCE(SUM(amount), 0) as total_paid, MAX(payment_date) as last_date FROM payments WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))',
                [canonicalId]
            );
            const totalPaid = parseFloat(paidRow?.total_paid || 0);
            const lastDate = paidRow?.last_date;

            let fee = await queryOne('SELECT * FROM student_fees WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))', [canonicalId]);

            // If no fee summary exists, try to initialize it from fee structures
            if (!fee) {
                let totalDue = 0;
                if (student?.course) {
                    const primaryCourseName = getPrimaryCourseName(student.course);
                    const courseObj = await queryOne('SELECT id FROM courses WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [primaryCourseName]);
                    if (courseObj) {
                        const structure = await queryOne("SELECT amount FROM fee_structures WHERE course_id = ? AND category = 'Tuition Fee'", [courseObj.id]);
                        if (structure) totalDue = Number(structure.amount);
                    }
                }
                const initBalance = Math.max(0, totalDue - totalPaid);
                const initStatus = (initBalance <= 0 && totalDue > 0) ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Pending');
                await run('INSERT INTO student_fees (student_id, total_due, total_paid, balance, status) VALUES (?, ?, ?, ?, ?)', [canonicalId, totalDue, totalPaid, initBalance, initStatus]);
                return; // Already fully synced on insert
            }

            // Preserve existing total_due — only recalculate paid and balance
            // If no fee amount has been set (total_due = 0), do NOT create a negative balance.
            // The admin should set total_due first via 'Adjust Totals' mode.
            const existingTotalDue = Number(fee.total_due || 0);
            const balance = existingTotalDue > 0 ? Math.max(0, (existingTotalDue - totalPaid)) : 0;
            const status = (balance <= 0 && existingTotalDue > 0) ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Pending');

            await run(
                'UPDATE student_fees SET total_paid = ?, balance = ?, status = ?, last_payment_date = ? WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))',
                [totalPaid, balance, status, lastDate, canonicalId]
            );
        }
    } catch (err) {
        console.error(`❌ Sync failed for student ${studentId}:`, err);
    }
}

// Fee Structures
export async function getFeeStructures(req, res) {
    try {
        if (isMongo()) {
            const FeeStructure = (await import('../models/mongo/FeeStructure.js')).default;
            const Course = (await import('../models/mongo/Course.js')).default;
            const fees = await FeeStructure.find();

            const enriched = await Promise.all(fees.map(async (f) => {
                const obj = f.toObject();
                // Match course name
                const course = await Course.findById(obj.course_id).select('name').catch(() => null);
                obj.course_name = course?.name || 'Unknown Course';
                return obj;
            }));

            return res.json(enriched);
        }
        const fees = await query('SELECT fs.*, c.name as course_name FROM fee_structures fs JOIN courses c ON fs.course_id = c.id');
        res.json(fees);
    } catch (error) {
        logger.error({ err: error }, 'getFeeStructures: unhandled error');
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function createFeeStructure(req, res) {
    try {
        const { course_id, amount, category, semester } = req.body;
        if (isMongo()) {
            const FeeStructure = (await import('../models/mongo/FeeStructure.js')).default;
            const newFee = new FeeStructure({ course_id, amount, category, semester });
            await newFee.save();
            return res.status(201).json({ message: 'Fee structure created' });
        }
        await run(
            'INSERT INTO fee_structures (course_id, amount, category, semester) VALUES (?, ?, ?, ?)',
            [course_id, amount, category, semester]
        );
        res.status(201).json({ message: 'Fee structure created' });
    } catch (error) {
        logger.error({ err: error }, 'createFeeStructure: unhandled error');
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Student Fees Summary
export async function getStudentFees(req, res) {
    try {
        const { studentId } = req.params;
        const role = String(req.user.role || '').toLowerCase().trim();

        // IDOR protection: fee records are finance-admin data.
        //  - admin/superadmin: any student
        //  - student: strictly their own record, scoped from the TOKEN (an unlinked
        //    account with a null student_id is denied instead of matching "null")
        //  - any other role (e.g. teacher): denied
        if (role === 'student') {
            const ownId = req.user.student_id ? String(req.user.student_id).trim() : null;
            if (!ownId || ownId.toLowerCase() !== String(studentId).trim().toLowerCase()) {
                return res.status(403).json({ error: 'Access denied. You can only view your own fee records.' });
            }
        } else if (role !== 'admin' && role !== 'superadmin') {
            return res.status(403).json({ error: 'Access denied. Fee records are restricted to finance administrators.' });
        }

        if (isMongo()) {
            const StudentFee = (await import('../models/mongo/StudentFee.js')).default;
            const Student = (await import('../models/mongo/Student.js')).default;
            const FeeStructure = (await import('../models/mongo/FeeStructure.js')).default;
            const Course = (await import('../models/mongo/Course.js')).default;
            const Payment = (await import('../models/mongo/Payment.js')).default;

            const student = await Student.findOne({ id: { $regex: new RegExp(`^${escapeRegExp(String(studentId).trim())}$`, 'i') } });
            const canonicalId = student ? student.id : studentId;

            let fee = await StudentFee.findOne({ student_id: canonicalId });

            if (!fee) {
                // Auto-calculate from payments + fee structures
                let totalDue = 0;

                if (student?.course) {
                    const primaryCourseName = getPrimaryCourseName(student.course);
                    const courseObj = await Course.findOne({ name: { $regex: new RegExp(`^${escapeRegExp(primaryCourseName)}$`, 'i') } });
                    if (courseObj) {
                        const structure = await FeeStructure.findOne({ course_id: courseObj._id, category: 'Tuition Fee' });
                        if (structure) totalDue = structure.amount;
                    }
                }

                const payments = await Payment.find({ student_id: { $regex: new RegExp(`^${escapeRegExp(String(canonicalId).trim())}$`, 'i') } });
                const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                const balance = Math.max(0, totalDue - totalPaid);
                const status = balance <= 0 && totalDue > 0 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Pending');

                // Upsert so future calls return quickly
                fee = await StudentFee.findOneAndUpdate(
                    { student_id: canonicalId },
                    { total_due: totalDue, total_paid: totalPaid, balance, status },
                    { upsert: true, new: true }
                );
            }

            return res.json(fee);
        }

        // --- SQL path (SQLite / PostgreSQL) ---
        const student = await queryOne('SELECT id, course FROM students WHERE LOWER(TRIM(id)) = LOWER(TRIM(?))', [studentId]);
        const canonicalId = student ? student.id : studentId;

        let fee = await queryOne('SELECT * FROM student_fees WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))', [canonicalId]);

        if (!fee) {
            // Auto-calculate from payments + fee structures
            let totalDue = 0;

            if (student?.course) {
                const primaryCourseName = getPrimaryCourseName(student.course);
                const courseObj = await queryOne(
                    'SELECT id FROM courses WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))',
                    [primaryCourseName]
                );
                if (courseObj) {
                    const structure = await queryOne(
                        "SELECT amount FROM fee_structures WHERE LOWER(TRIM(course_id)) = LOWER(TRIM(?)) AND category = 'Tuition Fee'",
                        [courseObj.id]
                    );
                    if (structure) totalDue = Number(structure.amount);
                }
            }

            const paidRow = await queryOne(
                'SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))',
                [canonicalId]
            );
            const totalPaid = parseFloat(paidRow?.total_paid || 0);
            const balance = Math.max(0, totalDue - totalPaid);
            const status = balance <= 0 && totalDue > 0 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Pending');

            // Insert the auto-calculated row so subsequent requests are fast
            await run(
                'INSERT INTO student_fees (student_id, total_due, total_paid, balance, status) VALUES (?, ?, ?, ?, ?)',
                [canonicalId, totalDue, totalPaid, balance, status]
            );

            fee = { student_id: canonicalId, total_due: totalDue, total_paid: totalPaid, balance, status };
        }

        res.json(fee);
    } catch (error) {
        logger.error({ err: error }, 'getStudentFees: unhandled error');
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function getAllStudentFees(req, res) {
    try {
        if (isMongo()) {
            const StudentFee = (await import('../models/mongo/StudentFee.js')).default;
            const Student = (await import('../models/mongo/Student.js')).default;
            const fees = await StudentFee.find();

            const enriched = await Promise.all(fees.map(async (f) => {
                const obj = f.toObject();
                const student = await Student.findOne({ id: obj.student_id }).select('name course').catch(() => null);
                obj.student_name = student?.name || 'Unknown Student';
                obj.course = student?.course || '';
                return obj;
            }));

            return res.json(enriched);
        }
        const fees = await query(`
            SELECT sf.*, s.name as student_name, s.course 
            FROM student_fees sf 
            JOIN students s ON LOWER(TRIM(sf.student_id)) = LOWER(TRIM(s.id))
        `);
        res.json(fees);
    } catch (error) {
        logger.error({ err: error }, 'getAllStudentFees: unhandled error');
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Payments
/**
 * Synchronize the entire financial ledger
 * Recalculates total_paid and balance for all students based on actual payments
 */
export async function syncAllFees(req, res) {
    try {
        if (isMongo()) {
            const Payment = (await import('../models/mongo/Payment.js')).default;
            const StudentFee = (await import('../models/mongo/StudentFee.js')).default;
            const Student = (await import('../models/mongo/Student.js')).default;
            const FeeStructure = (await import('../models/mongo/FeeStructure.js')).default;
            const Course = (await import('../models/mongo/Course.js')).default;

            const allStudents = await Student.find();
            const allPayments = await Payment.find();
            const allStructures = await FeeStructure.find();
            const allCourses = await Course.find();

            console.log(`[finance] Syncing ledger for ${allStudents.length} students...`);

            for (const student of allStudents) {
                const sid = String(student.id || '').trim().toLowerCase();
                if (!sid) continue;

                // Calculate total paid from all verified payment records (Case-insensitive match)
                const studentPayments = allPayments.filter(p =>
                    String(p.student_id || '').trim().toLowerCase() === sid
                );

                const totalPaid = studentPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

                // Get most recent payment date
                let lastPaymentDate = null;
                if (studentPayments.length > 0) {
                    const dates = studentPayments.map(p => new Date(p.payment_date)).filter(d => !isNaN(d));
                    if (dates.length > 0) {
                        lastPaymentDate = new Date(Math.max(...dates));
                    }
                }

                let fee = await StudentFee.findOne({ student_id: student.id });
                let totalDue = fee?.total_due || 0;

                // Attempt to initialize total_due if it's 0 and we have course info
                if (totalDue <= 0 && student.course) {
                    const primaryCourseName = Array.isArray(student.course) ? student.course[0] : student.course;
                    if (primaryCourseName) {
                        const courseObj = allCourses.find(c => String(c.name).toLowerCase().trim() === String(primaryCourseName).toLowerCase().trim());
                        if (courseObj) {
                            const matchedStructure = allStructures.find(s =>
                                String(s.course_id).toLowerCase().trim() === String(courseObj._id || courseObj.id).toLowerCase().trim() &&
                                s.category === 'Tuition Fee'
                            );
                            if (matchedStructure) totalDue = matchedStructure.amount;
                        }
                    }
                }

                const balance = Math.max(0, totalDue - totalPaid);
                const status = balance <= 0 && totalDue > 0 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Pending');

                await StudentFee.findOneAndUpdate(
                    { student_id: student.id },
                    {
                        total_due: totalDue,
                        total_paid: totalPaid,
                        balance,
                        status,
                        last_payment_date: lastPaymentDate
                    },
                    { upsert: true }
                );
            }
            return res.json({ message: 'Ledger synchronized' });
        }

        // --- SQL Path (SQLite / PostgreSQL) ---
        console.log('[finance] Syncing SQL Ledger...');

        // 1. Ensure all students have a row in student_fees
        await run(`
            INSERT INTO student_fees (student_id, total_due, total_paid, balance, status)
            SELECT id, 0, 0, 0, 'Pending' 
            FROM students 
            WHERE LOWER(TRIM(id)) NOT IN (SELECT LOWER(TRIM(student_id)) FROM student_fees)
        `);

        // 2. Fetch data for auto-assignment
        console.log('[finance] Fetching course and fee structure data...');
        const [structures, allCourses] = await Promise.all([
            query('SELECT * FROM fee_structures WHERE category = ?', ['Tuition Fee']),
            query('SELECT * FROM courses')
        ]);
        console.log(`[finance] Found ${structures.length} fee structures and ${allCourses.length} courses.`);

        // 3. Find students with 0 total_due and attempt auto-assignment
        const missingFees = await query(`
            SELECT sf.student_id, s.course as course_name 
            FROM student_fees sf
            JOIN students s ON LOWER(TRIM(sf.student_id)) = LOWER(TRIM(s.id)) 
            WHERE sf.total_due <= 0
        `);

        for (const f of missingFees) {
            if (!f.course_name) continue;

            const primaryCourse = getPrimaryCourseName(f.course_name);
            const courseObj = allCourses.find(c => String(c.name).toLowerCase().trim() === String(primaryCourse).toLowerCase().trim());
            if (courseObj) {
                const matchedStructure = structures.find(s => String(s.course_id).toLowerCase().trim() === String(courseObj.id).toLowerCase().trim());
                if (matchedStructure) {
                    await run('UPDATE student_fees SET total_due = ? WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))', [matchedStructure.amount, f.student_id]);
                    await syncStudentMonthlyFeeTracking(f.student_id, matchedStructure.amount);
                }
            }
        }


        // 4. Perform a multi-stage update to sync totals, status, and dates 
        // Using LOWER() and TRIM() to ensure robust ID matching across different DB engines
        await run(`
            UPDATE student_fees 
            SET total_paid = (
                    SELECT COALESCE(SUM(amount), 0) 
                    FROM payments 
                    WHERE LOWER(TRIM(payments.student_id)) = LOWER(TRIM(student_fees.student_id))
                ),
                last_payment_date = (
                    SELECT MAX(payment_date) 
                    FROM payments 
                    WHERE LOWER(TRIM(payments.student_id)) = LOWER(TRIM(student_fees.student_id))
                )
        `);

        await run(`
            UPDATE student_fees 
            SET balance = CASE WHEN total_due - total_paid < 0 THEN 0 ELSE total_due - total_paid END
        `);

        await run(`
            UPDATE student_fees 
            SET status = CASE 
                WHEN balance <= 0 AND total_due > 0 THEN 'Paid'
                WHEN total_paid > 0 THEN 'Partial'
                ELSE 'Pending'
            END
        `);

        res.json({ message: 'Ledger synchronized successfully' });
    } catch (error) {
        console.error('[finance] Sync Failed:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
export async function recordPayment(req, res) {
    try {
        const {
            student_id, amount, method, transaction_ref,
            category, semester, academic_year, remarks,
            manual_total_due, manual_total_paid, manual_balance,
            payment_date
        } = req.body;

        console.log(`[finance] Recording payment for ${student_id}: KSh ${amount} via ${method}`);

        const recorded_by = (req.user && (req.user.name || req.user.email)) || 'System';

        if (isMongo()) {
            const Payment = (await import('../models/mongo/Payment.js')).default;
            const StudentFee = (await import('../models/mongo/StudentFee.js')).default;
            const Student = (await import('../models/mongo/Student.js')).default;

            const student = await Student.findOne({ id: { $regex: new RegExp(`^${escapeRegExp(String(student_id).trim())}$`, 'i') } });
            const canonicalId = student ? student.id : student_id;

            const newPayment = new Payment({
                student_id: canonicalId, amount, method, transaction_ref, recorded_by,
                category, semester, academic_year, remarks,
                payment_date: payment_date || new Date()
            });
            await newPayment.save();

            // If manual overrides are provided (Ledger Adjustment mode), apply them
            if (manual_total_due !== undefined && manual_total_due !== '') {
                const due = parseFloat(manual_total_due);
                const paid = manual_total_paid !== undefined && manual_total_paid !== '' ? parseFloat(manual_total_paid) : (due - (parseFloat(manual_balance) || 0));
                const bal = manual_balance !== undefined && manual_balance !== '' ? parseFloat(manual_balance) : (due - paid);
                
                await StudentFee.findOneAndUpdate(
                    { student_id: canonicalId },
                    { 
                        total_due: due, 
                        total_paid: paid, 
                        balance: bal, 
                        status: bal <= 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Pending'),
                        last_payment_date: payment_date || new Date() 
                    },
                    { upsert: true }
                );
            } else {
                // Incremental update: add new payment amount to existing total_paid.
                // Preserves any manual adjustments set via Adjust Totals.
                const feeDoc = await StudentFee.findOne({ student_id: canonicalId });
                if (feeDoc) {
                    const existingDue = parseFloat(feeDoc.total_due || 0);
                    const newTotalPaid = parseFloat(feeDoc.total_paid || 0) + parseFloat(amount);
                    const newBalance = existingDue > 0 ? Math.max(0, existingDue - newTotalPaid) : 0;
                    const newStatus = (newBalance <= 0 && existingDue > 0) ? 'Paid' : (newTotalPaid > 0 ? 'Partial' : 'Pending');
                    await StudentFee.findOneAndUpdate(
                        { student_id: canonicalId },
                        { total_paid: newTotalPaid, balance: newBalance, status: newStatus, last_payment_date: payment_date || new Date() },
                        { upsert: true }
                    );
                } else {
                    // No fee row yet — fall back to full sync to initialize
                    await internalSyncStudentFee(canonicalId);
                }
            }
            
            // --- Notify Student ---
            await notificationService.notifyStudent(
                canonicalId,
                'Payment Received',
                `A payment of KSh ${amount} has been successfully recorded to your account via ${method}.`,
                'success'
            );

            // --- Notify All Admins ---
            try {
                const User = (await import('../models/mongo/User.js')).default;
                const admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id');
                for (const admin of admins) {
                    notificationService.notifyUser(
                        String(admin._id),
                        'New Payment Recorded',
                        `A payment of KSh ${amount} for Student ${canonicalId} was recorded by ${recorded_by}.`,
                        'info'
                    );
                }
            } catch (adminNotifyErr) {
                console.error('Failed to notify admins of payment:', adminNotifyErr);
            }

            return res.status(201).json({ message: 'Payment recorded successfully' });
        }

        // SQLite / PG path wrapped in database transaction for atomicity
        let canonicalId = student_id;
        await withTransaction(async () => {
            const student = await queryOne('SELECT id FROM students WHERE LOWER(TRIM(id)) = LOWER(TRIM(?))', [student_id]);
            canonicalId = student ? student.id : student_id;

            await run(
                'INSERT INTO payments (student_id, amount, method, transaction_ref, recorded_by, category, semester, academic_year, remarks, payment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [canonicalId, amount, method, transaction_ref, recorded_by, category, semester, academic_year, remarks, payment_date || new Date().toISOString()]
            );

            // If manual overrides are provided
            if (manual_total_due !== undefined && manual_total_due !== '') {
                const finalTotalDue = parseFloat(manual_total_due);
                const finalTotalPaid = (manual_total_paid !== undefined && manual_total_paid !== '') ? parseFloat(manual_total_paid) : 0;
                const finalBalance = (manual_balance !== undefined && manual_balance !== '') ? parseFloat(manual_balance) : (finalTotalDue - finalTotalPaid);
                const newStatus = (finalBalance <= 0 && finalTotalDue > 0) ? 'Paid' : (finalTotalPaid > 0 ? 'Partial' : 'Pending');

                const existing = await queryOne('SELECT student_id FROM student_fees WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))', [canonicalId]);
                if (existing) {
                    await run(
                        'UPDATE student_fees SET total_due = ?, total_paid = ?, balance = ?, status = ?, last_payment_date = ? WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))',
                        [finalTotalDue, finalTotalPaid, finalBalance, newStatus, payment_date || new Date().toISOString(), canonicalId]
                    );
                } else {
                    await run(
                        'INSERT INTO student_fees (student_id, total_due, total_paid, balance, status, last_payment_date) VALUES (?, ?, ?, ?, ?, ?)',
                        [canonicalId, finalTotalDue, finalTotalPaid, finalBalance, newStatus, payment_date || new Date()]
                    );
                }
                if (!isMongo()) {
                    await syncStudentMonthlyFeeTracking(canonicalId, finalTotalDue);
                }
            } else {
                // Incremental update: add the new payment amount to the existing total_paid.
                const feeRow = await queryOne(
                    'SELECT total_due, total_paid FROM student_fees WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))',
                    [canonicalId]
                );
                if (feeRow) {
                    const existingDue = parseFloat(feeRow.total_due || 0);
                    const newTotalPaid = parseFloat(feeRow.total_paid || 0) + parseFloat(amount);
                    const newBalance = existingDue > 0 ? Math.max(0, existingDue - newTotalPaid) : 0;
                    const newStatus = (newBalance <= 0 && existingDue > 0) ? 'Paid' : (newTotalPaid > 0 ? 'Partial' : 'Pending');
                    await run(
                        'UPDATE student_fees SET total_paid = ?, balance = ?, status = ?, last_payment_date = ? WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))',
                        [newTotalPaid, newBalance, newStatus, payment_date || new Date().toISOString(), canonicalId]
                    );
                    if (!isMongo()) {
                        await syncStudentMonthlyFeeTracking(canonicalId, existingDue);
                    }
                } else {
                    // No student_fees row yet — fall back to full sync to initialize it
                    await internalSyncStudentFee(canonicalId);
                }
            }
        });

        // --- Notify Student ---
        await notificationService.notifyStudent(
            canonicalId,
            'Payment Received',
            `A payment of KSh ${amount} has been successfully recorded to your account via ${method}.`,
            'success'
        );

        // --- Notify All Admins ---
        try {
            const admins = await query("SELECT id FROM users WHERE role IN ('admin', 'superadmin')");
            for (const admin of admins) {
                notificationService.notifyUser(
                    String(admin.id),
                    'New Payment Recorded',
                    `A payment of KSh ${amount} for Student ${canonicalId} was recorded by ${recorded_by}.`,
                    'info'
                );
            }
        } catch (adminNotifyErr) {
            console.error('Failed to notify admins of payment:', adminNotifyErr);
        }

        res.status(201).json({ message: 'Payment recorded successfully' });

    } catch (error) {
        const isDuplicateRef = error.message && (
            error.message.includes('UNIQUE constraint failed') ||
            error.message.includes('duplicate key') ||
            error.message.includes('unique violation')
        );
        if (isDuplicateRef) {
            return res.status(409).json({ error: 'A payment with this transaction reference already exists. Please use a unique transaction reference.' });
        }
        logger.error({ err: error }, 'recordPayment: unhandled error');
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function getPayments(req, res) {
    try {
        const role = String(req.user.role || '').toLowerCase().trim();
        const studentIdParam = req.query.studentId ? String(req.query.studentId).trim() : null;
        const limit = req.query.limit ? parseInt(req.query.limit) : null;

        // IDOR protection: the full payments ledger is finance-admin data.
        //  - admin/superadmin: full list, optional studentId filter
        //  - student: strictly their own records, scoped from the TOKEN (never the query)
        //  - any other role (e.g. teacher): denied
        let effectiveId = studentIdParam;
        if (role === 'student') {
            const ownId = req.user.student_id ? String(req.user.student_id).trim() : null;
            if (studentIdParam && ownId && studentIdParam.toLowerCase() !== ownId.toLowerCase()) {
                return res.status(403).json({ error: 'Access denied. You can only view your own payment records.' });
            }
            if (!ownId) {
                // Account not linked to a student record — must never fall through to the full list.
                return res.json([]);
            }
            effectiveId = ownId;
        } else if (role !== 'admin' && role !== 'superadmin') {
            return res.status(403).json({ error: 'Access denied. Payment records are restricted to finance administrators.' });
        }

        if (isMongo()) {
            const Payment = (await import('../models/mongo/Payment.js')).default;
            const Student = (await import('../models/mongo/Student.js')).default;

            let paymentQuery = {};
            if (effectiveId) {
                paymentQuery.student_id = { $regex: new RegExp(`^${escapeRegExp(effectiveId.trim())}$`, 'i') };
            }

            let q = Payment.find(paymentQuery).sort({ payment_date: -1 });
            if (limit) q = q.limit(limit);
            const payments = await q;

            const enriched = await Promise.all(payments.map(async (p) => {
                const obj = p.toObject();
                if (!effectiveId) {
                    const sid = String(obj.student_id || '').trim();
                    const student = sid
                        ? await Student.findOne({ id: { $regex: new RegExp(`^${escapeRegExp(sid)}$`, 'i') } }).select('name').catch(() => null)
                        : null;
                    obj.student_name = student?.name || 'Unknown Student';
                }
                return obj;
            }));

            return res.json(enriched);
        }

        let payments;
        if (effectiveId) {
            let sql = 'SELECT * FROM payments WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?)) ORDER BY payment_date DESC';
            const params = [effectiveId];
            if (limit) {
                sql += ' LIMIT ?';
                params.push(limit);
            }
            payments = await query(sql, params);
        } else {
            let sql = `
                SELECT p.*, s.name as student_name 
                FROM payments p 
                JOIN students s ON LOWER(TRIM(p.student_id)) = LOWER(TRIM(s.id)) 
                ORDER BY payment_date DESC
            `;
            const params = [];
            if (limit) {
                sql += ' LIMIT ?';
                params.push(limit);
            }
            payments = await query(sql, params);
        }
        res.json(payments);
    } catch (error) {
        logger.error({ err: error }, 'getPayments: unhandled error');
        res.status(500).json({ error: 'Internal server error' });
    }
}

// Finance Analytics for SuperAdmin
export async function getFinanceAnalytics(req, res) {
    try {
        if (isMongo()) {
            const StudentFee = (await import('../models/mongo/StudentFee.js')).default;
            const Payment = (await import('../models/mongo/Payment.js')).default;
            const Student = (await import('../models/mongo/Student.js')).default;
            const FeeStructure = (await import('../models/mongo/FeeStructure.js')).default;

            // 1. Calculate Real Inflow (from Payments)
            const payments = await Payment.find();
            const total_revenue_collected = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

            // 2. Calculate Real Expected Revenue (from Student Headcount * Fee Structures)
            // We match by course name since students have names and fees have course_ids (joined via Course name)
            const feeStructures = await FeeStructure.find();
            const students = await Student.find({ status: 'Active' });

            let total_revenue_expected = 0;
            students.forEach(student => {
                // Find fees matching student's courses
                const studentCourses = Array.isArray(student.course) ? student.course : [student.course];
                studentCourses.forEach(courseName => {
                    const matchedFees = feeStructures.filter(f => f.category === 'Tuition Fee'); // Simplified to Tuition for global projection
                    // In a production app, we'd match courseName -> courseId -> feeStructure
                    // For now, let's sum student_fees.total_due as it's the official ledger
                });
            });

            // 2. Aggregate stats from student_fees
            const [ledgerStats, activeStudentCount] = await Promise.all([
                StudentFee.aggregate([
                    { $group: { _id: null, total_due: { $sum: "$total_due" }, total_paid: { $sum: "$total_paid" }, balance: { $sum: "$balance" } } }
                ]),
                Student.countDocuments({ status: { $ne: 'Graduated' } })
            ]);

            const stats = ledgerStats[0] || { total_due: 0, total_paid: 0, balance: 0 };
            const pendingAccounts = activeStudentCount;

            // 3. Calculate MoM Velocity
            const now = new Date();
            const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

            const thisMonthPayments = await Payment.find({ payment_date: { $gte: firstDayThisMonth } });
            const lastMonthPayments = await Payment.find({ payment_date: { $gte: firstDayLastMonth, $lt: firstDayThisMonth } });

            const thisMonthTotal = thisMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const lastMonthTotal = lastMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

            let velocity = 0;
            if (lastMonthTotal > 0) {
                velocity = ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
            } else if (thisMonthTotal > 0) {
                velocity = 100;
            }

            // 4. Recent Payments
            const recentPayments = await Payment.find().sort({ payment_date: -1 }).limit(6);
            const enrichedRecent = await Promise.all(recentPayments.map(async (p) => {
                const obj = p.toObject();
                const student = await Student.findOne({ id: obj.student_id }).select('name photo').catch(() => null);
                obj.student_name = student?.name || 'Unknown Student';
                obj.student_photo = student?.photo;
                return obj;
            }));

            return res.json({
                summary: {
                    total_revenue_expected: stats.total_due || 0,
                    total_revenue_collected: stats.total_paid || 0,
                    total_outstanding: stats.balance || 0,
                    pending_accounts: pendingAccounts,
                    velocity: velocity.toFixed(1)
                },
                recentPayments: enrichedRecent
            });
        }

        // --- SQL Path ---
        // Get aggregate stats from student_fees summary and student count from directory
        const [stats, activeCountRes] = await Promise.all([
            queryOne(`
                SELECT 
                    COALESCE(SUM(total_due), 0) as total_due, 
                    COALESCE(SUM(total_paid), 0) as total_paid, 
                    COALESCE(SUM(balance), 0) as balance 
                FROM student_fees
            `),
            queryOne("SELECT COUNT(*) as count FROM students WHERE status != 'Graduated'")
        ]);

        // Velocity SQL (Improved Cross-DB Compatibility)
        const engine = getActiveDbEngine();
        const thisMonthStart = engine === 'postgres'
            ? "date_trunc('month', CURRENT_DATE)"
            : "date('now', 'start of month')";
        const lastMonthStart = engine === 'postgres'
            ? "date_trunc('month', CURRENT_DATE - INTERVAL '1 month')"
            : "date('now', 'start of month', '-1 month')";

        const velocityRes = await queryOne(`
            SELECT 
                (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_date >= ${thisMonthStart}) as this_month,
                (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE payment_date >= ${lastMonthStart} AND payment_date < ${thisMonthStart}) as last_month
        `);

        const thisMonth = parseFloat(velocityRes?.this_month || 0);
        const lastMonth = parseFloat(velocityRes?.last_month || 0);
        const velocity = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth * 100) : (thisMonth > 0 ? 100 : 0);

        const recentPayments = await query(`
            SELECT p.*, s.name as student_name, s.photo as student_photo 
            FROM payments p 
            JOIN students s ON LOWER(TRIM(p.student_id)) = LOWER(TRIM(s.id)) 
            ORDER BY p.payment_date DESC LIMIT 6
        `);

        res.json({
            summary: {
                total_revenue_expected: parseFloat(stats?.total_due || 0),
                total_revenue_collected: parseFloat(stats?.total_paid || 0),
                total_outstanding: parseFloat(stats?.balance || 0),
                pending_accounts: parseInt(activeCountRes?.count || 0),
                velocity: velocity.toFixed(1)
            },
            recentPayments
        });
    } catch (error) {
        logger.error({ err: error }, 'getFinanceAnalytics: unhandled error');
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Handle M-Pesa Daraja Callback (Webhook).
 *
 * Security model (Safaricom does NOT sign the STK callback body):
 *  - Authenticate the caller with a shared secret token appended to the
 *    CallbackURL as a query param (?token=...) and compared in constant time.
 *  - Fail closed in production if the secret is not configured.
 *  - Idempotency: MpesaReceiptNumber maps to payments.transaction_ref (UNIQUE),
 *    so replays / concurrent duplicates never double-credit.
 *  - The fee ledger is updated in a single atomic statement (no lost updates).
 */
export async function mpesaCallback(req, res) {
    // ── 1. Authenticate the caller via shared secret ──────────────────────────
    const expectedToken = (process.env.MPESA_CALLBACK_TOKEN || '').trim();
    const providedToken = String(req.query?.token || req.headers['x-mpesa-verification'] || '').trim();

    if (!expectedToken) {
        if (process.env.NODE_ENV === 'production') {
            console.error('[mpesa] MPESA_CALLBACK_TOKEN is not configured — rejecting callback.');
            return res.status(503).json({ ResultCode: 1, ResultDesc: 'Webhook not configured' });
        }
        console.warn('[mpesa] MPESA_CALLBACK_TOKEN not set — skipping verification (non-production only).');
    } else if (!providedToken || !safeEqual(providedToken, expectedToken)) {
        console.warn(`[mpesa] Rejected untrusted callback (invalid/missing token) from ${req.ip}`);
        return res.status(401).json({ ResultCode: 1, ResultDesc: 'Unauthorized' });
    }

    try {
        // ── 2. Validate payload shape ─────────────────────────────────────────
        const body = req.body?.Body?.stkCallback;
        if (!body || typeof body !== 'object') {
            return res.status(400).json({ ResultCode: 1, ResultDesc: 'Malformed callback' });
        }

        // Failed/cancelled transactions carry no money — acknowledge and stop.
        if (body.ResultCode !== 0) {
            console.warn(`[mpesa] Transaction not successful (${body.ResultCode}): ${body.ResultDesc}`);
            return res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
        }

        const metadata = body.CallbackMetadata?.Item || [];
        const getMeta = (name) => metadata.find(i => i.Name === name)?.Value;
        const rawAmount = getMeta('Amount');
        const receipt = getMeta('MpesaReceiptNumber');
        const phone = getMeta('PhoneNumber');
        const amount = Number(rawAmount);

        // Receipt number is the idempotency key — refuse to auto-credit without it.
        if (!receipt) {
            console.error('[mpesa] Successful callback missing MpesaReceiptNumber — flagged for manual review.');
            return res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            console.error(`[mpesa] Invalid amount on receipt ${receipt}: ${rawAmount}`);
            return res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
        }

        // ── 3. Idempotency guard (transaction_ref is UNIQUE) ───────────────────
        const existing = await queryOne('SELECT id FROM payments WHERE transaction_ref = ?', [receipt]);
        if (existing) {
            console.log(`[mpesa] Duplicate callback for receipt ${receipt} — already processed. Skipping.`);
            return res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
        }

        console.log(`[mpesa] Processing KSh ${amount} from ${phone}. Receipt: ${receipt}`);

        // ── 4. Resolve student by phone (last 9 digits) ────────────────────────
        const phoneTail = phone ? String(phone).replace(/\D/g, '').slice(-9) : '';
        let student = null;
        if (phoneTail) {
            student = await queryOne(
                'SELECT id, name FROM students WHERE TRIM(phone) LIKE ? OR contact LIKE ?',
                [`%${phoneTail}%`, `%${phoneTail}%`]
            );
        }

        // ── 5. Record the payment (UNIQUE receipt = race-safe backstop) ────────
        try {
            if (student) {
                await run(
                    'INSERT INTO payments (student_id, amount, method, transaction_ref, recorded_by, category, status, payment_date) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [student.id, amount, 'M-Pesa', receipt, 'M-Pesa Automation', 'Tuition Fee', 'Completed']
                );
            } else {
                await run(
                    'INSERT INTO payments (student_id, amount, method, transaction_ref, recorded_by, category, status, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    ['PENDING_ASSIGNMENT', amount, 'M-Pesa', receipt, 'M-Pesa Automation', 'Tuition Fee', 'Completed', `From phone: ${phone || 'unknown'}`]
                );
            }
        } catch (insertErr) {
            // UNIQUE(transaction_ref) violation => a concurrent duplicate already recorded it.
            if (/unique|duplicate/i.test(insertErr.message || '')) {
                console.log(`[mpesa] Concurrent duplicate for receipt ${receipt} — skipping.`);
                return res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
            }
            throw insertErr;
        }

        // ── 6. Atomically update the fee ledger (single statement) ─────────────
        // All RHS references use the pre-update row values, so this is race-safe
        // and avoids the previous read-modify-write lost-update bug.
        if (student) {
            const upd = await run(
                `UPDATE student_fees
                 SET total_paid = COALESCE(total_paid, 0) + ?,
                     balance = CASE WHEN COALESCE(total_due,0) - (COALESCE(total_paid,0) + ?) < 0 THEN 0 ELSE COALESCE(total_due,0) - (COALESCE(total_paid,0) + ?) END,
                     status = CASE WHEN COALESCE(total_due,0) > 0 AND COALESCE(total_due,0) - (COALESCE(total_paid,0) + ?) <= 0 THEN 'Paid' ELSE 'Partial' END,
                     last_payment_date = CURRENT_TIMESTAMP
                 WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))`,
                [amount, amount, amount, amount, student.id]
            );
            if (!upd || upd.changes === 0) {
                await run(
                    'INSERT INTO student_fees (student_id, total_due, total_paid, balance, status, last_payment_date) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [student.id, 0, amount, 0, 'Partial']
                );
            }
            console.log(`[mpesa] Ledger updated for ${student.name} (${student.id})`);
        } else {
            console.warn(`[mpesa] Payment recorded as PENDING_ASSIGNMENT (no student matched phone ${phone}).`);
        }

        return res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
    } catch (error) {
        // Acknowledge to Safaricom to stop retry storms, but log loudly for review.
        console.error('[mpesa] Callback processing error:', error.message);
        return res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });
    }
}
/**
 * Update an existing payment record
 */
export async function updatePayment(req, res) {
    try {
        const { id } = req.params;
        const { amount, method, transaction_ref, category, semester, academic_year, remarks, payment_date } = req.body;

        if (isMongo()) {
            const Payment = (await import('../models/mongo/Payment.js')).default;
            const updated = await Payment.findByIdAndUpdate(id, {
                amount, method, transaction_ref, category, semester, academic_year, remarks, payment_date
            }, { new: true });

            if (!updated) return res.status(404).json({ error: 'Payment record not found' });

            // Sync from payments source
            await internalSyncStudentFee(updated.student_id);

            return res.json({ message: 'Payment updated successfully', data: updated });
        }

        // --- SQL Path ---
        const oldPayment = await queryOne('SELECT student_id FROM payments WHERE id = ?', [id]);
        if (!oldPayment) return res.status(404).json({ error: 'Payment record not found' });

        await run(
            'UPDATE payments SET amount = ?, method = ?, transaction_ref = ?, category = ?, semester = ?, academic_year = ?, remarks = ?, payment_date = ? WHERE id = ?',
            [amount, method, transaction_ref, category, semester, academic_year, remarks, payment_date || new Date(), id]
        );

        // Sync from payments source
        await internalSyncStudentFee(oldPayment.student_id);

        res.json({ message: 'Payment updated successfully' });
    } catch (error) {
        logger.error({ err: error }, 'updatePayment: unhandled error');
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Delete a payment record
 */
export async function deletePayment(req, res) {
    try {
        const { id } = req.params;

        if (isMongo()) {
            const Payment = (await import('../models/mongo/Payment.js')).default;
            const payment = await Payment.findById(id);
            if (!payment) return res.status(404).json({ error: 'Payment not found' });

            const studentId = payment.student_id;
            await Payment.findByIdAndDelete(id);

            // Recalculate summary from source
            await internalSyncStudentFee(studentId);

            return res.json({ message: 'Payment deleted' });
        }

        // --- SQL Path ---
        const payment = await queryOne('SELECT student_id FROM payments WHERE id = ?', [id]);
        if (!payment) return res.status(404).json({ error: 'Payment not found' });

        const studentId = payment.student_id;
        await run('DELETE FROM payments WHERE id = ?', [id]);

        // Sync summary from source
        await internalSyncStudentFee(studentId);

        res.json({ message: 'Payment deleted successfully' });
    } catch (error) {
        logger.error({ err: error }, 'deletePayment: unhandled error');
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Update a student fee summary record
 */
export async function updateStudentFee(req, res) {
    try {
        const { id } = req.params; // This will be the ID or student_id
        const { total_due, total_paid } = req.body;

        // Always recompute balance and status server-side to prevent client-supplied bad data
        const due = Number(total_due) || 0;
        const paid = Number(total_paid) || 0;
        const computedBalance = Math.max(0, due - paid);
        const computedStatus = computedBalance <= 0 && due > 0
            ? 'Paid'
            : (paid > 0 ? 'Partial' : 'Pending');

        if (isMongo()) {
            const StudentFee = (await import('../models/mongo/StudentFee.js')).default;
            const Student = (await import('../models/mongo/Student.js')).default;
            
            const student = await Student.findOne({ id: { $regex: new RegExp(`^${escapeRegExp(String(id).trim())}$`, 'i') } });
            const canonicalId = student ? student.id : id;

            // Directly update student_fees — no phantom ADJ payment entries created.
            // Admin's entered total_paid is stored as authoritative. Add Transaction payments
            // will increment this value going forward.
            const updated = await StudentFee.findOneAndUpdate(
                { student_id: canonicalId },
                { total_due: due, total_paid: paid, balance: computedBalance, status: computedStatus },
                { new: true, upsert: true }
            );
            return res.json({ message: 'Fee record synchronized successfully', data: updated });
        }

        const student = await queryOne('SELECT id FROM students WHERE LOWER(TRIM(id)) = LOWER(TRIM(?))', [id]);
        const canonicalId = student ? student.id : id;

        // Directly update student_fees without creating phantom ADJ payment entries.
        // The admin's entered total_paid is stored as the authoritative balance.
        // Subsequent "Add Transaction" payments will add to this value incrementally.
        const existing = await queryOne('SELECT student_id FROM student_fees WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))', [canonicalId]);
        if (existing) {
            await run(
                'UPDATE student_fees SET total_due = ?, total_paid = ?, balance = ?, status = ? WHERE LOWER(TRIM(student_id)) = LOWER(TRIM(?))',
                [due, paid, computedBalance, computedStatus, canonicalId]
            );
        } else {
            await run(
                'INSERT INTO student_fees (student_id, total_due, total_paid, balance, status) VALUES (?, ?, ?, ?, ?)',
                [canonicalId, due, paid, computedBalance, computedStatus]
            );
        }

        if (!isMongo()) {
            await syncStudentMonthlyFeeTracking(canonicalId, due);
        }
        res.json({ message: 'Fee record synchronized successfully' });
    } catch (error) {
        logger.error({ err: error }, 'updateStudentFee: unhandled error');
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Update a global fee structure template
 */
export async function updateFeeStructure(req, res) {
    try {
        const { id } = req.params;
        const { course_id, amount, category, semester } = req.body;

        if (isMongo()) {
            const FeeStructure = (await import('../models/mongo/FeeStructure.js')).default;
            const updated = await FeeStructure.findByIdAndUpdate(id, {
                course_id, amount, category, semester
            }, { new: true });
            if (!updated) return res.status(404).json({ error: 'Fee structure not found' });
            return res.json({ message: 'Fee structure updated successfully', data: updated });
        }

        await run(
            'UPDATE fee_structures SET course_id = ?, amount = ?, category = ?, semester = ? WHERE id = ?',
            [course_id, amount, category, semester, id]
        );
        res.json({ message: 'Fee structure updated successfully' });
    } catch (error) {
        logger.error({ err: error }, 'updateFeeStructure: unhandled error');
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Delete a global fee structure template
 */
export async function deleteFeeStructure(req, res) {
    try {
        const { id } = req.params;

        if (isMongo()) {
            const FeeStructure = (await import('../models/mongo/FeeStructure.js')).default;
            const deleted = await FeeStructure.findByIdAndDelete(id);
            if (!deleted) return res.status(404).json({ error: 'Fee structure not found' });
            return res.json({ message: 'Fee structure deleted' });
        }

        await run('DELETE FROM fee_structures WHERE id = ?', [id]);
        res.json({ message: 'Fee structure deleted successfully' });
    } catch (error) {
        logger.error({ err: error }, 'deleteFeeStructure: unhandled error');
        res.status(500).json({ error: 'Internal server error' });
    }
}
