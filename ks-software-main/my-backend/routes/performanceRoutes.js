const express = require("express");
const router = express.Router();
const { getMyStats, getLeaderboard } = require("../controllers/performanceController");
const { protect } = require("../middleware/authMiddleware");

router.get("/my-stats", protect, getMyStats);
router.get("/leaderboard", protect, getLeaderboard);

module.exports = router;
