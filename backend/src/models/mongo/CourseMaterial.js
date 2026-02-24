import mongoose from 'mongoose';

const CourseMaterialSchema = new mongoose.Schema({
    course_id: { type: String, required: true },
    course_name: { type: String },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    // file_url stores either an external URL or a base64 data URI for uploaded files
    file_url: { type: String, required: true },
    file_name: { type: String },
    file_size: { type: Number },
    mime_type: { type: String },
    uploaded_by: { type: String, required: true },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export default mongoose.models.CourseMaterial || mongoose.model('CourseMaterial', CourseMaterialSchema);
