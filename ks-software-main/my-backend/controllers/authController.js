const jwt = require("jsonwebtoken");
const ROLE_PERMISSIONS = require("../config/roleDefaults");
const User = require("../models/user");
const TeamProfile = require("../models/TeamProfile");
const ClientProfile = require("../models/ClientProfile");
const AdminProfile = require("../models/AdminProfile");
const cloudinary = require("../config/cloudinary");

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public (or Admin only depending on logic)
exports.register = async (req, res) => {
    console.log("📥 [REGISTER] Request:", req.body);

    try {
        const { name, email, password, role } = req.body;

        // Default role = User
        const finalRole = role || "User";

        // Auto assign default permissions based on role
        const permissions = ROLE_PERMISSIONS[finalRole] || [];

        const user = await User.create({
            name,
            email,
            password,
            role: finalRole,
            customPermissions: permissions
        });

        console.log(`✅ [REGISTER] User created: ${user._id} | Role: ${user.role}`);
        console.log("🔑 [PERMISSIONS]:", permissions);

        await sendTokenResponse(user, 201, res);

    } catch (error) {
        console.error("❌ [REGISTER] Error:", error.message);

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                error: "Email already exists"
            });
        }

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// @desc    Universal Login (Checks Admin, Team, User all in User Collection)
exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: "Please provide an email and password" });
        }

        // 1. Search in User collection
        const user = await User.findOne({ email }).select("+password").populate("company", "name").populate("accessibleCompanies", "name");

        if (!user) {
            return res.status(401).json({ success: false, error: "Invalid credentials" });
        }

        // 2. Check password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, error: "Invalid credentials" });
        }

        // 3. Check status
        if (user.isActive === false) {
            return res.status(403).json({ success: false, error: "Your account has been suspended." });
        }

        await sendTokenResponse(user, 200, res);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Helper to get token from model, create cookie and send response
const sendTokenResponse = async (user, statusCode, res) => {
    // Create token
    const token = user.getSignedJwtToken();

    let profile = null;
    if (user.role === "Team" && !user.specialization) {
        // Legacy support/User model
        profile = await TeamProfile.findOne({ user: user._id });
    } else if (user.role === "Client") {
        profile = await ClientProfile.findOne({ user: user._id });
    } else if (user.role === "Admin" && !user.salary) {
        // Admin from User collection (New Architecture)
        profile = await AdminProfile.findOne({ user: user._id });
        if (profile) {
            const assignedClients = await ClientProfile.find({ assignedAdmin: user._id }).populate("user", "name email");
            profile = { ...profile.toObject(), assignedClients };
        }
    }

    // In production, you might want to set a Cookie here too
    // For now, we send it in the JSON body for the React Frontend to store in localStorage
    res.status(statusCode).json({
        success: true,
        token,
        user: {
            id: user._id,
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            profilePic: user.profilePic,
            phone: user.phone,
            isGlobalSuperadmin: user.isGlobalSuperadmin,
            customPermissions: user.customPermissions,
            profile: profile,
            specialization: profile?.specialization || undefined
        }
    });
};

exports.me = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;

        let user;
        // Simplified: All users in the same collection
        // Simplified: All users in the same collection
        user = await User.findById(userId).populate("company", "name").populate("accessibleCompanies", "name");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        let profile = null;
        if (user.role === "Team" && !user.specialization) {
            profile = await TeamProfile.findOne({ user: user._id });
        } else if (user.role === "Client") {
            profile = await ClientProfile.findOne({ user: user._id });
        } else if (user.role === "Admin") {
            profile = await AdminProfile.findOne({ user: user._id });
            if (profile) {
                const assignedClients = await ClientProfile.find({ assignedAdmin: user._id }).populate("user", "name email");
                profile = { ...profile.toObject(), assignedClients };
            }
        }

        res.status(200).json({
            success: true,
            user: {
                ...user.toObject(),
                profile: profile || user.toObject(), // If standalone, use self
                specialization: user.specialization || profile?.specialization || undefined
            },
        });
    } catch (error) {
        console.error("❌ ME ERROR:", error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, email, phone } = req.body;

        const updatedData = {};

        if (name) updatedData.name = name;
        if (email) updatedData.email = email;
        if (phone) updatedData.phone = phone;

        // Handle profile picture upload
        if (req.file) {
            // Delete old profile pic from Cloudinary if exists
            const existingUser = await User.findById(userId);
            if (existingUser?.profilePic?.public_id) {
                try {
                    await cloudinary.uploader.destroy(existingUser.profilePic.public_id);
                    console.log("🗑️ Old profile pic deleted from Cloudinary:", existingUser.profilePic.public_id);
                } catch (delErr) {
                    console.log("⚠️ Failed to delete old profile pic:", delErr.message);
                }
            }

            updatedData.profilePic = {
                public_id: req.file.filename,
                url: req.file.path
            };
        }

        const user = await User.findByIdAndUpdate(
            userId,
            updatedData,
            { new: true, runValidators: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user
        });

    } catch (error) {
        console.log("❌ UPDATE PROFILE ERROR:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Remove profile picture
exports.removeProfilePic = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Delete from Cloudinary if exists
        if (user.profilePic?.public_id) {
            try {
                await cloudinary.uploader.destroy(user.profilePic.public_id);
                console.log("🗑️ Profile pic deleted from Cloudinary:", user.profilePic.public_id);
            } catch (delErr) {
                console.log("⚠️ Failed to delete from Cloudinary:", delErr.message);
            }
        }

        // Clear profilePic from user document using $unset
        await User.findByIdAndUpdate(userId, { $unset: { profilePic: 1 } });

        // Return user without password, explicitly setting profilePic to null for frontend
        const updatedUser = await User.findById(userId).select("-password").lean();
        updatedUser.profilePic = null;

        res.status(200).json({
            success: true,
            message: "Profile picture removed",
            user: updatedUser
        });

    } catch (error) {
        console.log("❌ REMOVE PROFILE PIC ERROR:", error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log("Login Request:", { email });

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
                errorCode: "MISSING_FIELDS"
            });
        }

        // Find admin user
        const user = await User.findOne({
            email: email.toLowerCase().trim(),
            role: "Admin"
        }).select("+password");

        console.log("Found User:", user);

        // User not found
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Admin account not found",
                errorCode: "ADMIN_NOT_FOUND"
            });
        }

        // Inactive account
        if (!user.isActive || user.status !== "Active") {
            return res.status(403).json({
                success: false,
                message: `Account is ${user.status}`,
                errorCode: "ACCOUNT_INACTIVE"
            });
        }

        // Password check
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Incorrect password",
                errorCode: "INVALID_PASSWORD"
            });
        }

        // Generate token
        const token = user.getSignedJwtToken();

        // Remove password
        user.password = undefined;

        // Success response
        return res.status(200).json({
            success: true,
            message: "Admin login successful",
            token,
            user
        });

    } catch (error) {
        console.error("Admin Login Error:", error);

        return res.status(500).json({
            success: false,
            message: "Backend login error",
            error: error.message,
            stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        });
    }
};

exports.SPadminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase().trim(),
            role: { $in: ["Superadmin", "Team"] }
        })
            .select("+password")
            .populate("company", "name")
            .populate("accessibleCompanies", "name");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Only Superadmin or Team can login from this panel"
            });
        }

        if (!user.isActive || user.status !== "Active") {
            return res.status(403).json({
                success: false,
                message: "Account is inactive or suspended"
            });
        }

        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password"
            });
        }

        // --- SECRET KEY VERIFICATION FOR SUPERADMIN ---
        if (user.role === "Superadmin") {
            const { secretKey } = req.body;

            // Helper to generate key for a specific date
            const generateKey = (dateObj) => {
                const dd = String(dateObj.getDate()).padStart(2, "0");
                let hh = dateObj.getHours();
                const mm = String(dateObj.getMinutes()).padStart(2, "0");
                hh = hh % 12;
                hh = hh ? hh : 12;
                const hhStr = String(hh).padStart(2, "0");
                return `${dd}${hhStr}${mm}`;
            };

            const now = new Date();
            const expectedKeyNow = generateKey(now);
            const expectedKeyPrev = generateKey(new Date(now.getTime() - 60000)); // 1 min grace

            console.log(`Superadmin Login: Expected: ${expectedKeyNow} or ${expectedKeyPrev}, Received: ${secretKey}`);

            if (!secretKey) {
                return res.status(200).json({
                    success: true,
                    requireSecretKey: true,
                    message: "Secret key required for Superadmin"
                });
            }

            if (secretKey !== expectedKeyNow && secretKey !== expectedKeyPrev) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid secret key"
                });
            }
        }
        // ----------------------------------------------

        const token = user.getSignedJwtToken();
        user.password = undefined;

        let profile = null;

        if (user.role === "Team") {
            profile = await TeamProfile.findOne({ user: user._id });
        }

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                ...user.toObject(),
                profile,
                specialization: profile?.specialization || undefined
            }
        });

    } catch (error) {
        console.error("Panel Login Error:", error);

        return res.status(500).json({
            success: false,
            message: "Backend login error",
            error: error.message
        });
    }
};

exports.refreshToken = async (req, res) => {
    try {
        // Try to get refreshToken from body or Authorization header or Cookies
        let rToken = req.body.refreshToken;

        if (!rToken && req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
            rToken = req.headers.authorization.split(" ")[1];
        }

        if (!rToken && req.cookies?.token) {
            rToken = req.cookies.token;
        }

        if (!rToken) {
            return res.status(400).json({
                success: false,
                message: "Refresh token is required"
            });
        }

        // Verify the refresh token - we use ignoreExpiration: true to allow refreshing an expired access token
        // In a better setup, we'd use a dedicated refresh token that lasts longer.
        const decoded = jwt.verify(rToken, process.env.JWT_SECRET, { ignoreExpiration: true });
        console.log("Decoded Token:", decoded);

        // Fetch user from shared collection
        // Fetch user from shared collection
        const user = await User.findById(decoded.id).populate("company", "name").populate("accessibleCompanies", "name");

        console.log("User found:", user ? user._id : "null");
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Create a new access token
        const token = user.getSignedJwtToken();

        // Remove password from response
        user.password = undefined;

        let profile = null;
        if (user.role === "Team") {
            profile = await TeamProfile.findOne({ user: user._id });
        } else if (user.role === "Admin") {
            profile = await AdminProfile.findOne({ user: user._id });
            if (profile) {
                const assignedClients = await ClientProfile.find({ assignedAdmin: user._id }).populate("user", "name email");
                profile = { ...profile.toObject(), assignedClients };
            }
        } else if (user.role === "Client") {
            profile = await ClientProfile.findOne({ user: user._id });
        }

        res.status(200).json({
            success: true,
            message: "Refresh token successful",
            token,
            user: {
                ...user.toObject(),
                profile,
                specialization: profile?.specialization || undefined
            }
        });

    } catch (error) {
        console.error("Refresh token error:", error);
        res.status(500).json({
            success: false,
            message: "Refresh token failed",
            error: error.message
        });
    }
};

exports.getUserPassword = async (req, res) => {
    try {
        const { userId } = req.body;

        // 1. Find User (Explicitly select password)
        const user = await User.findById(userId).select("+password");
        if (!user) return res.status(404).json({ error: "User not found" });

        // 2. Decrypt
        const realPassword = user.getDecryptedPassword();

        res.status(200).json({
            success: true,
            password: realPassword
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};