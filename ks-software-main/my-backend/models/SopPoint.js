const mongoose = require("mongoose");

const SopPointSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SopGroup",
        required: true
    },
    order: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

module.exports = mongoose.model("SopPoint", SopPointSchema);
