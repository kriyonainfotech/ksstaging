// models/ClientSubscription.js
const mongoose = require("mongoose");

const activeLineItemSchema = new mongoose.Schema({
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceItem' },
    serviceName: String,
    quantity: Number,
    serviceCategory: String,
    price: Number,
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tasksCreated: { type: Number, default: 0 }
});

const ClientSubscriptionSchema = new mongoose.Schema({
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'ClientProfile', required: true },
    packageName: String,
    packageTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'PackageTemplate' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    deliverables: [activeLineItemSchema],
    status: { type: String, enum: ["Active", "Completed", "Cancelled"], default: "Active" }
}, { timestamps: true });

module.exports = mongoose.model("ClientSubscription", ClientSubscriptionSchema);
