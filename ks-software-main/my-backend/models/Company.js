const mongoose = require("mongoose");

const CompanySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Please add a company name"],
            unique: true,
            trim: true
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false // Optional initially
        },
        admins: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }]
    },
    { timestamps: true }
);

module.exports = mongoose.model("Company", CompanySchema);
