const mongoose = require("mongoose");

const PayrollRunSchema = new mongoose.Schema({
    month: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    year: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ["Draft", "Finalized", "Paid", "Cancelled"],
        default: "Draft"
    },
    generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    finalizedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    finalizedAt: {
        type: Date
    },
    totals: {
        employees: { type: Number, default: 0 },
        baseSalary: { type: Number, default: 0 },
        earned: { type: Number, default: 0 },
        paid: { type: Number, default: 0 },
        pending: { type: Number, default: 0 },
        present: { type: Number, default: 0 },
        half: { type: Number, default: 0 },
        leave: { type: Number, default: 0 },
        absent: { type: Number, default: 0 },
        sundays: { type: Number, default: 0 },
        workingDays: { type: Number, default: 0 },
        monthDays: { type: Number, default: 0 }
    },
    notes: {
        type: String,
        trim: true
    }
}, { timestamps: true });

PayrollRunSchema.index({ month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model("PayrollRun", PayrollRunSchema);
