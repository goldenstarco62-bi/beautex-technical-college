import mongoose from 'mongoose';

const StudentFeeSchema = new mongoose.Schema({
    student_id: { type: String, required: true, unique: true },
    total_due: { type: Number, default: 0 },
    total_paid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    last_payment_date: { type: Date },
    status: { type: String, enum: ['Paid', 'Partial', 'Pending', 'Overdue'], default: 'Pending' }
}, { timestamps: { updatedAt: 'updated_at' } });

export default mongoose.models.StudentFee || mongoose.model('StudentFee', StudentFeeSchema);
