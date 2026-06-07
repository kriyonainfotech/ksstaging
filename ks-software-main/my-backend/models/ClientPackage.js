// models/Package.js
const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
    item: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceItem',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    priceAtTimeOfPurchase: {
        type: Number,
        required: true
    }
}, { _id: false });


const paymentSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true
    },
    paymentDate: {
        type: Date,
        required: true,
    },
    paymentMethod: {
        type: String,
        enum: ['UPI', 'Cash', 'Other'],
        default: 'Other'
    },
    notes: {
        type: String,
        trim: true
    }
}, { timestamps: true });

const ClientPackageSchema = new mongoose.Schema({
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    packageName: {
        type: String,
        required: true,
    },
    startDate: {
        type: Date,
        required: true,
    },
    endDate: {
        type: Date,
        required: true,
    },
    lineItems: [lineItemSchema],
    payments: [paymentSchema], // An array to log all payments for this package

    paymentStatus: {
        type: String,
        enum: ['Paid', 'Partially Paid', 'Unpaid'],
        default: 'Unpaid',
    },
    totalAmount: {
        type: Number,
        required: true,
    },
    billingCycle: {
        type: String,
        enum: ['monthly', 'quarterly', 'one-time'],
        default: "monthly",
        required: true,
    },
    status: {
        type: String,
        enum: ['Active', 'Completed', 'Cancelled'],
        default: 'Active'
    },
    paymentStatus: {
        type: String,
        enum: ['Partially Paid', 'Paid', 'Unpaid'],
        default: 'Pending'
    }
}, { timestamps: true });

const ClientPackage = mongoose.model('ClientPackage', ClientPackageSchema);

module.exports = ClientPackage;
