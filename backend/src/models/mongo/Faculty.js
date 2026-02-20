import mongoose from 'mongoose';

const facultySchema = new mongoose.Schema({
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
    department: {
        type: String,
        required: true
    },
    courses: [String], // Array of course names
    contact: String,
    passport: String, // Passport number for trainers
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    photo: String,
    address: String,
    bio: String,
    phone: String
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const Faculty = mongoose.model('Faculty', facultySchema);
export default Faculty;
