// models/ServiceItem.js
const mongoose = require('mongoose');

const serviceItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        // Example: "Instagram Post Design", "Reel Editing", "Monthly SEO Audit"
    },
    unitPrice: {
        type: Number,
        required: true,
        // Example: 1500 (for a post), 5000 (for a reel)
    },
    unitName: {
        type: String,
        default: 'per item',
        // Example: "per post", "per reel", "per month"
    },
    category: {
        type: String,
        required: true,
        enum: ['design', 'video', 'marketing', 'branding', 'web'],
    },
    status: {
        type: String,
        enum: ['active', 'archived'],
        default: 'active'
    }
}, { timestamps: true });

const ServiceItem = mongoose.model('ServiceItem', serviceItemSchema);

module.exports = ServiceItem;
