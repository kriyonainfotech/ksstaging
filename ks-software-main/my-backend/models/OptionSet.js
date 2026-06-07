const mongoose = require("mongoose");

const OptionSetSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    options: [{
        label: { type: String, required: true }, // What user sees: "Done"
        value: { type: String, required: true }, // What DB saves: "DONE"
        color: { type: String, default: "#000000" }, // For UI badges
        isSystem: { type: Boolean, default: false } // PROTECTS core logic
    }]
});

module.exports = mongoose.model("OptionSet", OptionSetSchema);
