import { query, queryOne, run, getProcessedDatabaseUrl } from '../config/database.js';

const isMongo = () => !!process.env.MONGODB_URI;

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
            const fee = await StudentFee.findOne({ student_id: studentId });
            if (!fee) return res.status(404).json({ error: 'Fee record not found' });
            return res.json(fee);
        }

        const fee = await queryOne('SELECT * FROM student_fees WHERE student_id = ?', [studentId]);
        if (!fee) return res.status(404).json({ error: 'Fee record not found' });
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

            console.log(`🔄 Syncing ledger for ${allStudents.length} students...`);

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
        console.log('🔄 Syncing SQL Ledger...');

        // 1. Ensure all students have a row in student_fees
        await run(`
            INSERT INTO student_fees (student_id, total_due, total_paid, balance, status)
            SELECT id, 0, 0, 0, 'Pending' 
            FROM students 
            WHERE id NOT IN (SELECT student_id FROM student_fees)
        `);

        // 2. Fetch data for auto-assignment
        console.log('🔄 Fetching course and fee structure data...');
        const [structures, allCourses] = await Promise.all([
            query('SELECT * FROM fee_structures WHERE category = ?', ['Tuition Fee']),
            query('SELECT * FROM courses')
        ]);
        console.log(`ℹ️ Found ${structures.length} fee structures and ${allCourses.length} courses.`);

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
        console.error('❌ Sync Failed:', error);
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

            const fee = await StudentFee.findOne({ student_id });
            const finalTotalDue = manual_total_due !== undefined && manual_total_due !== '' ? parseFloat(manual_total_due) : (fee?.total_due || 0);
            const finalTotalPaid = manual_total_paid !== undefined && manual_total_paid !== '' ? parseFloat(manual_total_paid) : ((fee?.total_paid || 0) + parseFloat(amount));
            const finalBalance = manual_balance !== undefined && manual_balance !== '' ? parseFloat(manual_balance) : (finalTotalDue - finalTotalPaid);
            const newStatus = finalBalance <= 0 ? 'Paid' : 'Partial';

            if (fee) {
                await StudentFee.findOneAndUpdate(
                    { student_id },
                    { total_due: finalTotalDue, total_paid: finalTotalPaid, balance: finalBalance, status: newStatus, last_payment_date: new Date() }
                );
            } else {
                await new StudentFee({ student_id, total_due: finalTotalDue, total_paid: finalTotalPaid, balance: finalBalance, status: newStatus, last_payment_date: new Date() }).save();
            }
            return res.status(201).json({ message: 'Payment recorded successfully' });
        }

        // SQLite / PG path
        await run(
            'INSERT INTO payments (student_id, amount, method, transaction_ref, recorded_by, category, semester, academic_year, remarks, payment_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [student_id, amount, method, transaction_ref, recorded_by, category, semester, academic_year, remarks, payment_date || new Date()]
        );

        let fee = await queryOne('SELECT * FROM student_fees WHERE student_id = ?', [student_id]);

        // If fee record doesn't exist, try to find course and structure to auto-assign total_due
        let initialDue = fee?.total_due || 0;
        if (!fee) {
            const student = await queryOne('SELECT course FROM students WHERE id = ?', [student_id]);
            if (student?.course) {
                const courseObj = await queryOne('SELECT id FROM courses WHERE LOWER(name) = ?', [student.course.toLowerCase().trim()]);
                if (courseObj) {
                    const structure = await queryOne('SELECT amount FROM fee_structures WHERE course_id = ? AND category = ?', [courseObj.id, 'Tuition Fee']);
                    if (structure) initialDue = structure.amount;
                }
            }
        }

        const finalTotalDue = (manual_total_due !== undefined && manual_total_due !== '') ? parseFloat(manual_total_due) : initialDue;
        const finalTotalPaid = (manual_total_paid !== undefined && manual_total_paid !== '') ? parseFloat(manual_total_paid) : ((fee?.total_paid || 0) + parseFloat(amount));
        const finalBalance = (manual_balance !== undefined && manual_balance !== '') ? parseFloat(manual_balance) : (finalTotalDue - finalTotalPaid);
        const newStatus = (finalBalance <= 0 && finalTotalDue > 0) ? 'Paid' : (finalTotalPaid > 0 ? 'Partial' : 'Pending');

        if (fee) {
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
        const isPostgres = getProcessedDatabaseUrl()?.startsWith('postgres');
        const thisMonthStart = isPostgres
            ? "date_trunc('month', CURRENT_DATE)"
            : "date('now', 'start of month')";
        const lastMonthStart = isPostgres
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
export async function mpesaCallback(req, res) {
    try {
        const body = req.body.Body.stkCallback;
        console.log('📱 M-Pesa Callback Received:', JSON.stringify(body, null, 2));

        if (body.ResultCode === 0) {
            console.log('✅ M-Pesa Transaction Successful!');
            const metadata = body.CallbackMetadata.Item;
            const amount = metadata.find(i => i.Name === 'Amount')?.Value;
            const receipt = metadata.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
            const phone = metadata.find(i => i.Name === 'PhoneNumber')?.Value;
            console.log(`💵 Received KSh ${amount} from ${phone}. Receipt: ${receipt}`);
        } else {
            console.warn(`❌ M-Pesa Transaction Failed/Cancelled: ${body.ResultDesc}`);
        }

        // Always acknowledge to Safaricom to avoid retries
        res.status(200).json({ ResultCode: 0, ResultDesc: "Success" });
    } catch (error) {
        console.error('❌ M-Pesa Callback Processing Error:', error.message);
        res.status(200).json({ ResultCode: 0, ResultDesc: "Success" }); // Still return OK to avoid Safaricom retry spam
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
            const StudentFee = (await import('../models/mongo/StudentFee.js')).default;

            const updated = await Payment.findByIdAndUpdate(id, {
                amount, method, transaction_ref, category, semester, academic_year, remarks, payment_date
            }, { new: true });

            if (!updated) return res.status(404).json({ error: 'Payment record not found' });

            // Sync summary
            const allPayments = await Payment.find({ student_id: updated.student_id });
            const totalPaid = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const fee = await StudentFee.findOne({ student_id: updated.student_id });
            if (fee) {
                const balance = fee.total_due - totalPaid;
                const status = balance <= 0 && fee.total_due > 0 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Pending');
                await StudentFee.findOneAndUpdate(
                    { student_id: updated.student_id },
                    { total_paid: totalPaid, balance, status }
                );
            }

            return res.json({ message: 'Payment updated successfully', data: updated });
        }

        // --- SQL Path ---
        const oldPayment = await queryOne('SELECT student_id FROM payments WHERE id = ?', [id]);
        if (!oldPayment) return res.status(404).json({ error: 'Payment record not found' });

        await run(
            'UPDATE payments SET amount = ?, method = ?, transaction_ref = ?, category = ?, semester = ?, academic_year = ?, remarks = ?, payment_date = ? WHERE id = ?',
            [amount, method, transaction_ref, category, semester, academic_year, remarks, payment_date || new Date(), id]
        );

        // Sync local summary
        await run(`
            UPDATE student_fees 
            SET total_paid = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE student_id = ?),
                balance = total_due - (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE student_id = ?)
            WHERE student_id = ?
        `, [oldPayment.student_id, oldPayment.student_id, oldPayment.student_id]);

        await run(`
            UPDATE student_fees 
            SET status = CASE 
                WHEN balance <= 0 AND total_due > 0 THEN 'Paid'
                WHEN total_paid > 0 THEN 'Partial'
                ELSE 'Pending'
            END
            WHERE student_id = ?
        `, [oldPayment.student_id]);

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
            const StudentFee = (await import('../models/mongo/StudentFee.js')).default;

            const payment = await Payment.findById(id);
            if (!payment) return res.status(404).json({ error: 'Payment not found' });

            const studentId = payment.student_id;
            await Payment.findByIdAndDelete(id);

            // Recalculate summary
            const allPayments = await Payment.find({ student_id: studentId });
            const totalPaid = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const fee = await StudentFee.findOne({ student_id: studentId });
            if (fee) {
                const balance = fee.total_due - totalPaid;
                const status = balance <= 0 && fee.total_due > 0 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Pending');
                await StudentFee.findOneAndUpdate(
                    { student_id: studentId },
                    { total_paid: totalPaid, balance, status }
                );
            }

            return res.json({ message: 'Payment deleted' });
        }

        // --- SQL Path ---
        const payment = await queryOne('SELECT student_id FROM payments WHERE id = ?', [id]);
        if (!payment) return res.status(404).json({ error: 'Payment not found' });

        const studentId = payment.student_id;
        await run('DELETE FROM payments WHERE id = ?', [id]);

        // Sync summary
        await run(`
            UPDATE student_fees 
            SET total_paid = (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE student_id = ?),
                balance = total_due - (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE student_id = ?)
            WHERE student_id = ?
        `, [studentId, studentId, studentId]);

        await run(`
            UPDATE student_fees 
            SET status = CASE 
                WHEN balance <= 0 AND total_due > 0 THEN 'Paid'
                WHEN total_paid > 0 THEN 'Partial'
                ELSE 'Pending'
            END
            WHERE student_id = ?
        `, [studentId]);

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
