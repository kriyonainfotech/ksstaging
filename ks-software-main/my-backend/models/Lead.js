const mongoose = require("mongoose");

const LeadSchema = new mongoose.Schema({
    date: {
        type: String, // Storing as YYYY-MM-DD string for consistency with frontend
        default: () => new Date().toISOString().split('T')[0]
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: false // Optional for now, but will be enforced in controller
    },
    name: {
        type: String,
        required: true
    },
    businessName: {
        type: String,
        default: ""
    },
    phone: {
        type: String,
        required: true
    },
    city: {
        type: String,
        default: ""
    },
    purpose: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        default: "New Lead"
    },
    notes: {
        type: String,
        default: ""
    }
}, { timestamps: true });

module.exports = mongoose.model("Lead", LeadSchema);
