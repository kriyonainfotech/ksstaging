const mongoose = require('mongoose');

const ServiceItemSchema = new mongoose.Schema({
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

}, { _id: false });

const packageTemplateSchema = new mongoose.Schema({
    packageName: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    lineItems: [ServiceItemSchema],
    sellingPrice: { type: Number },
    status: {
        type: String,
        enum: ["active", "archived"],
        default: "active"
    }
}, { timestamps: true });

module.exports = mongoose.model('PackageTemplate', packageTemplateSchema);