const Reward = require("../models/Reward");
const TeamProfile = require("../models/TeamProfile");

// @desc    Get current user's reward history
// @route   GET /api/rewards/my-rewards
// @access  Private
exports.getMyRewards = async (req, res) => {
    try {
        const rewards = await Reward.find({ user: req.user._id }).sort({ date: -1 });
        const profile = await TeamProfile.findOne({ user: req.user._id });

        res.status(200).json({
            success: true,
            totalPoints: profile ? profile.totalPoints : 0,
            count: rewards.length,
            data: rewards
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Leaderboard (Top Performers)
// @route   GET /api/rewards/leaderboard
// @access  Private
exports.getLeaderboard = async (req, res) => {
    try {
        const leaderboard = await TeamProfile.find()
            .populate("user", "name role")
            .sort({ totalPoints: -1 })
            .limit(10);

        res.status(200).json({
            success: true,
            data: leaderboard
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
