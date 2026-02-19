import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    course: {
        type: String,
        required: true
    },
    semester: String,
    gpa: {
        type: Number,
        default: 0.0
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Graduated'],
        default: 'Active'
    },
    contact: String,
    photo: String,
    dob: Date,
    address: String,
    guardian_name: String,
    guardian_contact: String,
    blood_group: String,
    enrolled_date: {
        type: Date,
        default: Date.now
    },
    completion_date: Date
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const Student = mongoose.model('Student', studentSchema);
export default Student;
