import mongoose from 'mongoose';

const PaymentSchema = new mongoose.Schema({
    student_id: { type: String, required: true },
    amount: { type: Number, required: true },
    method: { type: String, required: true },
    transaction_ref: { type: String, unique: true, sparse: true },
    payment_date: { type: Date, default: Date.now },
    recorded_by: { type: String },
    status: { type: String, default: 'Completed' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.models.Payment || mongoose.model('Payment', PaymentSchema);
