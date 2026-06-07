const mongoose = require("mongoose");

const PaymentCollectionSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    transactionType: {
        type: String,
        enum: ["Income", "Expense"],
        default: "Income"
    },
    expenseCategory: {
        type: String,
        enum: ["Operational", "Salary"],
        default: "Operational"
    },
    company: {
        type: String,
        enum: ["Kriyona Studio", "PrimeAdwork", "Kriyona Infotech"],
        required: [true, "Please specify the company"]
    },
    saleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PaymentSale",
        required: false // Optional for general expenses and direct collections
    }, // Link to parent Sale

    isDirectCollection: {
        type: Boolean,
        default: false
    },
    title: {
        type: String,
        required: false
    },

    // Snapshot of who paid (Stored here so history remains even if client is deleted)
    payerName: {
        type: String,
        required: true
    },

    amountCollected: {
        type: Number,
        required: true
    },
    amountLoss: {
        type: Number,
        default: 0
    }, // Amount waived off in this transaction

    destinationAccount: {
        type: String,
        enum: ["Company Bank", "Personal Bank", "Cash"],
        required: true
    },

    collectionDate: {
        type: Date,
        default: Date.now
    },
    salaryMonth: {
        type: Number,
        required: false
    },
    salaryYear: {
        type: Number,
        required: false
    },
    notes: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model("PaymentCollection", PaymentCollectionSchema);