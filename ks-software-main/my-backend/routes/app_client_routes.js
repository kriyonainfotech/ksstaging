const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const {
    loginClient,
    getDashboard,
    getSchedule,
    getProfile
} = require("../controllers/app_client_controller");

const router = express.Router();

// Public Routes
router.post("/auth/login", loginClient);

// Private Routes (Require Token)
router.get("/dashboard", protect, getDashboard);
router.get("/schedule", protect, getSchedule);
router.get("/profile", protect, getProfile);

module.exports = router;
