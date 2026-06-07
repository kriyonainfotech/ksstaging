const mongoose = require("mongoose");
const CryptoJS = require("crypto-js");
const jwt = require("jsonwebtoken");

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Please add a name"],
        },
        email: {
            type: String,
            required: [true, "Please add an email"],
            unique: true,
            match: [
                /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                "Please add a valid email",
            ],
        },
        password: {
            type: String,
            required: [true, "Please add a password"],
            select: false, // Don't return password by default in queries
        },

        // --- ACCESS CONTROL FIELDS ---
        role: {
            type: String,
            enum: ["Superadmin", "Admin", "Team", "Client", "User"],
            default: "User",
        },
        status: {
            type: String,
            enum: ["Active", "Suspended", "On Leave", "Pending"],
            default: "Active"
        },
        isActive: {
            type: Boolean,
            default: true, // If false, they cannot login (The Cut-off switch)
        },

        // Link to a Company (Dynamic)
        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company"
        },

        // NEW: Multi-Company Access
        accessibleCompanies: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company"
        }],

        // NEW: Currently selected company context
        activeCompany: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Company"
        },

        // Optional: For specific overrides (e.g., giving Finance access to one specific Admin)
        customPermissions: [{
            type: String
        }],
        managedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        profilePic: {
            public_id: String,
            url: String
        },
        phone: { type: String },
        isGlobalSuperadmin: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// 1. Encrypt password before saving
UserSchema.pre("save", function (next) {
    if (!this.isModified("password")) {
        return next();
    }

    // Encrypt using a Secret Key (Add CRYPTO_SECRET to your .env file)
    // If you don't have one, we fallback to JWT_SECRET temporarily
    const secret = process.env.CRYPTO_SECRET || process.env.JWT_SECRET;

    this.password = CryptoJS.AES.encrypt(this.password, secret).toString();
    next();
});

// 2. Match password for Login (Decrypt DB pass & compare)
UserSchema.methods.matchPassword = function (enteredPassword) {
    const secret = process.env.CRYPTO_SECRET || process.env.JWT_SECRET;

    // Decrypt the stored password
    const bytes = CryptoJS.AES.decrypt(this.password, secret);
    const originalPassword = bytes.toString(CryptoJS.enc.Utf8);

    return enteredPassword === originalPassword;
};

// 3. SPECIAL: View Password (For Superadmin API)
UserSchema.methods.getDecryptedPassword = function () {
    const secret = process.env.CRYPTO_SECRET || process.env.JWT_SECRET;

    const bytes = CryptoJS.AES.decrypt(this.password, secret);
    return bytes.toString(CryptoJS.enc.Utf8);
};

// 4. Generate Token (Same as before)
UserSchema.methods.getSignedJwtToken = function () {
    return jwt.sign(
        { id: this._id, role: this.role, isGlobalSuperadmin: this.isGlobalSuperadmin },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d",
        }
    );
};
module.exports = mongoose.model("User", UserSchema);