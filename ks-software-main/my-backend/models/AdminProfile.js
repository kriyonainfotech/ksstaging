const mongoose = require("mongoose");

const AdminProfileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    specialization: {
        type: String,
        default: 'Management'
    },
    skills: {
        type: [String],
        default: []
    },
    joinedDate: {
        type: Date,
        default: Date.now
    },
    salary: {
        amount: { type: Number },
        type: {
            type: String,
            enum: ["Monthly", "Hourly", "Weekly"],
            default: "Monthly"
        },
        currency: {
            type: String,
            default: "INR"
        }
    },
    experience: {
        type: Number,
        default: 0
    },
    address: {
        street: String,
        city: String,
        state: String,
        country: String,
    },
    emergencyContact1: {
        name: String,
        phone: String
    },
    emergencyContact2: {
        name: String,
        phone: String
    },
    notes: {
        type: String
    },
    timing: {
        start: { type: String, default: "9:00 AM" },
        end: { type: String, default: "7:00 PM" }
    },
    bankInfo: {
        bankName: String,
        accountNumber: String,
        ifscCode: String
    }
}, { timestamps: true });

module.exports = mongoose.model("AdminProfile", AdminProfileSchema);
