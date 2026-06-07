const User = require("../models/user");
const ClientProfile = require("../models/ClientProfile");
const ClientPackage = require("../models/ClientPackage");
const ClientSubscription = require("../models/ClientSubscription");
const PackageTemplate = require("../models/PackageTemplate");
const Schedule = require("../models/Schedule");
const mongoose = require("mongoose");

// @desc    Client App Login
// @route   POST /api/app/auth/login
// @access  Public
exports.loginClient = async (req, res) => {
    console.log("┌------------------------------------------------------------------------------");
    console.log("| [LOGIN REQUEST]");
    try {
        const { email, password } = req.body;
        console.log(`| Email: ${email}`);
        console.log(`| Password provided: ${password ? "YES" : "NO"}`);

        if (!email || !password) {
            console.log("| [ERROR] Missing email or password");
            console.log("└------------------------------------------------------------------------------");
            return res.status(400).json({ success: false, message: "Email and password are required" });
        }

        const user = await User.findOne({ email }).select("+password");
        console.log(`| User Found: ${user ? "YES" : "NO"}`);

        if (!user) {
            console.log("| [ERROR] User not found in DB");
            console.log("└------------------------------------------------------------------------------");
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        console.log(`| User Details: ID=${user._id}, Role=${user.role}, Active=${user.isActive}`);

        // Check password
        const isMatch = await user.matchPassword(password);
        console.log(`| Password Match: ${isMatch}`);

        if (!isMatch) {
            console.log("| [ERROR] Password mismatch");
            console.log("└------------------------------------------------------------------------------");
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        // Check Role
        if (user.role !== "Client") {
            console.log(`| [ERROR] Role mismatch. Expected 'Client', got '${user.role}'`);
            console.log("└------------------------------------------------------------------------------");
            return res.status(403).json({ success: false, message: "Access denied. Client account required." });
        }

        // Check Active Status
        if (!user.isActive) {
            console.log("| [ERROR] User is inactive");
            console.log("└------------------------------------------------------------------------------");
            return res.status(403).json({ success: false, message: "Account is inactive." });
        }

        const token = user.getSignedJwtToken();
        const profile = await ClientProfile.findOne({ user: user._id });
        console.log(`| Client Profile Found: ${profile ? "YES" : "NO"}`);

        console.log("| [SUCCESS] Login successful, sending token.");
        console.log("└------------------------------------------------------------------------------");

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                profile: profile
            }
        });

    } catch (error) {
        console.error("| [EXCEPTION]", error);
        console.log("└------------------------------------------------------------------------------");
        res.status(500).json({ success: false, message: "Login failed", error: error.message });
    }
};

// @desc    Get Client Dashboard Data (Current Package & Upsell)
// @route   GET /api/app/dashboard
// @access  Private (Client)
exports.getDashboard = async (req, res) => {
    console.log("┌------------------------------------------------------------------------------");
    console.log("| [DASHBOARD REQUEST]");
    try {
        const userId = req.user.id; // From middleware
        console.log(`| User ID: ${userId}`);

        // 1. Get Profile to link with Subscriptions
        const profile = await ClientProfile.findOne({ user: userId });
        console.log(`| Profile Linked: ${profile ? "YES" : "NO"}`);

        if (!profile) {
            console.log("| [ERROR] Client Profile not found");
            console.log("└------------------------------------------------------------------------------");
            return res.status(404).json({ success: false, message: "Client Profile not found" });
        }

        // 2. Fetch Active Subscription (Deliverables) - Linked to Profile
        const activeSubscription = await ClientSubscription.findOne({
            client: profile._id,
            status: "Active"
        });
        console.log(`| Active Subscription: ${activeSubscription ? "YES" : "NO"}`);

        // 3. Fetch Active Package (Payments/Dates) - Linked to User
        const activePackage = await ClientPackage.findOne({
            client: userId,
            status: "Active"
        }).sort({ createdAt: -1 }); // Get latest
        console.log(`| Active Package: ${activePackage ? "YES" : "NO"}`);

        // 4. Fetch Upsell Packages (All Active Templates)
        const upsellPackages = await PackageTemplate.find({ status: "active" });
        console.log(`| Upsell Packages Count: ${upsellPackages.length}`);

        console.log("└------------------------------------------------------------------------------");

        res.status(200).json({
            success: true,
            data: {
                subscription: activeSubscription,
                currentPackage: activePackage,
                availablePackages: upsellPackages
            }
        });

    } catch (error) {
        console.error("| [EXCEPTION]", error);
        console.log("└------------------------------------------------------------------------------");
        res.status(500).json({ success: false, message: "Failed to load dashboard", error: error.message });
    }
};

// @desc    Get Client Schedule (Calendar)
// @route   GET /api/app/schedule
// @access  Private (Client)
exports.getSchedule = async (req, res) => {
    console.log("┌------------------------------------------------------------------------------");
    console.log("| [SCHEDULE REQUEST]");
    try {
        const userId = req.user.id;
        console.log(`| User ID: ${userId}`);

        const profile = await ClientProfile.findOne({ user: userId });

        if (!profile) {
            console.log("| [ERROR] Profile not found");
            console.log("└------------------------------------------------------------------------------");
            return res.status(404).json({ success: false, message: "Client Profile not found" });
        }

        // Fetch schedules linked to this client profile
        const schedules = await Schedule.find({ client: profile._id })
            .populate("service", "name") // Populate service name if needed
            .sort({ date: 1 });

        console.log(`| Schedules Found: ${schedules.length}`);
        console.log("└------------------------------------------------------------------------------");

        res.status(200).json({
            success: true,
            count: schedules.length,
            data: schedules
        });

    } catch (error) {
        console.error("| [EXCEPTION]", error);
        console.log("└------------------------------------------------------------------------------");
        res.status(500).json({ success: false, message: "Failed to load schedule", error: error.message });
    }
};

// @desc    Get Client Profile
// @route   GET /api/app/profile
// @access  Private (Client)
exports.getProfile = async (req, res) => {
    console.log("┌------------------------------------------------------------------------------");
    console.log("| [PROFILE REQUEST]");
    try {
        const userId = req.user.id;
        console.log(`| User ID: ${userId}`);

        const user = await User.findById(userId).select("-password -role -__v");
        const profile = await ClientProfile.findOne({ user: userId });

        console.log(`| User Fetched: ${user ? "YES" : "NO"}`);
        console.log(`| Profile Fetched: ${profile ? "YES" : "NO"}`);
        console.log("└------------------------------------------------------------------------------");

        res.status(200).json({
            success: true,
            data: {
                user,
                profile
            }
        });

    } catch (error) {
        console.error("| [EXCEPTION]", error);
        console.log("└------------------------------------------------------------------------------");
        res.status(500).json({ success: false, message: "Failed to load profile", error: error.message });
    }
};
