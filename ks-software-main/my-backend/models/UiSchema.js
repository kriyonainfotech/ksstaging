const mongoose = require("mongoose");

const UiSchema = new mongoose.Schema({
    resource: {
        type: String,
        required: true,
        unique: true, // e.g., 'task', 'client', 'project'
        trim: true
    },
    variant: { type: String, default: 'default' },
    fields: [{
        key: { type: String, required: true }, // The variable name (e.g. 'budget')
        label: { type: String, required: true }, // The UI Label (e.g. 'Project Budget')
        type: {
            type: String,
            required: true,
            enum: ["text", "number", "textarea", "date", "select", "boolean"]
        },
        required: { type: Boolean, default: false },
        placeholder: { type: String, default: "" },
        order: { type: Number, default: 0 } // To control sort order in UI
    }]
}, { timestamps: true });

UiSchema.index({ resource: 1, variant: 1 }, { unique: true });

module.exports = mongoose.model("UiSchema", UiSchema);