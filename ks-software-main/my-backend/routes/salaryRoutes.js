const express = require("express");
const router = express.Router();
const { 
    getMyWalletStats, 
    getTeamSalaryOverview,
    getPayrollStats,
    getPayrollList,
    recordSalaryPayment,
    getAttendanceLogs
} = require("../controllers/salaryController");
const { protect, authorize } = require("../middleware/authMiddleware");

// Individual wallet stats
router.get("/wallet", protect, getMyWalletStats);

// Superadmin Dashboard routes
router.get("/stats", protect, authorize("Superadmin"), getPayrollStats);
router.get("/list", protect, authorize("Superadmin"), getPayrollList);
router.get("/logs/:userId", protect, (req, res, next) => {
    if (
        req.user.role === "Superadmin" || 
        req.user.role === "Admin" || 
        req.user._id.toString() === req.params.userId
    ) {
        return next();
    }
    return res.status(403).json({ success: false, message: "Unauthorized access to logs" });
}, getAttendanceLogs);
router.post("/pay", protect, authorize("Superadmin"), recordSalaryPayment);

// Legacy/Overview
router.get("/admin/overview", protect, authorize("Superadmin", "Admin"), getTeamSalaryOverview);

module.exports = router;
