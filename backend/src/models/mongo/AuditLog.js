import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    user_email: String,
    action: {
        type: String,
        required: true
    },
    resource: String,
    resource_id: String,
    details: String,
    ip_address: String,
    created_at: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: false }
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
