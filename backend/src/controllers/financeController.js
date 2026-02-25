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
        if (req.user.role === 'student' && req.user.student_id !== studentId) {
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
export async function recordPayment(req, res) {
    try {
        const { student_id, amount, method, transaction_ref } = req.body;
        const recorded_by = req.user.name || req.user.email;

        if (isMongo()) {
            const Payment = (await import('../models/mongo/Payment.js')).default;
            const StudentFee = (await import('../models/mongo/StudentFee.js')).default;

            // Save payment
            const newPayment = new Payment({ student_id, amount, method, transaction_ref, recorded_by });
            await newPayment.save();

            // Update student_fees summary
            const fee = await StudentFee.findOne({ student_id });
            if (fee) {
                const newPaid = (fee.total_paid || 0) + parseFloat(amount);
                const newBalance = (fee.total_due || 0) - newPaid;
                const newStatus = newBalance <= 0 ? 'Paid' : 'Partial';

                await StudentFee.findOneAndUpdate(
                    { student_id },
                    {
                        total_paid: newPaid,
                        balance: newBalance,
                        status: newStatus,
                        last_payment_date: new Date()
                    }
                );
            } else {
                await new StudentFee({
                    student_id,
                    total_paid: amount,
                    balance: -amount,
                    status: 'Partial',
                    last_payment_date: new Date()
                }).save();
            }
            return res.status(201).json({ message: 'Payment recorded successfully' });
        }

        // SQLite / PG path
        await run(
            'INSERT INTO payments (student_id, amount, method, transaction_ref, recorded_by) VALUES (?, ?, ?, ?, ?)',
            [student_id, amount, method, transaction_ref, recorded_by]
        );

        // Update student_fees summary
        const fee = await queryOne('SELECT * FROM student_fees WHERE student_id = ?', [student_id]);
        if (fee) {
            const newPaid = fee.total_paid + parseFloat(amount);
            const newBalance = fee.total_due - newPaid;
            const newStatus = newBalance <= 0 ? 'Paid' : 'Partial';

            await run(
                'UPDATE student_fees SET total_paid = ?, balance = ?, status = ?, last_payment_date = CURRENT_TIMESTAMP WHERE student_id = ?',
                [newPaid, newBalance, newStatus, student_id]
            );
        } else {
            await run(
                'INSERT INTO student_fees (student_id, total_paid, balance, status, last_payment_date) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
                [student_id, amount, -amount, 'Partial']
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
            if (effectiveId !== req.user.student_id) {
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

            const summary = await StudentFee.aggregate([
                {
                    $group: {
                        _id: null,
                        total_revenue_expected: { $sum: '$total_due' },
                        total_revenue_collected: { $sum: '$total_paid' },
                        total_outstanding: { $sum: '$balance' },
                        pending_accounts: { $sum: { $cond: [{ $ne: ['$status', 'Paid'] }, 1, 0] } }
                    }
                }
            ]);

            const recentPayments = await Payment.find().sort({ payment_date: -1 }).limit(5);

            return res.json({
                summary: summary[0] || { total_revenue_expected: 0, total_revenue_collected: 0, total_outstanding: 0, pending_accounts: 0 },
                recentPayments
            });
        }

        const stats = await queryOne(`
            SELECT 
                SUM(total_due) as total_revenue_expected,
                SUM(total_paid) as total_revenue_collected,
                SUM(balance) as total_outstanding,
                COUNT(CASE WHEN status != 'Paid' THEN 1 END) as pending_accounts
            FROM student_fees
        `);

        const recentPayments = await query('SELECT * FROM payments ORDER BY payment_date DESC LIMIT 5');

        res.json({
            summary: stats,
            recentPayments
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
