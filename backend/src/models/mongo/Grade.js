import mongoose from 'mongoose';

const gradeSchema = new mongoose.Schema({
    student_id: {
        type: String,
        required: true
    },
    course: {
        type: String,
        required: true
    },
    assignment: {
        type: String,
        required: true
    },
    month: {
        type: String,
        required: false
    },
    score: {
        type: Number,
        required: true
    },
    max_score: {
        type: Number,
        required: true
    },
    remarks: {
        type: String,
        required: false
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const Grade = mongoose.model('Grade', gradeSchema);
export default Grade;
