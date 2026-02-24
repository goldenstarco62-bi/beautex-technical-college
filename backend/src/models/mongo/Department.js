import mongoose from 'mongoose';

const DepartmentSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    head_of_department: { type: String, default: '' },
    description: { type: String, default: '' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.models.Department || mongoose.model('Department', DepartmentSchema);
