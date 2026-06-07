const User = require("../models/user");
const Attendance = require("../models/Attendance");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const ClientPackage = require("../models/ClientPackage");
const admin = require("../config/firebase");
const TeamProfile = require("../models/TeamProfile");
const ClientProfile = require("../models/ClientProfile");
const ClientSubscription = require("../models/ClientSubscription");
const ROLE_PERMISSIONS = require("../config/roleDefaults");
const cloudinary = require("../config/cloudinary");
const CryptoJS = require("crypto-js"); // Ensure this is imported at the top
const mongoose = require("mongoose");
const Task = require("../models/Task");
const Schedule = require("../models/Schedule");
const PaymentSale = require("../models/PaymentSale");
const PaymentCollection = require("../models/PaymentCollection");
const AdminProfile = require("../models/AdminProfile");
const Company = require("../models/Company");
const { startOfDay, endOfDay, startOfMonth, endOfMonth, eachDayOfInterval, isSunday } = require("date-fns");

// Helper to calculate working days in a month (excluding Sundays)
const getWorkingDaysInMonth = (date) => {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    return allDays.filter(day => !isSunday(day)).length;
};


// Admin CRUD --------------------------------------------------------------------------------------------------------

exports.getAdmins = async (req, res) => {
    console.log("📥 [GET ADMINS] Request received");

    try {
        // Fetch from User model with role "Admin"
        const userAdmins = await User.find({ role: "Admin" }).sort({ createdAt: -1 }).lean();
        console.log(`✅ [GET ADMINS] Found ${userAdmins.length} admins`);

        // Fetch profiles
        const userAdminIds = userAdmins.map(u => u._id);
        const adminProfiles = await AdminProfile.find({ user: { $in: userAdminIds } }).lean();
        const profileMap = new Map();
        adminProfiles.forEach(p => profileMap.set(p.user.toString(), p));

        // Format
        const allAdmins = await Promise.all(userAdmins.map(async (user) => {
            const profile = profileMap.get(user._id.toString()) || {};
            const teamMembers = await User.find({ managedBy: user._id, role: "Team" }, "_id name email");

            return {
                ...profile,
                ...user,
                assignedTeamMembers: teamMembers,
                profile: { ...profile, ...user },
                profileId: profile._id,
                _id: user._id // Explicitly enforce User ID
            };
        }));

        return res.status(200).json({
            success: true,
            count: allAdmins.length,
            data: allAdmins,
        });
    } catch (error) {
        console.error("❌ [GET ADMINS] Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch admins",
            error: error.message,
        });
    }
};

exports.getSuperAdmins = async (req, res) => {
    console.log("📥 [GET USERS] Request received");

    try {
        let query = { role: "Superadmin" };
        const users = await User.find(query);
        console.log(`✅ [GET USERS] Found ${users.length} users`);

        return res.status(200).json({
            success: true,
            count: users.length,
            data: users,
        });
    } catch (error) {
        console.error("❌ [GET USERS] Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch users",
            error: error.message,
        });
    }
};

exports.createAdmin = async (req, res) => {
    console.log("📥 [CREATE ADMIN] Request received:", req.body);

    try {
        const { role, permissions, phone, assignedTeamMembers, ...otherData } = req.body;

        // ... (phone cleaning logic) ...
        let cleanPhone = phone.replace(/\D/g, "");
        if (cleanPhone.length > 10) {
            cleanPhone = cleanPhone.slice(cleanPhone.length - 10);
        }

        if (cleanPhone.length !== 10) {
            return res.status(400).json({ success: false, message: "Invalid phone number format" });
        }

        let assignedPermissions = permissions;
        if (!assignedPermissions) {
            assignedPermissions = ROLE_PERMISSIONS[role || "Admin"] || [];
        }

        // 2. Check if email exists in User collection
        const { email } = otherData;
        if (email) {
            const emailExists = await User.findOne({ email });

            if (emailExists) {
                console.log(`⚠️ [CREATE ADMIN] Email conflict: ${email}`);
                return res.status(400).json({
                    success: false,
                    message: "Email already exists in the system",
                    error: "DUPLICATE_EMAIL"
                });
            }
        }

        // 3. Create NEW Architecture: User + AdminProfile
        const finalRole = (req.user.role === 'Superadmin' && otherData.role) ? otherData.role : "Admin";

        const user = await User.create({
            ...otherData,
            phone: cleanPhone,
            role: finalRole,
            customPermissions: assignedPermissions,
            password: otherData.password // Hashed in User model
        });

        let profile = null;
        if (finalRole === "Admin") {
            profile = await AdminProfile.create({
                user: user._id,
                ...otherData,
                specialization: otherData.specialization || "Management"
            });

            // 🔗 Assign Team Members to this Admin
            if (assignedTeamMembers && Array.isArray(assignedTeamMembers)) {
                await User.updateMany({ _id: { $in: assignedTeamMembers }, role: "Team" }, { $set: { managedBy: user._id } });
            }

            // 🔗 Assign Clients to this Admin
            if (req.body.assignedClients && Array.isArray(req.body.assignedClients)) {
                await ClientProfile.updateMany({ _id: { $in: req.body.assignedClients } }, { $set: { assignedAdmin: user._id } });
            }
        }

        console.log(`✅ [CREATE ADMIN] User-based ${finalRole} created: ${user._id}`);

        const responseData = profile
            ? { ...profile.toObject(), ...user.toObject(), profile: { ...profile.toObject(), ...user.toObject() }, _id: user._id }
            : { ...user.toObject() };

        return res.status(201).json({
            success: true,
            data: responseData
        });
    } catch (error) {
        console.log("❌ [CREATE ADMIN] Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to create admin",
            error: error.message
        });
    }
};

// @desc    Create NEW Superadmin (Simplified)
exports.createSuperAdmin = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "Name, Email and Password are required" });
        }

        // Check if email exists
        const emailExists = await User.findOne({ email });
        if (emailExists) {
            return res.status(400).json({ success: false, message: "Email already exists" });
        }

        const permissions = ROLE_PERMISSIONS["Superadmin"] || [];

        const user = await User.create({
            name,
            email,
            password,
            phone,
            role: "Superadmin",
            customPermissions: permissions
        });

        console.log(`✅ [CREATE SUPERADMIN] Created: ${user._id}`);

        res.status(201).json({
            success: true,
            data: user
        });
    }
    catch (error) {
        console.error("❌ [CREATE SUPERADMIN] Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateAdmin = async (req, res) => {
    console.log(`📥 [UPDATE ADMIN] Request received for ID: ${req.params.id}`);

    try {
        const {
            specialization, skills, salary, experience,
            street, city, state, country,
            emergency1Name, emergency1Phone, emergency2Name, emergency2Phone,
            notes, timing, bankInfo,
            assignedTeamMembers,
            ...userData
        } = req.body;

        delete userData._id;
        delete userData.createdAt;
        delete userData.updatedAt;
        delete userData.__v;

        if (userData.phone) {
            let cleanPhone = userData.phone.replace(/\D/g, "");
            if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
            userData.phone = cleanPhone;
        }

        if (userData.email) {
            const emailExists = await User.findOne({
                email: userData.email,
                _id: { $ne: req.params.id }
            });

            if (emailExists) {
                return res.status(400).json({
                    success: false,
                    message: "Email already exists in the system",
                    error: "DUPLICATE_EMAIL"
                });
            }
        }

        const updatePayload = {
            ...userData,
            specialization,
            skills,
            salary,
            experience,
            address: { street, city, state, country },
            emergencyContact1: { name: emergency1Name, phone: emergency1Phone },
            emergencyContact2: { name: emergency2Name, phone: emergency2Phone },
            notes,
            timing,
            bankInfo
        };

        const user = await User.findByIdAndUpdate(
            req.params.id,
            userData,
            { new: true, runValidators: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        let admin = user.toObject();

        if (user.role !== "Superadmin") {
            const profile = await AdminProfile.findOneAndUpdate(
                { user: user._id },
                updatePayload,
                { new: true, upsert: true }
            );

            admin = {
                ...profile.toObject(),
                ...user.toObject(),
                profile: { ...profile.toObject(), ...user.toObject() },
                _id: user._id
            };
        }

        if (assignedTeamMembers && Array.isArray(assignedTeamMembers)) {
            await User.updateMany({ managedBy: admin._id }, { $unset: { managedBy: "" } });
            await User.updateMany({ _id: { $in: assignedTeamMembers } }, { $set: { managedBy: admin._id } });
        }

        if (req.body.assignedClients && Array.isArray(req.body.assignedClients)) {
            await ClientProfile.updateMany({ assignedAdmin: admin._id }, { $set: { assignedAdmin: null } });
            await ClientProfile.updateMany({ _id: { $in: req.body.assignedClients } }, { $set: { assignedAdmin: admin._id } });
        }

        // ✅ KEEP RESPONSE INSIDE TRY
        return res.status(200).json({
            success: true,
            data: {
                ...admin,
                profile: admin
            },
        });

    } catch (error) {
        console.log("❌ [UPDATE ADMIN] Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to update admin",
            error: error.message
        });
    }
};

exports.deleteAdmin = async (req, res) => {
    try {
        const { id } = req.body;
        const protectedId = "6937fe0349d2dc6bcc353c15";
        if (id === protectedId) {
            return res.status(403).json({ success: false, message: "This user cannot be deleted" });
        }

        // 2. Try User + AdminProfile
        const user = await User.findById(id);
        let adminMember = null;
        if (user && user.role === "Admin") {
            await AdminProfile.findOneAndDelete({ user: id });
            await User.findByIdAndDelete(id);
            adminMember = { _id: id };
        }

        if (!adminMember) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }

        return res.status(200).json({
            success: true,
            message: "Admin deleted successfully",
            data: { id: adminMember._id }
        });

    } catch (error) {
        console.error("❌ [DELETE ADMIN] Error:", error.message);
        return res.status(500).json({
            success: false,
            message: "Failed to delete admin",
            error: error.message,
        });
    }
};

exports.updateAdminStatus = async (req, res) => {
    console.log("📥 [UPDATE ADMIN STATUS] Request received:", req.body);

    try {
        const { id, status, isActive } = req.body;
        const updateData = {};
        if (status) updateData.status = status;
        if (typeof isActive !== "undefined") updateData.isActive = isActive;

        const admin = await User.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!admin) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }

        console.log(`✅ [UPDATE ADMIN STATUS] Updated successfully: ${admin._id}`);

        return res.status(200).json({
            success: true,
            message: "Admin status updated successfully",
            data: admin
        });
    } catch (error) {
        console.error("❌ [UPDATE ADMIN STATUS] Error:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

exports.getAdminById = async (req, res) => {
    try {
        const { id } = req.body;

        const user = await User.findById(id).select("-password");

        if (!user || user.role !== "Admin") {
            return res.status(404).json({ error: "Admin not found" });
        }

        const profile = await AdminProfile.findOne({ user: user._id }).lean();
        const teamMembers = await User.find({ managedBy: user._id, role: "Team" }, "_id name email");
        const assignedClients = await ClientProfile.find({ assignedAdmin: user._id }).populate("user", "name email");

        return res.json({
            success: true,
            data: {
                ...profile,
                ...user.toObject(),
                assignedTeamMembers: teamMembers,
                assignedClients: assignedClients,
                profile: { ...profile, ...user.toObject() },
                _id: user._id
            }
        });
    } catch (err) {
        console.error("❌ Error fetching admin:", err);
        res.status(500).json({ error: "Server error" });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ success: false, message: "Password is required" });
        }

        const secret = process.env.CRYPTO_SECRET || process.env.JWT_SECRET;
        const encryptedPassword = CryptoJS.AES.encrypt(password, secret).toString();

        // Target User
        const user = await User.findByIdAndUpdate(id, { password: encryptedPassword }, { new: true });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        console.log(`✅ [RESET PASSWORD] Password updated for: ${user._id} (${user.role})`);

        return res.status(200).json({
            success: true,
            message: "Password updated successfully",
        });
    } catch (err) {
        console.error("❌ Error resetting password:", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
};

// Team CRUD --------------------------------------------------------------------------------------------------------

exports.createTeam = async (req, res) => {
    try {
        const {
            name, email, phone, password,
            specialization, skills, salary, experience,
            permissions, street, city, state, country,
            emergency1Name, emergency1Phone, emergency2Name, emergency2Phone,
            notes, timing, bankInfo, managedBy
        } = req.body;

        // 📸 Handle profilePic
        let profilePic = null;
        if (req.file) {
            profilePic = {
                public_id: req.file.filename,
                url: req.file.path,
            };
        }

        let role = "Team";
        let assignedPermissions = permissions || ROLE_PERMISSIONS[role] || [];

        // Check if email exists in User collection
        if (email) {
            const emailExists = await User.findOne({ email });

            if (emailExists) {
                console.log(`⚠️ [CREATE TEAM] Email conflict: ${email}`);
                return res.status(400).json({
                    success: false,
                    message: "Email already exists in the system",
                    error: "DUPLICATE_EMAIL"
                });
            }
        }

        // 3. Create NEW Architecture: User + TeamProfile
        const user = await User.create({
            name,
            email,
            phone,
            password,
            role,
            profilePic,
            status: "Active",
            isActive: true,
            customPermissions: assignedPermissions,
            managedBy: req.user.role === "Admin" ? req.user._id : managedBy
        });

        const profile = await TeamProfile.create({
            user: user._id,
            specialization,
            skills: typeof skills === "string" ? skills.split(",").map(s => s.trim()) : skills,
            salary,
            experience,
            address: { street, city, state, country },
            emergencyContact1: { name: emergency1Name, phone: emergency1Phone },
            emergencyContact2: { name: emergency2Name, phone: emergency2Phone },
            notes,
            timing,
            bankInfo
        });

        console.log(`✅ [CREATE TEAM] User-based Team member created: ${user._id}`);

        return res.status(201).json({
            success: true,
            data: { ...user.toObject(), ...profile.toObject(), profile: { ...user.toObject(), ...profile.toObject() } }
        });
    } catch (error) {
        console.error("❌ Create Team Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create team member",
            error: error.message
        });
    }
};

exports.getTeams = async (req, res) => {
    try {
        console.log(`📥 [GET TEAMS] User Role: ${req.user.role}, ID: ${req.user.id}`);

        let query = { role: "Team" };
        if (req.user.role === "Admin") {
            query.managedBy = req.user.id;
        }

        const users = await User.find(query).sort({ createdAt: -1 }).lean();
        console.log(`✅ [GET TEAMS] Found ${users.length} team members`);

        // Fetch profiles
        const userIds = users.map(u => u._id);
        const profiles = await TeamProfile.find({ user: { $in: userIds } }).lean();
        const profileMap = new Map();
        profiles.forEach(p => profileMap.set(p.user.toString(), p));

        // Dates for filtering
        const today = new Date();
        const startDay = startOfDay(today);
        const endDay = endOfDay(today);
        const startMonth = startOfMonth(today);
        const endMonth = endOfMonth(today);

        // Fetch all relevant tasks for daily and monthly performance in bulk
        const [dailyTasks, monthlyTasks, allAttendance] = await Promise.all([
            Task.find({
                assignedTo: { $in: userIds },
                dueDate: { $gte: startDay, $lte: endDay }
            }).lean(),
            Task.find({
                assignedTo: { $in: userIds },
                dueDate: { $gte: startMonth, $lte: endMonth }
            }).lean(),
            Attendance.find({
                user: { $in: userIds },
                date: { $gte: startMonth, $lte: endMonth }
            }).lean()
        ]);

        console.log(`📊 [GET TEAMS] Bulk Data Fetched: Daily Tasks: ${dailyTasks.length}, Monthly Tasks: ${monthlyTasks.length}, Total Attendance Records: ${allAttendance.length}`);

        // Group tasks and attendance by user for quick lookup
        const dailyTaskMap = new Map();
        const monthlyTaskMap = new Map();
        const attendanceMap = new Map();

        userIds.forEach(id => {
            const idStr = id.toString();
            dailyTaskMap.set(idStr, dailyTasks.filter(t => t.assignedTo.toString() === idStr));
            monthlyTaskMap.set(idStr, monthlyTasks.filter(t => t.assignedTo.toString() === idStr));
            attendanceMap.set(idStr, allAttendance.filter(a => a.user.toString() === idStr));
        });

        const totalWorkingDays = getWorkingDaysInMonth(today);

        // Format with Performance Stats
        const formattedTeams = users.map((user) => {
            const idStr = user._id.toString();
            const profile = profileMap.get(idStr) || {};

            // Daily Performance
            const userDailyTasks = dailyTaskMap.get(idStr) || [];
            const dailyTotal = userDailyTasks.length;
            const dailyDone = profile.specialization === "video"
                ? userDailyTasks.filter(t => ["approved", "done"].includes(t.status?.toLowerCase())).length
                : userDailyTasks.filter(t => ["done", "posted", "approved"].includes(t.status?.toLowerCase())).length;
            const dailyPercentage = dailyTotal > 0 ? Number(((dailyDone / dailyTotal) * 100).toFixed(2)) : 0;

            // Monthly Performance
            const userMonthlyTasks = monthlyTaskMap.get(idStr) || [];
            const monthlyTotal = userMonthlyTasks.length;
            const monthlyDone = profile.specialization === "video"
                ? userMonthlyTasks.filter(t => ["approved", "done"].includes(t.status?.toLowerCase())).length
                : userMonthlyTasks.filter(t => ["done", "posted", "approved"].includes(t.status?.toLowerCase())).length;
            const monthlyPercentage = monthlyTotal > 0 ? Number(((monthlyDone / monthlyTotal) * 100).toFixed(2)) : 0;

            // Attendance Monthly
            const userAttendance = attendanceMap.get(idStr) || [];
            const fullDays = userAttendance.filter(r => r.status === 'Full Day').length;
            const halfDays = userAttendance.filter(r => r.status === 'Half Day').length;
            const leaves = userAttendance.filter(r => r.status === 'Leave').length;
            const presentCount = fullDays + halfDays; // Still keeping presentCount for backward compatibility if needed

            console.log(`👤 Member: ${user.name} (${idStr}) | Full: ${fullDays}, Half: ${halfDays}, Leave: ${leaves}, Total Records: ${userAttendance.length}`);

            return {
                ...profile,
                ...user,
                performance: {
                    daily: { total: dailyTotal, done: dailyDone, percentage: dailyPercentage },
                    monthly: { total: monthlyTotal, done: monthlyDone, percentage: monthlyPercentage },
                    attendance: {
                        present: presentCount,
                        fullDays,
                        halfDays,
                        leaves,
                        totalDays: totalWorkingDays
                    }
                },
                profile: { ...profile, ...user },
                profileId: profile._id,
                _id: user._id // Explicitly enforce User ID
            };
        });

        return res.status(200).json({
            success: true,
            count: formattedTeams.length,
            data: formattedTeams,
        });

    } catch (error) {
        console.error("❌ [GET TEAMS] Error:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};

exports.getTeamById = async (req, res) => {
    try {
        const { id } = req.body;

        // Target User + TeamProfile
        const user = await User.findById(id);

        if (!user || user.role !== "Team") {
            return res.status(404).json({ success: false, message: "Team member not found" });
        }

        const profile = await TeamProfile.findOne({ user: user._id }).lean();

        return res.status(200).json({
            success: true,
            data: { ...profile, ...user.toObject(), profile: { ...profile, ...user.toObject() }, _id: user._id }
        });
    } catch (error) {
        console.error("❌ Get Team Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

exports.updateTeamStatus = async (req, res) => {
    try {
        const { id, status, isActive } = req.body;

        const updateData = {
            ...(status && { status }),
            ...(isActive !== undefined && { isActive })
        };

        const user = await User.findByIdAndUpdate(id, updateData, { new: true });

        if (!user) {
            return res.status(404).json({ success: false, message: "Team not found" });
        }

        return res.status(200).json({
            success: true,
            message: "Team status updated successfully",
            data: user
        });
    } catch (error) {
        console.error("❌ Update Team Status Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

exports.updateTeam = async (req, res) => {
    try {
        const userId = req.params.id;
        console.log(`👤 [UPDATE TEAM] User ID: ${userId}`);

        const {
            name, email, phone, specialization, skills, salary, experience,
            street, city, state, country,
            emergency1Name, emergency1Phone, emergency2Name, emergency2Phone,
            notes, timing, bankInfo, status, isActive, role
        } = req.body;

        // Clean phone
        let cleanPhone = phone;
        if (phone) {
            cleanPhone = phone.replace(/\D/g, "");
            if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
        }

        // Check if email exists in User collection
        if (email) {
            const emailExists = await User.findOne({ email, _id: { $ne: userId } });

            if (emailExists) {
                console.log(`⚠️ [UPDATE TEAM] Email conflict: ${email}`);
                return res.status(400).json({
                    success: false,
                    message: "Email already exists in the system",
                    error: "DUPLICATE_EMAIL"
                });
            }
        }

        const updatePayload = {
            specialization,
            skills: typeof skills === "string" ? skills.split(",").map(s => s.trim()) : skills,
            salary,
            experience,
            address: { street, city, state, country },
            emergencyContact1: { name: emergency1Name, phone: emergency1Phone },
            emergencyContact2: { name: emergency2Name, phone: emergency2Phone },
            notes,
            timing,
            bankInfo
        };

        // 📸 Handle profilePic upload
        let profilePicUpdate = {};
        if (req.file) {
            const existingUser = await User.findById(userId);
            if (existingUser?.profilePic?.public_id) {
                await cloudinary.uploader.destroy(existingUser.profilePic.public_id);
            }
            profilePicUpdate.profilePic = { public_id: req.file.filename, url: req.file.path };
        }

        const userUpdates = {
            ...(name && { name }),
            ...(email && { email }),
            ...(phone && { phone: cleanPhone }),
            ...(role && { role }),
            ...(status && { status }),
            ...(isActive !== undefined && { isActive }),
            ...profilePicUpdate,
        };

        const user = await User.findByIdAndUpdate(userId, userUpdates, { new: true }).select("-password");

        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const profile = await TeamProfile.findOneAndUpdate(
            { user: userId },
            updatePayload,
            { new: true, upsert: true }
        );

        return res.status(200).json({
            success: true,
            data: { ...profile.toObject(), ...user.toObject(), profile: { ...profile.toObject(), ...user.toObject() }, _id: user._id }
        });

    } catch (error) {
        console.error(`❌ [UPDATE TEAM] ERROR:`, error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

exports.deleteTeam = async (req, res) => {
    try {
        const userId = req.params.id;

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "Team member not found" });
        }

        // Delete the user
        await User.deleteOne({ _id: userId });

        // Delete associated TeamProfile
        await TeamProfile.deleteOne({ user: new mongoose.Types.ObjectId(userId) });

        // Remove from all clients who had this team member assigned
        await ClientProfile.updateMany(
            { assignedTeam: new mongoose.Types.ObjectId(userId) },
            { $pull: { assignedTeam: new mongoose.Types.ObjectId(userId) } }
        );

        res.status(200).json({
            success: true,
            message: "Team member deleted successfully",
        });
    } catch (error) {
        console.error("❌ Error deleting team:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// ------ Client Crud ---------------------------------------------------------------------------------------------------

function formatClientResponse(user, profile, subscriptions = [], hasChutakItems = false) {
    if (!user || !profile) return null;

    return {
        id: profile._id ? profile._id.toString() : "",
        user: user._id ? user._id.toString() : "",
        name: user.name || "",
        email: user.email || "",
        phone: user.phone || "",
        avatarUrl: user.avatarUrl || "",
        password: undefined, // never send password

        // Business Info
        businessName: profile.businessName || "",
        businessPhone: profile.businessPhone || "",
        businessEmail: profile.businessEmail || "",
        city: profile.city || "",
        state: profile.state || "",
        country: profile.country || "India",
        businessAddress: profile.businessAddress || "",
        industry: profile.industry || "",
        website: profile.website || "",

        socials: {
            facebookId: profile.socials?.facebookId || "",
            facebookPassword: profile.socials?.facebookPassword || "",
            instagramId: profile.socials?.instagramId || "",
            instagramPassword: profile.socials?.instagramPassword || "",
        },

        assignedTeamIds: profile.assignedTeam?.map(id => (id._id ? id._id.toString() : id.toString())) || [],
        assignedAdminId: profile.assignedAdmin ? (profile.assignedAdmin._id ? profile.assignedAdmin._id.toString() : profile.assignedAdmin.toString()) : null,
        status: (subscriptions && subscriptions.some(s => s.status === "Active")) ? "Active" : "Onboarding",
        joinedDate: profile.joinedDate?.toISOString() || "",
        hasChutakItems,

        subscriptions: (subscriptions || []).map(sub => ({
            id: sub._id,
            packageTemplateId: sub.packageTemplate?._id || null,
            packageName: sub.packageTemplate?.packageName || "Custom Package",
            packagePrice: sub.packageTemplate?.sellingPrice || 0,
            startDate: sub.startDate,
            endDate: sub.endDate,
            status: sub.status,
            deliverables: sub.deliverables
        }))
    };
}

exports.createClient = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        console.log("[Client] Create request body:", req.body);

        const {
            name,
            email,
            phone,
            password,
            avatarUrl,

            businessName,
            businessPhone,
            businessEmail,
            city,
            state,
            country,
            businessAddress,
            industry,
            website,

            // Resilience: check both socials object and root level
            socials,
            facebookId,
            facebookPassword,
            instagramId,
            instagramPassword,

            assignedAdmin,
            assignedTeam,
            assignedTeamIds
        } = req.body;

        // ---- 1. Create USER ----
        const [user] = await User.create([{
            name,
            email,
            phone,
            password,
            avatarUrl,
            role: "Client",
            status: "Active",
        }], { session });

        // ---- 2. Create PROFILE ----
        const [profile] = await ClientProfile.create([{
            user: user._id,
            businessName,
            businessPhone,
            businessEmail,
            city,
            state,
            country,
            businessAddress,
            industry,
            website,
            socials: {
                facebookId: facebookId || socials?.facebookId || "",
                facebookPassword: facebookPassword || socials?.facebookPassword || "",
                instagramId: instagramId || socials?.instagramId || "",
                instagramPassword: instagramPassword || socials?.instagramPassword || "",
            },
            assignedAdmin: assignedAdmin || null,
            assignedTeam: assignedTeam || assignedTeamIds || [],
        }], { session });

        console.log("[Client] Profile created:", profile._id);

        // Populate user in profile for formatting
        await profile.populate("user", "-password");

        await session.commitTransaction();
        session.endSession();

        const formatted = formatClientResponse(profile.user, profile);

        return res.status(201).json({
            success: true,
            message: "Client created successfully",
            data: formatted
        });

    } catch (error) {
        console.error("[Client] Error creating client:", error);

        await session.abortTransaction();
        session.endSession();

        return res.status(500).json({
            success: false,
            message: "Failed to create client",
            error: error.message
        });
    }
};

// ----------------------------------------------------
// Get All Clients (Merged user + profile)
// ----------------------------------------------------
exports.getAllClients = async (req, res) => {
    try {
        console.log("[Client] Fetching all clients...");

        let query = {};
        if (req.user.role === "Admin") {
            query.assignedAdmin = req.user.id;
        }

        const profiles = await ClientProfile.find(query)
            .populate("user", "-password")
            .populate("assignedAdmin", "name email avatarUrl role")
            .populate("assignedTeam", "name email avatarUrl role");

        // Fetch subscriptions for all these profiles
        const profileIds = profiles.map(p => p._id);
        console.log("[Client] Profile IDs:", profileIds);
        const subs = await ClientSubscription.find({
            client: { $in: profileIds },
            status: { $in: ["Active", "Completed"] }
        }).populate("packageTemplate", "packageName sellingPrice");

        // Fetch distinct clients who have chutak items
        const chutakClientIdsObjects = await Schedule.distinct("client", { isChutak: true });
        const chutakClientIds = chutakClientIdsObjects.map(id => id.toString());

        console.log("[Client] Subscriptions fetched:", subs);

        if (!profiles || profiles.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No clients found.",
                data: []
            });
        }

        const today = new Date();
        const formatted = await Promise.all(profiles.map(async (profile) => {
            if (!profile.user) return null;
            
            // 1. Filter subs for this profile
            let clientSubs = subs.filter(s => s.client.toString() === profile._id.toString());
            
            // 2. Check for expired plans (Real-time Janitor)
            let hasActive = false;
            for (const sub of clientSubs) {
                if (sub.status === "Active") {
                    if (today > new Date(sub.endDate)) {
                        sub.status = "Completed";
                        await sub.save();
                    } else {
                        hasActive = true;
                    }
                }
            }

            // 3. Sync Profile Status with subscription reality
            if (!hasActive && profile.clientStatus === "Active") {
                profile.clientStatus = "Onboarding";
                await profile.save();
            } else if (hasActive && profile.clientStatus !== "Active") {
                profile.clientStatus = "Active";
                await profile.save();
            }

            const hasChutakItems = chutakClientIds.includes(profile._id.toString());
            return formatClientResponse(profile.user, profile, clientSubs, hasChutakItems);
        }));

        const finalFormatted = formatted.filter(item => item !== null);

        // console.log(
        //     "[Client] Formatted clients:",
        //     JSON.stringify(formatted, null, 2)
        // );

        console.log("[Client] Formatted clients:", finalFormatted.length);

        return res.status(200).json({
            success: true,
            message: "Clients fetched successfully",
            data: finalFormatted
        });

    } catch (error) {
        console.error("[Client] Error fetching clients:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

// ----------------------------------------------------
// Get Client By ID (Merged)
// ----------------------------------------------------
exports.getClientById = async (req, res) => {
    try {
        const { id } = req.body;
        console.log("[Client] Fetching client by ID:", id);

        const profile = await ClientProfile.findOne({ user: id })
            .populate("user", "-password")
            .populate("assignedAdmin", "name email avatarUrl role")
            .populate("assignedTeam", "name email avatarUrl role");

        if (!profile) {
            return res.status(404).json({
                success: false,
                message: "Client not found"
            });
        }

        const subscriptions = await ClientSubscription.find({ client: profile._id })
            .populate("packageTemplate", "packageName sellingPrice");

        const hasChutakItemsObj = await Schedule.findOne({ client: profile._id, isChutak: true });
        const hasChutakItems = !!hasChutakItemsObj;

        const formatted = formatClientResponse(profile.user, profile, subscriptions, hasChutakItems);

        return res.status(200).json({
            success: true,
            message: "Client fetched successfully",
            data: formatted
        });

    } catch (error) {
        console.error("[Client] Error fetching client:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

// ----------------------------------------------------
// UPDATE CLIENT
// ----------------------------------------------------
exports.updateClient = async (req, res) => {
    try {
        const clientProfileId = req.params.id;

        console.log("\n================ CLIENT UPDATE START ================");
        console.log("[Client] Profile ID (from params):", clientProfileId);
        console.log("[Client] Raw Request Body:", JSON.stringify(req.body, null, 2));

        // 1. Fetch ClientProfile to get userId
        const existingProfile = await ClientProfile.findById(clientProfileId);
        if (!existingProfile) {
            console.log("[Client] ClientProfile not found with ID:", clientProfileId);
            return res.status(404).json({ success: false, message: "Client Profile not found" });
        }

        const userId = existingProfile.user;
        console.log("[Client] Found associated User ID:", userId);

        const {
            name,
            email,
            phone,
            avatarUrl,
            // user, // removing this as we derived userId from profile
            businessName,
            businessPhone,
            businessEmail,
            city,
            state,
            country,
            businessAddress,
            industry,
            website,
            assignedAdmin,
            assignedTeam,
            clientStatus
        } = req.body;

        const { socials = {} } = req.body;

        const {
            facebookId,
            facebookPassword,
            instagramId,
            instagramPassword
        } = socials;

        // ----------------------------
        // USER UPDATE PAYLOAD
        // ----------------------------
        const userUpdatePayload = {
            ...(name && { name }),
            ...(email && { email }),
            ...(phone && { phone }),
            ...(avatarUrl && { avatarUrl }),
        };

        console.log("[Client] User Update Payload:", userUpdatePayload);

        const user = await User.findByIdAndUpdate(
            userId,
            userUpdatePayload,
            { new: true }
        ).select("-password");

        if (!user) {
            console.log("[Client] User not found");
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // ----------------------------
        // PROFILE UPDATE PAYLOAD
        // ----------------------------
        const profileUpdatePayload = {
            ...(businessName && { businessName }),
            ...(businessPhone && { businessPhone }),
            ...(businessEmail && { businessEmail }),
            ...(city && { city }),
            ...(state && { state }),
            ...(country && { country }),
            ...(businessAddress && { businessAddress }),
            ...(industry && { industry }),
            ...(website && { website }),

            // ✅ SAFE SOCIAL MERGE
            ...(facebookId && { "socials.facebookId": facebookId }),
            ...(facebookPassword && { "socials.facebookPassword": facebookPassword }),
            ...(instagramId && { "socials.instagramId": instagramId }),
            ...(instagramPassword && { "socials.instagramPassword": instagramPassword }),

            assignedAdmin: assignedAdmin || null,
            ...(Array.isArray(assignedTeam) && { assignedTeam }),
            ...(clientStatus && { clientStatus }),
        };

        console.log("[Client] Profile Update Payload:", profileUpdatePayload);

        // Update using the same profile instance or findByIdAndUpdate with clientProfileId
        const profile = await ClientProfile.findByIdAndUpdate(
            clientProfileId,
            profileUpdatePayload,
            { new: true }
        );

        if (!profile) {
            console.log("[Client] ClientProfile not found during update (unexpected)");
        }

        // Fetch subscriptions to ensure dynamic status mapping works
        const subscriptions = await ClientSubscription.find({
            client: profile._id,
            status: "Active"
        }).populate("packageTemplate", "packageName sellingPrice");

        const formatted = formatClientResponse(user, profile, subscriptions);

        console.log("[Client] Final Formatted Response:", JSON.stringify(formatted, null, 2));
        console.log("================ CLIENT UPDATE END =================\n");

        return res.status(200).json({
            success: true,
            message: "Client updated successfully",
            data: formatted
        });

    } catch (error) {
        console.error("[Client] Error updating client:", error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ----------------------------------------------------
// FETCH CLIENT DELETION PREVIEW (Counts)
// ----------------------------------------------------
exports.getClientDeletionPreview = async (req, res) => {
    try {
        const id = req.params.id;

        // Resolve profile and user IDs
        let profile = await ClientProfile.findById(id);
        let user = null;
        if (!profile) {
            user = await User.findById(id);
            if (user) profile = await ClientProfile.findOne({ user: user._id });
        } else {
            user = await User.findById(profile.user);
        }

        if (!user || !profile) {
            return res.status(404).json({ success: false, message: "Client not found" });
        }

        const profileId = profile._id;
        const userId = user._id;

        const [scheduledCount, unscheduledCount, completedScheduleCount, pendingTasks, completedTasks, paymentSales, subscriptions, packages] = await Promise.all([
            Schedule.countDocuments({ client: profileId, status: "Scheduled" }),
            Schedule.countDocuments({ client: profileId, status: "Unscheduled" }),
            Schedule.countDocuments({ client: profileId, status: "Completed" }),
            Task.countDocuments({ client: profileId, status: { $nin: ["Done", "Approved", "Posted"] } }),
            Task.countDocuments({ client: profileId, status: { $in: ["Done", "Approved", "Posted"] } }),
            PaymentSale.countDocuments({ client: profileId }),
            ClientSubscription.countDocuments({ client: profileId }),
            ClientPackage.countDocuments({ client: userId }),
        ]);

        // Count collections linked to this client's sales
        const saleIds = await PaymentSale.find({ client: profileId }).select("_id").lean();
        const collectionCount = saleIds.length > 0
            ? await PaymentCollection.countDocuments({ saleId: { $in: saleIds.map(s => s._id) } })
            : 0;

        return res.status(200).json({
            success: true,
            data: {
                clientName: user.name,
                profileId: profileId,
                userId: userId,
                counts: {
                    scheduledContent: scheduledCount,
                    unscheduledContent: unscheduledCount,
                    completedContent: completedScheduleCount,
                    pendingTasks: pendingTasks,
                    completedTasks: completedTasks,
                    paymentSales: paymentSales,
                    paymentCollections: collectionCount,
                    subscriptions: subscriptions,
                    packages: packages,
                }
            }
        });

    } catch (error) {
        console.error("[Client] Deletion preview error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

// ----------------------------------------------------
// DELETE CLIENT (Selective Cascade)
// ----------------------------------------------------
exports.deleteClient = async (req, res) => {
    try {
        const id = req.params.id;
        const {
            deleteScheduled = true,
            deleteUnscheduled = true,
            deleteTasks = true,
            deletePaymentSales = true,
            deleteCollections = true,
            deletePackages = true,
            deleteSubscriptions = true,
        } = req.body || {};

        console.log("[Client] Deleting client with ID:", id);

        // Resolve profile and user IDs
        let profile = await ClientProfile.findById(id);
        let user = null;
        if (!profile) {
            user = await User.findById(id);
            if (user) profile = await ClientProfile.findOne({ user: user._id });
        } else {
            user = await User.findById(profile.user);
        }

        if (!user || !profile) {
            return res.status(404).json({ success: false, message: "Client not found or already deleted" });
        }

        const profileId = profile._id;
        const userId = user._id;
        const summary = {};

        console.log(`[Client] Cascading deletion for Profile: ${profileId}, User: ${userId}`);

        // ---- SELECTIVE CASCADE DELETIONS ----

        if (deleteScheduled) {
            const r = await Schedule.deleteMany({
                client: profileId,
                status: { $in: ["Scheduled", "Completed"] }
            });
            summary.scheduledDeleted = r.deletedCount;
        }

        if (deleteUnscheduled) {
            const r = await Schedule.deleteMany({
                client: profileId,
                status: "Unscheduled"
            });
            summary.unscheduledDeleted = r.deletedCount;
        }

        if (deleteTasks) {
            const r = await Task.deleteMany({ client: profileId });
            summary.tasksDeleted = r.deletedCount;
        }

        if (deletePaymentSales) {
            // First get sale IDs to delete linked collections
            const saleIds = await PaymentSale.find({ client: profileId }).select("_id").lean();

            if (deleteCollections && saleIds.length > 0) {
                const r = await PaymentCollection.deleteMany({ saleId: { $in: saleIds.map(s => s._id) } });
                summary.collectionsDeleted = r.deletedCount;
            }

            const r = await PaymentSale.deleteMany({ client: profileId });
            summary.salesDeleted = r.deletedCount;
        } else if (deleteCollections) {
            // Delete collections even if sales are kept
            const saleIds = await PaymentSale.find({ client: profileId }).select("_id").lean();
            if (saleIds.length > 0) {
                const r = await PaymentCollection.deleteMany({ saleId: { $in: saleIds.map(s => s._id) } });
                summary.collectionsDeleted = r.deletedCount;
            }
        }

        if (deleteSubscriptions) {
            const r = await ClientSubscription.deleteMany({ client: profileId });
            summary.subscriptionsDeleted = r.deletedCount;
        }

        if (deletePackages) {
            const r = await ClientPackage.deleteMany({ client: userId });
            summary.packagesDeleted = r.deletedCount;
        }

        // ALWAYS delete profile and user
        await ClientProfile.findByIdAndDelete(profileId);
        await User.findByIdAndDelete(userId);

        console.log("[Client] Deletion summary:", summary);

        return res.status(200).json({
            success: true,
            message: "Client and selected data deleted successfully",
            data: { id: profileId, summary }
        });

    } catch (error) {
        console.error("[Client] Error during cascading deletion:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};



// ----------------------------------------------------------------------------------------------------------------------

exports.registerUser = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;
        console.log("Registering user:", { name, email, phone });

        if (!email || !password)
            return res.status(400).json({ error: "Email & password required" });

        const userExists = await User.findOne({ email });
        if (userExists) return res.status(409).json({ error: "Email already exists" });

        const hashed = await bcrypt.hash(password, 10);
        const user = new User({ name, email, phone, password: hashed });
        await user.save();

        res.status(201).json({ success: true, message: "User registered successfully" });
    } catch (err) {
        console.error("Error registering user:", err);
        res.status(500).json({ error: "Server error" });
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: "1d",
        });

        return res.json({ success: true, token, user });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
};

exports.googleLogin = async (req, res) => {
    console.log("📥 [GOOGLE LOGIN] Incoming request:", req.body);

    try {
        const { googleId, email, name, idToken, profileImage } = req.body;

        if (!idToken) {
            console.log("❌ [400] Missing idToken");
            return res.status(400).json({ message: "idToken is required" });
        }

        // Verify Firebase token
        console.log("🔍 Verifying Firebase token...");
        const decoded = await admin.auth().verifyIdToken(idToken);
        console.log("✅ Firebase Token Decoded:", decoded);

        let user = await User.findOne({ email });

        if (!user) {
            console.log("👤 Creating new Google user...");

            user = await User.create({
                name,
                email,
                googleId,
                password: "GOOGLE_AUTH",
                profileImage: profileImage,
                isProfileCompleted: false
            });

            console.log("✅ User registered:", user._id);
        } else {
            user.googleId = googleId;
            user.name = name;
            user.profileImage = profileImage;
            // user.isProfileCompleted;
            console.log("🔐 Existing user logged in:", user._id);
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });

        console.log("🎫 JWT Generated", user);

        res.status(200).json({
            message: "Success",
            token,
            user
        });

    } catch (err) {
        console.log("💥 [500] Google Login Error:", err);

        res.status(500).json({
            message: "Firebase token verification failed",
            error: err.message
        });
    }
};

exports.updateUserDetails = async (req, res) => {
    try {
        const userId = req.body.userId;

        console.log("======================================");
        console.log("[UPDATE USER API HIT]");
        console.log("User ID:", userId);
        console.log("Incoming Body:", req.body);
        console.log("======================================");

        const updatePayload = {
            ...req.body,
            isProfileCompleted: true  // ⭐ always true on update
        };

        console.log("[PAYLOAD TO UPDATE]:", updatePayload);

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updatePayload,
            { new: true }
        );

        if (!updatedUser) {
            console.log("[404] User not found with ID:", userId);
            return res.status(404).json({ message: "User not found" });
        }

        console.log("[200] User Updated Successfully");
        console.log("Updated User:", updatedUser);

        res.json({
            message: "User updated",
            user: updatedUser
        });

    } catch (err) {
        console.log("[500] Error updating user:", err);
        res.status(500).json({ message: "Error updating user" });
    }
};

exports.loginUserWithRole = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!["user", "admin", "team"].includes(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }

        const entity = await User.findOne({ email });
        if (!entity) return res.status(401).json({ error: "Invalid credentials" });

        if (entity.role !== role) {
            console.log(`Role mismatch: expected ${role}, got ${entity.role}`);
            return res.status(403).json({ success: false, error: "Role mismatch" });
        }

        const isMatch = await bcrypt.compare(password, entity.password);
        if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

        const token = jwt.sign({ id: entity._id, role }, process.env.JWT_SECRET, {
            expiresIn: "1d",
        });

        return res.status(200).json({ success: true, entity, token });
    } catch (err) {
        console.error("Error during login with role:", err);
        res.status(500).json({ error: "Server error" });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const { role, startDate, endDate } = req.query;
        let query = {};

        if (role && role !== 'all') {
            query.role = role;
        }

        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // .select('-password') excludes the password field from the results
        const users = await User.find(query).select('-password').sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({ error: "Server error while fetching users." });
    }
};

exports.updatePassword = async (req, res) => {
    try {
        const { password } = req.body;
        if (!password || password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters long." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.findByIdAndUpdate(req.params.id, { password: hashedPassword });

        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        res.status(200).json({ success: true, message: "Password updated successfully." });
    } catch (err) {
        res.status(500).json({ error: "Server error while updating password." });
    }
};

exports.getClientById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findOne({ _id: id, role: "client" }).select("-password");
        if (!user) {
            return res.status(404).json({ error: "Client user not found." });
        }
        console.log(user, 'client')
        res.status(200).json({ success: true, client: user });
    } catch (err) {
        res.status(500).json({ error: "Server error while fetching client user." });
    }
};

// ----------------------------------------------------
// Get Clients by Team Member
// ----------------------------------------------------
exports.getClientsByTeamMember = async (req, res) => {
    try {
        const { teamId } = req.params;
        console.log("[Client] Fetching clients for team member:", teamId);

        // Find profiles where assignedTeam array contains the teamId
        const profiles = await ClientProfile.find({ assignedTeam: teamId })
            .populate("user", "-password")
            .populate("assignedTeam", "name email avatarUrl role");

        if (!profiles || profiles.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No clients found for this team member.",
                data: []
            });
        }

        // Fetch subscriptions for these profiles
        const profileIds = profiles.map(p => p._id);
        const subs = await ClientSubscription.find({
            client: { $in: profileIds },
            status: "Active"
        }).populate("packageTemplate", "packageName");

        const formatted = profiles.map(profile => {
            const newsubs = subs.filter(s => s.client.toString() === profile._id.toString());
            // Use locally defined formatClientResponse helper if available, assumes it is in scope as per file read
            return formatClientResponse(profile.user, profile, newsubs);
        });

        console.log(formatted, 'formatted')

        return res.status(200).json({
            success: true,
            message: "Clients fetched successfully",
            data: formatted
        });

    } catch (error) {
        console.error("[Client] Error fetching team clients:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

exports.getUserByIdMobileApp = async (req, res) => {
    try {
        console.log(req.body, 'userId')
        const userId = req.body.userId;

        console.log(`📥 [GET USER] Request for ID: ${userId}`);

        const user = await User.findById(userId);

        if (!user) {
            console.log("❌ [404] User not found");
            return res.status(404).json({ message: "User not found" });
        }

        console.log("✅ [200] User fetched successfully");

        res.status(200).json({
            message: "User fetched",
            user
        });

    } catch (err) {
        console.log("💥 [500] Error fetching user:", err);
        res.status(500).json({ message: "Error fetching user" });
    }
};

// controllers/termsController.js
exports.getPrivacyPolicy = async (req, res) => {
    try {
        console.log("📥 [PRIVACY POLICY] API hit");

        // JSON content of your privacy policy
        const privacyPolicy = {
            title: "Privacy Policy",
            lastUpdated: "2025-12-03",
            content: [
                "We value your privacy and are committed to protecting your personal data.",
                "This policy explains how we collect, use, and safeguard your information.",
                "We do not share your personal data with third parties without your consent.",
                "You can request access, correction, or deletion of your data anytime.",
                "By using our services, you agree to the terms of this privacy policy."
            ],
            contactEmail: "support@yourcompany.com"
        };

        res.status(200).json({
            success: true,
            privacyPolicy
        });

    } catch (err) {
        console.log("💥 [500] Error fetching privacy policy:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


exports.updateUserPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { permissions } = req.body;

        if (!Array.isArray(permissions)) {
            return res.status(400).json({ success: false, message: "Permissions must be an array" });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Logic: 
        // 1. Superadmin can update anyone.
        // 2. Company Owner can update anyone in their company.

        if (req.user.role !== "Superadmin") {
            // Check if requester is owner of the company the user belongs to
            const requesterCompany = await Company.findOne({ owner: req.user._id });

            if (!requesterCompany || user.company?.toString() !== requesterCompany._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: "Not authorized: You can only update permissions for users in your own company"
                });
            }
        }

        user.customPermissions = permissions;
        await user.save();

        console.log(`✅ [PERMISSIONS] Updated for ${user.email}: ${permissions.length} items`);

        res.status(200).json({
            success: true,
            message: "Permissions updated successfully",
            data: user.customPermissions
        });
    } catch (error) {
        console.error("❌ [PERMISSIONS ERROR]:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Add accessible company to user
// @route   PUT /api/users/admin/accessible-companies/:id
// @access  Private/Superadmin
exports.addUserAccessibleCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const { companyId } = req.body;

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // Add if not already present
        if (!user.accessibleCompanies.includes(companyId)) {
            user.accessibleCompanies.push(companyId);
            await user.save();
        }

        res.status(200).json({ success: true, message: "Company access granted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
