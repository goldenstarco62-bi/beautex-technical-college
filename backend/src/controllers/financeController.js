import { query, queryOne, run, getProcessedDatabaseUrl, getCurrentDateSQL, getDateIntervalSQL, getActiveDbEngine } from '../config/database.js';
import notificationService from '../services/notificationService.js';


const isMongo = () => !!process.env.MONGODB_URI;

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

            const payments = await Payment.find({ student_id: studentId });
            const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

            let lastPaymentDate = null;
            if (payments.length > 0) {
                const dates = payments.map(p => new Date(p.payment_date)).filter(d => !isNaN(d));
                if (dates.length > 0) lastPaymentDate = new Date(Math.max(...dates));
            }

            let fee = await StudentFee.findOne({ student_id: studentId });

            // If no fee summary exists, try to initialize it
            if (!fee) {
                const student = await Student.findOne({ id: studentId });
                let totalDue = 0;
                if (student?.course) {
                    const primaryCourseName = Array.isArray(student.course) ? student.course[0] : student.course;
                    const courseObj = await Course.findOne({ name: { $regex: new RegExp(`^${primaryCourseName}$`, 'i') } });
                    if (courseObj) {
                        const structure = await FeeStructure.findOne({ course_id: courseObj._id, category: 'Tuition Fee' });
                        if (structure) totalDue = structure.amount;
                    }
                }
                fee = new StudentFee({ student_id: studentId, total_due: totalDue });
            }

            const balance = fee.total_due - totalPaid;
            const status = (balance <= 0 && fee.total_due > 0) ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Pending');

            await StudentFee.findOneAndUpdate(
                { student_id: studentId },
                { total_paid: totalPaid, balance, status, last_payment_date: lastPaymentDate },
                { upsert: true, new: true }
            );
        } else {
            // SQL Path
            const paidRow = await queryOne(
                'SELECT COALESCE(SUM(amount), 0) as total_paid, MAX(payment_date) as last_date FROM payments WHERE student_id = ?',
                [studentId]
            );
            const totalPaid = Number(paidRow?.total_paid || 0);
            const lastDate = paidRow?.last_date;

            let fee = await queryOne('SELECT * FROM student_fees WHERE student_id = ?', [studentId]);

            // If no fee summary exists, try to initialize it
            if (!fee) {
                const student = await queryOne('SELECT course FROM students WHERE id = ?', [studentId]);
                let totalDue = 0;
                if (student?.course) {
                    const courseObj = await queryOne('SELECT id FROM courses WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [student.course]);
                    if (courseObj) {
                        const structure = await queryOne("SELECT amount FROM fee_structures WHERE course_id = ? AND category = 'Tuition Fee'", [courseObj.id]);
                        if (structure) totalDue = Number(structure.amount);
                    }
                }
                await run('INSERT INTO student_fees (student_id, total_due, total_paid, balance, status) VALUES (?, ?, ?, ?, ?)', [studentId, totalDue, 0, totalDue, 'Pending']);
                fee = { student_id: studentId, total_due: totalDue };
            }

            const balance = fee.total_due - totalPaid;
            const status = (balance <= 0 && fee.total_due > 0) ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Pending');

            await run(
                'UPDATE student_fees SET total_paid = ?, balance = ?, status = ?, last_payment_date = ? WHERE student_id = ?',
                [totalPaid, balance, status, lastDate, studentId]
            );
        }
    } catch (err) {
        console.error(`âŒ Sync failed for student ${studentId}:`, err);
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
        res.status(500).json({ error: error.message });
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
        res.status(500).json({ error: error.message });
    }
}

// Student Fees Summary
export async function getStudentFees(req, res) {
    try {
        const { studentId } = req.params;

        // IDOR Protection: Students can only view their own fees
        if (req.user.role === 'student' && String(req.user.student_id) !== String(studentId)) {
            return res.status(403).json({ error: 'Access denied. You can only view your own fee records.' });
        }

        if (isMongo()) {
            const StudentFee = (await import('../models/mongo/StudentFee.js')).default;
            const Student = (await import('../models/mongo/Student.js')).default;
            const FeeStructure = (await import('../models/mongo/FeeStructure.js')).default;
            const Course = (await import('../models/mongo/Course.js')).default;
            const Payment = (await import('../models/mongo/Payment.js')).default;

            let fee = await StudentFee.findOne({ student_id: studentId });

            if (!fee) {
                // Auto-calculate from payments + fee structures
                const student = await Student.findOne({ id: studentId });
                let totalDue = 0;

                if (student?.course) {
                    const primaryCourseName = Array.isArray(student.course) ? student.course[0] : student.course;
                    const courseObj = await Course.findOne({ name: { $regex: new RegExp(`^${primaryCourseName}$`, 'i') } });
                    if (courseObj) {
                        const structure = await FeeStructure.findOne({ course_id: courseObj._id, category: 'Tuition Fee' });
                        if (structure) totalDue = structure.amount;
                    }
                }

                const payments = await Payment.find({ student_id: studentId });
                const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                const balance = totalDue - totalPaid;
                const status = balance <= 0 && totalDue > 0 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Pending');

                // Upsert so future calls return quickly
                fee = await StudentFee.findOneAndUpdate(
                    { student_id: studentId },
                    { total_due: totalDue, total_paid: totalPaid, balance, status },
                    { upsert: true, new: true }
                );
            }

            return res.json(fee);
        }

        // --- SQL path (SQLite / PostgreSQL) ---
        let fee = await queryOne('SELECT * FROM student_fees WHERE student_id = ?', [studentId]);

        if (!fee) {
            // Auto-calculate from payments + fee structures
            const student = await queryOne('SELECT course FROM students WHERE id = ?', [studentId]);
            let totalDue = 0;

            if (student?.course) {
                const courseObj = await queryOne(
                    'SELECT id FROM courses WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))',
                    [student.course]
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
                [studentId]
            );
            const totalPaid = Number(paidRow?.total_paid || 0);
            const balance = totalDue - totalPaid;
            const status = balance <= 0 && totalDue > 0 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Pending');

            // Insert the auto-calculated row so subsequent requests are fast
            await run(
                'INSERT INTO student_fees (student_id, total_due, total_paid, balance, status) VALUES (?, ?, ?, ?, ?)',
                [studentId, totalDue, totalPaid, balance, status]
            );

            fee = { student_id: studentId, total_due: totalDue, total_paid: totalPaid, balance, status };
        }

        res.json(fee);
    } catch (error) {
        res.status(500).json({ error: error.message });
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
            JOIN students s ON sf.student_id = s.id
        `);
        res.json(fees);
    } catch (error) {
        res.status(500).json({ error: error.message });
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

            console.log(`ðŸ”„ Syncing ledger for ${allStudents.length} students...`);

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

                const balance = totalDue - totalPaid;
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
        console.log('ðŸ”„ Syncing SQL Ledger...');

        // 1. Ensure all students have a row in student_fees
        await run(`
            INSERT INTO student_fees (student_id, total_due, total_paid, balance, status)
            SELECT id, 0, 0, 0, 'Pending' 
            FROM students 
            WHERE id NOT IN (SELECT student_id FROM student_fees)
        `);

        // 2. Fetch data for auto-assignment
        console.log('ðŸ”„ Fetching course and fee structure data...');
        const [structures, allCourses] = await Promise.all([
            query('SELECT * FROM fee_structures WHERE category = ?', ['Tuition Fee']),
            query('SELECT * FROM courses')
        ]);
        console.log(`â„¹ï¸ Found ${structures.length} fee structures and ${allCourses.length} courses.`);

        // 3. Find students with 0 total_due and attempt auto-assignment
        const missingFees = await query(`
            SELECT sf.student_id, s.course as course_name 
            FROM student_fees sf
            JOIN students s ON sf.student_id = s.id 
            WHERE sf.total_due <= 0
        `);

        for (const f of missingFees) {
            if (!f.course_name) continue;

            const courseObj = allCourses.find(c => String(c.name).toLowerCase().trim() === String(f.course_name).toLowerCase().trim());
            if (courseObj) {
                const matchedStructure = structures.find(s => String(s.course_id).toLowerCase().trim() === String(courseObj.id).toLowerCase().trim());
                if (matchedStructure) {
                    await run('UPDATE student_fees SET total_due = ? WHERE student_id = ?', [matchedStructure.amount, f.student_id]);
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
            SET balance = total_due - total_paid
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
        console.error('âŒ Sync Failed:', error);
        res.status(500).json({ error: error.message });
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
        const recorded_by = req.user.name || req.user.email;

        if (isMongo()) {
            const Payment = (await import('../models/mongo/Payment.js')).default;
            const StudentFee = (await import('../models/mongo/StudentFee.js')).default;

            const newPayment = new Payment({
                student_id, amount, method, transaction_ref, recorded_by,
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
                    { student_id },
                    { 
                        total_due: due, 
                        total_paid: paid, 
                        balance: bal, 
                        status: bal <= 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Pending'),
                        last_payment_date: new Date() 
                    },
                    { upsert: true }
                );
            } else {
                // Standard mode: sync from payments source
                await internalSyncStudentFee(student_id);
            }
            
            return res.status(201).json({ message: 'Payment recorded successfully' });
        }

        // SQLite / PG path
        await run(
            'INSERT INTO payments (student_id, amount, method, transaction_ref, recorded_by, category, semester, academic_year, remarks, payment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [student_id, amount, method, transaction_ref, recorded_by, category, semester, academic_year, remarks, payment_date || new Date()]
        );

        // If manual overrides are provided
        if (manual_total_due !== undefined && manual_total_due !== '') {
            const finalTotalDue = parseFloat(manual_total_due);
            const finalTotalPaid = (manual_total_paid !== undefined && manual_total_paid !== '') ? parseFloat(manual_total_paid) : 0;
            const finalBalance = (manual_balance !== undefined && manual_balance !== '') ? parseFloat(manual_balance) : (finalTotalDue - finalTotalPaid);
            const newStatus = (finalBalance <= 0 && finalTotalDue > 0) ? 'Paid' : (finalTotalPaid > 0 ? 'Partial' : 'Pending');

            const existing = await queryOne('SELECT student_id FROM student_fees WHERE student_id = ?', [student_id]);
            if (existing) {
                await run(
                    'UPDATE student_fees SET total_due = ?, total_paid = ?, balance = ?, status = ?, last_payment_date = CURRENT_TIMESTAMP WHERE student_id = ?',
                    [finalTotalDue, finalTotalPaid, finalBalance, newStatus, student_id]
                );
            } else {
                await run(
                    'INSERT INTO student_fees (student_id, total_due, total_paid, balance, status, last_payment_date) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [student_id, finalTotalDue, finalTotalPaid, finalBalance, newStatus]
                );
            }
        } else {
            // Standard synchronization
            await internalSyncStudentFee(student_id);
        }

        // --- Notify Student ---
        notificationService.notifyStudent(
            student_id,
            'Payment Received',
            `A payment of KSh ${amount} has been successfully recorded to your account via ${method}.`,
            'success'
        );

        // --- Notify All Admins ---
        try {
            let admins = [];
            if (isMongo()) {
                const User = (await import('../models/mongo/User.js')).default;
                admins = await User.find({ role: { $in: ['admin', 'superadmin'] } }).select('_id');
            } else {
                admins = await query("SELECT id FROM users WHERE role IN ('admin', 'superadmin')");
            }
            
            for (const admin of admins) {
                notificationService.notifyUser(
                    String(admin._id || admin.id),
                    'New Payment Recorded',
                    `A payment of KSh ${amount} for Student ${student_id} was recorded by ${recorded_by}.`,
                    'info'
                );
            }
        } catch (adminNotifyErr) {
            console.error('Failed to notify admins of payment:', adminNotifyErr);
        }

        res.status(201).json({ message: 'Payment recorded successfully' });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function getPayments(req, res) {
    try {
        const { studentId } = req.query;

        // IDOR Protection: Students can only view their own payments
        if (req.user.role === 'student') {
            const effectiveId = studentId || req.user.student_id;
            if (String(effectiveId) !== String(req.user.student_id)) {
                return res.status(403).json({ error: 'Access denied. You can only view your own payment records.' });
            }
        }

        if (isMongo()) {
            const Payment = (await import('../models/mongo/Payment.js')).default;
            const Student = (await import('../models/mongo/Student.js')).default;

            let query = {};
            if (studentId) query.student_id = studentId;

            const payments = await Payment.find(query).sort({ payment_date: -1 });

            const enriched = await Promise.all(payments.map(async (p) => {
                const obj = p.toObject();
                if (!studentId) {
                    const student = await Student.findOne({ id: obj.student_id }).select('name').catch(() => null);
                    obj.student_name = student?.name || 'Unknown Student';
                }
                return obj;
            }));

            return res.json(enriched);
        }

        let payments;
        if (studentId) {
            payments = await query('SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC', [studentId]);
        } else {
            payments = await query(`
                SELECT p.*, s.name as student_name 
                FROM payments p 
                JOIN students s ON p.student_id = s.id 
                ORDER BY payment_date DESC
            `);
        }
        res.json(payments);
    } catch (error) {
        res.status(500).json({ error: error.message });
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
            JOIN students s ON p.student_id = s.id 
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
        res.status(500).json({ error: error.message });
    }
}

/**
 * Handle M-Pesa Daraja Callback (Webhook)
 * This endpoint receives the transaction result from Safaricom.
 */
/**
 * Handle M-Pesa Daraja Callback (Webhook)
 */
export async function mpesaCallback(req, res) {
    try {
        // SECURITY: Basic verification of source (Header-based)
        // In production, this should check Safaricom's specific authentication headers or certificates.
        const authHeader = req.headers['x-mpesa-verification'];
        // For now, we allow it to proceed but log an audit trail if the header is missing
        if (!authHeader && process.env.NODE_ENV === 'production') {
            console.warn('âš ï¸ Untrusted M-Pesa Callback received (missing verification header)');
            // return res.status(401).end(); // Uncomment this when headers are configured in Safaricom Portal
        }

        const body = req.body.Body.stkCallback;
        console.log('ðŸ“± M-Pesa Callback Received:', JSON.stringify(body, null, 2));

        if (body.ResultCode === 0) {
            console.log('âœ… M-Pesa Transaction Successful!');
            const metadata = body.CallbackMetadata.Item;
            const amount = metadata.find(i => i.Name === 'Amount')?.Value;
            const receipt = metadata.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
            const phone = metadata.find(i => i.Name === 'PhoneNumber')?.Value;

            // Extract Student ID from the 'Remarks' or 'AccountReference' passed during STK initiation
            // In a real flow, this is usually retrieved via a CheckoutRequestID mapping.
            // For now, we attempt to find the student by phone number if ID is missing.

            const CheckoutRequestID = body.CheckoutRequestID;
            console.log(`ðŸ’µ Received KSh ${amount} from ${phone}. Receipt: ${receipt}, ID: ${CheckoutRequestID}`);

            // FIX: PERSIST TO DATABASE
            // 1. Find student by phone (Fallback) or specific metadata if you passed it
            const student = await queryOne('SELECT id, name FROM students WHERE TRIM(phone) LIKE ? OR contact LIKE ?', [`%${phone.slice(-9)}%`, `%${phone.slice(-9)}%`]);

            if (student) {
                const student_id = student.id;
                const recorded_by = 'M-Pesa Automation';

                // Record the Receipt (Source of Truth)
                await run(
                    'INSERT INTO payments (student_id, amount, method, transaction_ref, recorded_by, category, status, payment_date) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [student_id, amount, 'M-Pesa', receipt, recorded_by, 'Tuition Fee', 'Completed']
                );

                // Update the Summary Cache
                let fee = await queryOne('SELECT * FROM student_fees WHERE student_id = ?', [student_id]);
                if (fee) {
                    const newPaid = (Number(fee.total_paid) || 0) + Number(amount);
                    const newBalance = (Number(fee.total_due) || 0) - newPaid;
                    const newStatus = newBalance <= 0 ? 'Paid' : 'Partial';
                    await run(
                        'UPDATE student_fees SET total_paid = ?, balance = ?, status = ?, last_payment_date = CURRENT_TIMESTAMP WHERE student_id = ?',
                        [newPaid, newBalance, newStatus, student_id]
                    );
                } else {
                    // Create summary if missing
                    await run(
                        'INSERT INTO student_fees (student_id, total_due, total_paid, balance, status, last_payment_date) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                        [student_id, 0, amount, -amount, 'Partial']
                    );
                }
                console.log(`âœ… Ledger updated for ${student.name} (${student_id})`);
            } else {
                console.warn(`âš ï¸ Payment received but student with phone ${phone} not found in database.`);
                // We should still record the payment with an 'Unassigned' status for manual matching
                await run(
                    'INSERT INTO payments (student_id, amount, method, transaction_ref, recorded_by, category, status, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    ['PENDING_ASSIGNMENT', amount, 'M-Pesa', receipt, 'M-Pesa Automation', 'Tuition Fee', 'Completed', `From phone: ${phone}`]
                );
            }
        } else {
            console.warn(`âŒ M-Pesa Transaction Failed/Cancelled: ${body.ResultDesc}`);
        }

        res.status(200).json({ ResultCode: 0, ResultDesc: "Success" });
    } catch (error) {
        console.error('âŒ M-Pesa Callback Processing Error:', error.message);
        res.status(200).json({ ResultCode: 0, ResultDesc: "Success" });
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
        res.status(500).json({ error: error.message });
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
        res.status(500).json({ error: error.message });
    }
}

/**
 * Update a student fee summary record
 */
export async function updateStudentFee(req, res) {
    try {
        const { id } = req.params; // This will be the ID or student_id
        const { total_due, total_paid, balance, status } = req.body;

        if (isMongo()) {
            const StudentFee = (await import('../models/mongo/StudentFee.js')).default;
            const updated = await StudentFee.findOneAndUpdate(
                { student_id: id },
                { total_due, total_paid, balance: total_due - total_paid, status },
                { new: true, upsert: true }
            );
            return res.json({ message: 'Fee record synchronized successfully', data: updated });
        }

        const existing = await queryOne('SELECT student_id FROM student_fees WHERE student_id = ?', [id]);
        if (existing) {
            await run(
                'UPDATE student_fees SET total_due = ?, total_paid = ?, balance = ?, status = ? WHERE student_id = ?',
                [total_due, total_paid, total_due - total_paid, status, id]
            );
        } else {
            await run(
                'INSERT INTO student_fees (student_id, total_due, total_paid, balance, status) VALUES (?, ?, ?, ?, ?)',
                [id, total_due, total_paid, total_due - total_paid, status]
            );
        }
        res.json({ message: 'Fee record synchronized successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
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
        res.status(500).json({ error: error.message });
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
        res.status(500).json({ error: error.message });
    }
}
