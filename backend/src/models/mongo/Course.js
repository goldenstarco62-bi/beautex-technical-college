import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    department: {
        type: String,
        required: true
    },
    instructor: {
        type: String,
        required: true
    },
    duration: String,
    enrolled: {
        type: Number,
        default: 0
    },
    capacity: {
        type: Number,
        required: true
    },
    schedule: String,
    room: String,
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const Course = mongoose.model('Course', courseSchema);
export default Course;
