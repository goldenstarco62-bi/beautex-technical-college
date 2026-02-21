import { query, queryOne, run } from '../config/database.js';

// Fee Structures
export async function getFeeStructures(req, res) {
    try {
        const fees = await query('SELECT fs.*, c.name as course_name FROM fee_structures fs JOIN courses c ON fs.course_id = c.id');
        res.json(fees);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function createFeeStructure(req, res) {
    try {
        const { course_id, amount, category, semester } = req.body;
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

        const fee = await queryOne('SELECT * FROM student_fees WHERE student_id = ?', [studentId]);
        if (!fee) return res.status(404).json({ error: 'Fee record not found' });
        res.json(fee);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

export async function getAllStudentFees(req, res) {
    try {
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
        const recorded_by = req.user.email;

        // Start transaction (simplified for SQLite)
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
            // If no record exists, create one (might happen if seed is missing)
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
