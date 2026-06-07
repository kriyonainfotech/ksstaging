const mongoose = require("mongoose");

const PayrollLineSchema = new mongoose.Schema({
    payrollRun: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PayrollRun",
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    employeeSnapshot: {
        name: String,
        email: String,
        role: String,
        department: String,
        profilePic: String,
        timing: {
            start: String,
            end: String
        }
    },
    salarySnapshot: {
        baseSalary: { type: Number, default: 0 },
        salaryType: { type: String, default: "Monthly" },
        currency: { type: String, default: "INR" },
        salaryProfile: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SalaryProfile"
        },
        salarySource: String,
        bankInfo: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        }
    },
    attendanceSnapshot: {
        present: { type: Number, default: 0 },
        half: { type: Number, default: 0 },
        leave: { type: Number, default: 0 },
        absent: { type: Number, default: 0 },
        sundays: { type: Number, default: 0 },
        totalWorking: { type: Number, default: 0 },
        monthDays: { type: Number, default: 0 },
        paidDays: { type: Number, default: 0 }
    },
    amounts: {
        earned: { type: Number, default: 0 },
        paid: { type: Number, default: 0 },
        pending: { type: Number, default: 0 }
    },
    status: {
        type: String,
        enum: ["Pending", "Partially Paid", "Paid", "Cancelled"],
        default: "Pending"
    },
    paymentCollections: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "PaymentCollection"
    }],
    notes: {
        type: String,
        trim: true
    }
}, { timestamps: true });

PayrollLineSchema.index({ payrollRun: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("PayrollLine", PayrollLineSchema);
