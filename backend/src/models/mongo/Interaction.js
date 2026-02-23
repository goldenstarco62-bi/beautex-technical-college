import mongoose from 'mongoose';

const interactionSchema = new mongoose.Schema({
    entity_type: {
        type: String,
        enum: ['grade', 'course'],
        required: true
    },
    entity_id: {
        type: String,
        required: true
    },
    user_id: {
        type: String,
        required: true
    },
    user_name: {
        type: String,
        required: true
    },
    user_photo: {
        type: String,
        required: false
    },
    role: {
        type: String,
        enum: ['student', 'teacher', 'admin', 'superadmin'],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    reactions: {
        type: Map,
        of: [String], // Map of emoji -> list of userIds
        default: {}
    },
    parent_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Interaction',
        default: null
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const Interaction = mongoose.model('Interaction', interactionSchema);
export default Interaction;
