const mongoose = require("mongoose");

const SopGroupSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    entityType: {
        type: String,
        enum: ["superadmin", "team"],
        required: true
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: function () { return this.entityType === 'superadmin'; }
    },
    teamCategory: {
        type: String,
        required: function () { return this.entityType === 'team'; }
    },
    category: {
        type: String,
        enum: ["sop", "rule"],
        required: true
    },
    order: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model("SopGroup", SopGroupSchema);
