const mongoose = require("mongoose");

const ClientProfileSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // --- Business Info ---
    businessName: { type: String, required: true },
    businessPhone: { type: String },
    businessEmail: { type: String },

    // Location
    city: { type: String },
    state: { type: String },
    country: { type: String, default: "India" },
    businessAddress: { type: String },

    // Metadata
    industry: { type: String },
    website: { type: String },

    // --- Secured Credentials ---
    socials: {
        facebookId: { type: String },
        facebookPassword: { type: String },
        instagramId: { type: String },
        instagramPassword: { type: String }
    },

    assignedAdmin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    
    assignedTeam: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],

    clientStatus: {
        type: String,
        enum: ["Active", "Onboarding"],
        default: "Onboarding"
    },

    joinedDate: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("ClientProfile", ClientProfileSchema);