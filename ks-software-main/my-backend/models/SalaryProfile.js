const mongoose = require("mongoose");

const SalaryProfileSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true
        },
        salary: {
            amount: { type: Number, default: 0 },
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
        bankInfo: {
            bankName: String,
            accountNumber: String,
            ifscCode: String,
            accountHolderName: String,
            upiId: String
        },
        paymentPreferences: {
            preferredSourceAccount: {
                type: String,
                enum: ["Company Bank", "Personal Bank", "Cash"],
                default: "Company Bank"
            },
            notes: String
        },
        effectiveFrom: {
            type: Date,
            default: Date.now
        },
        effectiveTo: Date,
        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("SalaryProfile", SalaryProfileSchema);
