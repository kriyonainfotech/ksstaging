const express = require("express");
const router = express.Router();
const { 
    getMyWalletStats, 
    getTeamSalaryOverview,
    getPayrollStats,
    getPayrollList,
    recordSalaryPayment,
    getAttendanceLogs,
    getSalaryProfile,
    upsertSalaryProfile,
    generatePayrollRun,
    getPayrollRun,
    listPayrollRuns,
    finalizePayrollRun
} = require("../controllers/salaryController");
const { protect, authorize } = require("../middleware/authMiddleware");

// Individual wallet stats
router.get("/wallet", protect, getMyWalletStats);

// Superadmin Dashboard routes
router.get("/stats", protect, authorize("Superadmin"), getPayrollStats);
router.get("/list", protect, authorize("Superadmin"), getPayrollList);
router.post("/runs/generate", protect, authorize("Superadmin"), generatePayrollRun);
router.get("/runs/history/list", protect, authorize("Superadmin"), listPayrollRuns);
router.get("/runs", protect, authorize("Superadmin"), getPayrollRun);
router.get("/runs/:runId", protect, authorize("Superadmin"), getPayrollRun);
router.patch("/runs/:runId/finalize", protect, authorize("Superadmin"), finalizePayrollRun);
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
router.get("/profile/:userId", protect, (req, res, next) => {
    if (
        req.user.role === "Superadmin" ||
        req.user.role === "Admin" ||
        req.user._id.toString() === req.params.userId
    ) {
        return next();
    }
    return res.status(403).json({ success: false, message: "Unauthorized access to salary profile" });
}, getSalaryProfile);
router.put("/profile/:userId", protect, authorize("Superadmin", "Admin"), upsertSalaryProfile);
router.post("/pay", protect, authorize("Superadmin"), recordSalaryPayment);

// Legacy/Overview
router.get("/admin/overview", protect, authorize("Superadmin", "Admin"), getTeamSalaryOverview);

module.exports = router;
