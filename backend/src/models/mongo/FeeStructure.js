import mongoose from 'mongoose';

const FeeStructureSchema = new mongoose.Schema({
    course_id: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    semester: { type: String, required: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.models.FeeStructure || mongoose.model('FeeStructure', FeeStructureSchema);
