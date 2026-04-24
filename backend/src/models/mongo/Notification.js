import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    user_id: { type: String, default: null }, // null for global
    title: { type: String, required: true },
    content: { type: String, required: true },
    type: { type: String, default: 'info' },
    priority: { type: String, default: 'medium' },
    is_read: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
