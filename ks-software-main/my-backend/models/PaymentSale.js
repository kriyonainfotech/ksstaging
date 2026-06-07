const mongoose = require("mongoose");

const PaymentSaleSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }, // The Superadmin (Kirtan, Nayan, etc.)

    // --- Client Details (Registered OR Guest) ---
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ClientProfile",
        default: null
    },
    isGuest: {
        type: Boolean,
        default: false
    },
    guestName: {
        type: String
    },
    guestPhone: {
        type: String
    },

    company: {
        type: String,
        enum: ["Kriyona Studio", "PrimeAdwork", "Kriyona Infotech"],
        required: [true, "Please specify the company"]
    },

    // --- Sale Details ---
    title: {
        type: String,
        required: true
    }, // e.g., "Social Media Package - Jan"

    totalAmount: {
        type: Number,
        required: true
    }, // The Bill Amount (e.g., 2000)

    // --- Payment Tracking ---
    collectedAmount: {
        type: Number,
        default: 0
    },
    lossAmount: {
        type: Number,
        default: 0
    }, // Discount or Bad Debt
    remainingAmount: {
        type: Number,
        default: 0
    }, // Auto-calculated

    status: {
        type: String,
        enum: ["Pending", "Partial", "Cleared", "Written Off"],
        default: "Pending"
    },

    destinationAccount: {
        type: String,
        enum: ["Company Bank", "Personal Bank", "Cash"],
        default: "Company Bank"
    },

    saleDate: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String
    }
}, { timestamps: true });

// --- Middleware: Auto-Calculate Status & Remaining ---
PaymentSaleSchema.pre('save', function (next) {
    // 1. Calculate Remaining
    this.remainingAmount = this.totalAmount - (this.collectedAmount + this.lossAmount);

    // 2. Determine Status
    if (this.remainingAmount <= 0) {
        // If fully paid or loss covers the rest
        this.status = this.collectedAmount > 0 ? "Cleared" : "Written Off";
    } else if (this.collectedAmount > 0) {
        // If paid some amount but not all
        this.status = "Partial";
    } else {
        // If nothing paid yet
        this.status = "Pending";
    }

    next();
});

module.exports = mongoose.model("PaymentSale", PaymentSaleSchema);