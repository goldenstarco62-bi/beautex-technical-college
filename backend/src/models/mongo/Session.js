import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
    day: {
        type: String,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    course: {
        type: String,
        required: true
    },
    room: {
        type: String,
        required: true
    },
    instructor: {
        type: String,
        required: true
    },
    teacher_email: String
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const Session = mongoose.model('Session', sessionSchema);
export default Session;
