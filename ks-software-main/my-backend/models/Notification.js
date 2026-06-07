const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['task_reminder', 'system', 'other'],
        default: 'other'
    },
    relatedId: {
        type: mongoose.Schema.Types.ObjectId,
        // Dynamic reference, could be Task, etc.
    },
    isRead: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '30d' // Auto-delete after 30 days to keep DB clean
    }
});

module.exports = mongoose.model('Notification', notificationSchema);
