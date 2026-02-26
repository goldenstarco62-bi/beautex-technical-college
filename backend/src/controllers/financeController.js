import { query, queryOne, run } from '../config/database.js';

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

            const allPayments = await Payment.find();
            const studentIds = [...new Set(allPayments.map(p => p.student_id))];
            const allStructures = await FeeStructure.find();
            const allCourses = await Course.find();

            for (const sid of studentIds) {
                const totalPaid = allPayments
                    .filter(p => p.student_id === sid)
                    .reduce((sum, p) => sum + (p.amount || 0), 0);

                const student = await Student.findOne({ id: sid }).catch(() => null);
                let fee = await StudentFee.findOne({ student_id: sid });

                let totalDue = fee?.total_due || 0;

                // Attempt to initialize total_due if it's 0 and we have course info
                if (totalDue <= 0 && student?.course?.length > 0) {
                    const primaryCourseName = Array.isArray(student.course) ? student.course[0] : student.course;
                    const courseObj = allCourses.find(c => c.name === primaryCourseName);
                    if (courseObj) {
                        const matchedStructure = allStructures.find(s => s.course_id === courseObj.id && s.category === 'Tuition Fee');
                        if (matchedStructure) totalDue = matchedStructure.amount;
                    }
                }

                const balance = totalDue - totalPaid;
                const status = balance <= 0 && totalDue > 0 ? 'Paid' : (totalPaid > 0 ? 'Partial' : 'Pending');

                await StudentFee.findOneAndUpdate(
                    { student_id: sid },
                    { total_due: totalDue, total_paid: totalPaid, balance, status, last_payment_date: new Date() },
                    { upsert: true }
                );
            }
            return res.json({ message: 'Ledger synchronized' });
        }

        // SQL Path: Complex update to sync everything
        await run(`
            UPDATE student_fees 
            SET total_paid = (SELECT IFNULL(SUM(amount), 0) FROM payments WHERE payments.student_id = student_fees.student_id),
                balance = total_due - (SELECT IFNULL(SUM(amount), 0) FROM payments WHERE payments.student_id = student_fees.student_id),
                status = CASE 
                    WHEN (total_due - (SELECT IFNULL(SUM(amount), 0) FROM payments WHERE payments.student_id = student_fees.student_id)) <= 0 AND total_due > 0 THEN 'Paid'
                    WHEN (SELECT IFNULL(SUM(amount), 0) FROM payments WHERE payments.student_id = student_fees.student_id) > 0 THEN 'Partial'
                    ELSE 'Pending'
                END
        `);
        res.json({ message: 'Ledger synchronized successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
export async function recordPayment(req, res) {
    try {
        const {
            student_id, amount, method, transaction_ref,
            category, semester, academic_year, remarks,
            manual_total_due, manual_total_paid, manual_balance,
            phone
        } = req.body;
        const recorded_by = req.user.name || req.user.email;

        // M-Pesa STK Push Integration (Africa's Talking)
        if (method === 'M-Pesa') {
            const { initiateMpesaCheckout } = await import('../services/paymentService.js');
            try {
                let targetPhone = phone;
                if (!targetPhone) {
                    if (isMongo()) {
                        const Student = (await import('../models/mongo/Student.js')).default;
                        const s = await Student.findOne({ id: student_id });
                        targetPhone = s?.contact || s?.phone;
                    } else {
                        const s = await queryOne('SELECT contact, phone FROM students WHERE id = ?', [student_id]);
                        targetPhone = s?.contact || s?.phone;
                    }
                }

                if (targetPhone) {
                    await initiateMpesaCheckout(targetPhone, amount, 'KES', {
                        studentId: student_id,
                        category,
                        recordedBy: recorded_by
                    });
                }
            } catch (err) {
                console.error('❌ M-Pesa Prompt Failed:', err.message);
                // We show error but if the push failed due to user cancellation/etc it might not reach here immediately
                // However if it's a structural error (missing credentials/invalid phone), we abort.
                if (err.message.includes('not configured') || err.message.includes('Invalid phone')) {
                    return res.status(400).json({ error: err.message });
                }
            }
        }

        if (isMongo()) {
            const Payment = (await import('../models/mongo/Payment.js')).default;
            const StudentFee = (await import('../models/mongo/StudentFee.js')).default;

            const newPayment = new Payment({
                student_id, amount, method, transaction_ref, recorded_by,
                category, semester, academic_year, remarks
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
                    {
                        total_due: finalTotalDue,
                        total_paid: finalTotalPaid,
                        balance: finalBalance,
                        status: newStatus,
                        last_payment_date: new Date()
                    }
                );
            } else {
                await new StudentFee({
                    student_id,
                    total_due: finalTotalDue,
                    total_paid: finalTotalPaid,
                    balance: finalBalance,
                    status: newStatus,
                    last_payment_date: new Date()
                }).save();
            }
            return res.status(201).json({ message: 'Payment recorded successfully' });
        }

        // SQLite / PG path
        await run(
            'INSERT INTO payments (student_id, amount, method, transaction_ref, recorded_by, category, semester, academic_year, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [student_id, amount, method, transaction_ref, recorded_by, category, semester, academic_year, remarks]
        );

        const fee = await queryOne('SELECT * FROM student_fees WHERE student_id = ?', [student_id]);
        const finalTotalDue = manual_total_due !== undefined && manual_total_due !== '' ? parseFloat(manual_total_due) : (fee?.total_due || 0);
        const finalTotalPaid = manual_total_paid !== undefined && manual_total_paid !== '' ? parseFloat(manual_total_paid) : ((fee?.total_paid || 0) + parseFloat(amount));
        const finalBalance = manual_balance !== undefined && manual_balance !== '' ? parseFloat(manual_balance) : (finalTotalDue - finalTotalPaid);
        const newStatus = finalBalance <= 0 ? 'Paid' : 'Partial';

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

            // Fallback to official ledger sum if per-student calculation is too complex for current schema mismatch
            const ledgerStats = await StudentFee.aggregate([
                { $group: { _id: null, total_due: { $sum: "$total_due" }, total_paid: { $sum: "$total_paid" }, balance: { $sum: "$balance" }, count: { $sum: 1 } } }
            ]);

            const stats = ledgerStats[0] || { total_due: 0, total_paid: 0, balance: 0, count: 0 };

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
                    total_revenue_expected: stats.total_due,
                    total_revenue_collected: total_revenue_collected, // Use real payment sum
                    total_outstanding: stats.balance,
                    pending_accounts: stats.count,
                    velocity: velocity.toFixed(1)
                },
                recentPayments: enrichedRecent
            });
        }

        // SQL Path
        const stats = await queryOne('SELECT SUM(total_due) as total_due, SUM(total_paid) as total_paid, SUM(balance) as balance, COUNT(*) as count FROM student_fees');
        const totalPayments = await queryOne('SELECT SUM(amount) as total FROM payments');

        // Velocity SQL
        const velocityRes = await queryOne(`
            SELECT 
                (SELECT SUM(amount) FROM payments WHERE payment_date >= date('now', 'start of month')) as this_month,
                (SELECT SUM(amount) FROM payments WHERE payment_date >= date('now', 'start of month', '-1 month') AND payment_date < date('now', 'start of month')) as last_month
        `);

        const thisMonth = velocityRes.this_month || 0;
        const lastMonth = velocityRes.last_month || 0;
        const velocity = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth * 100) : (thisMonth > 0 ? 100 : 0);

        const recentPayments = await query(`
            SELECT p.*, s.name as student_name, s.photo as student_photo 
            FROM payments p 
            JOIN students s ON p.student_id = s.id 
            ORDER BY p.payment_date DESC LIMIT 6
        `);

        res.json({
            summary: {
                total_revenue_expected: stats.total_due || 0,
                total_revenue_collected: totalPayments.total || 0,
                total_outstanding: stats.balance || 0,
                pending_accounts: stats.count || 0,
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
        const { amount, method, transaction_ref, category, semester, academic_year, remarks } = req.body;

        if (isMongo()) {
            const Payment = (await import('../models/mongo/Payment.js')).default;
            const updated = await Payment.findByIdAndUpdate(id, {
                amount, method, transaction_ref, category, semester, academic_year, remarks
            }, { new: true });
            if (!updated) return res.status(404).json({ error: 'Payment record not found' });
            return res.json({ message: 'Payment updated successfully', data: updated });
        }

        await run(
            'UPDATE payments SET amount = ?, method = ?, transaction_ref = ?, category = ?, semester = ?, academic_year = ?, remarks = ? WHERE id = ?',
            [amount, method, transaction_ref, category, semester, academic_year, remarks, id]
        );
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
            const deleted = await Payment.findByIdAndDelete(id);
            if (!deleted) return res.status(404).json({ error: 'Payment not found' });
            return res.json({ message: 'Payment deleted' });
        }

        await run('DELETE FROM payments WHERE id = ?', [id]);
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
                { $or: [{ _id: id }, { student_id: id }] },
                { total_due, total_paid, balance, status },
                { new: true }
            );
            if (!updated) return res.status(404).json({ error: 'Fee record not found' });
            return res.json({ message: 'Fee record updated successfully', data: updated });
        }

        await run(
            'UPDATE student_fees SET total_due = ?, total_paid = ?, balance = ?, status = ? WHERE id = ? OR student_id = ?',
            [total_due, total_paid, balance, status, id, id]
        );
        res.json({ message: 'Fee record updated successfully' });
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
