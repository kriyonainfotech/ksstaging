const express = require("express");
const router = express.Router();
const { getMyRewards, getLeaderboard } = require("../controllers/rewardController");
const { protect } = require("../middleware/authMiddleware");

router.get("/my-rewards", protect, getMyRewards);
router.get("/leaderboard", protect, getLeaderboard);

module.exports = router;
