const Task = require("../models/Task");
const User = require("../models/user");
const { startOfDay, endOfDay, startOfMonth, endOfMonth } = require("date-fns");

// @desc    Get performance stats for current user (Daily & Monthly %)
// @route   GET /api/performance/my-stats
// @access  Private
exports.getMyStats = async (req, res) => {
    try {
        const userId = req.user._id;
        const today = new Date();

        const TeamProfile = require("../models/TeamProfile");
        const profile = await TeamProfile.findOne({ user: userId });
        const targetStatuses = profile && profile.specialization === "video" ? ["Approved", "Done"] : ["Done"];

        // 1. Daily Stats
        const dailyAssigned = await Task.countDocuments({
            assignedTo: userId,
            dueDate: { $gte: startOfDay(today), $lte: endOfDay(today) }
        });

        const dailyCompleted = await Task.countDocuments({
            assignedTo: userId,
            dueDate: { $gte: startOfDay(today), $lte: endOfDay(today) },
            status: { $in: targetStatuses }
        });

        // 2. Monthly Stats
        const monthlyAssigned = await Task.countDocuments({
            assignedTo: userId,
            dueDate: { $gte: startOfMonth(today), $lte: endOfMonth(today) }
        });

        const monthlyCompleted = await Task.countDocuments({
            assignedTo: userId,
            dueDate: { $gte: startOfMonth(today), $lte: endOfMonth(today) },
            status: { $in: targetStatuses }
        });

        res.status(200).json({
            success: true,
            data: {
                daily: {
                    assigned: dailyAssigned,
                    completed: dailyCompleted,
                    percentage: dailyAssigned > 0 ? Number(((dailyCompleted / dailyAssigned) * 100).toFixed(2)) : 0
                },
                monthly: {
                    assigned: monthlyAssigned,
                    completed: monthlyCompleted,
                    percentage: monthlyAssigned > 0 ? Number(((monthlyCompleted / monthlyAssigned) * 100).toFixed(2)) : 0
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Team Leaderboard based on Monthly Completion %
// @route   GET /api/performance/leaderboard
// @access  Private
exports.getLeaderboard = async (req, res) => {
    try {
        const today = new Date();
        const monthStart = startOfMonth(today);
        const monthEnd = endOfMonth(today);

        // Get all team members
        const teamMembers = await User.find({ role: "Team" }, "name email");

        const TeamProfile = require("../models/TeamProfile");
        const profiles = await TeamProfile.find({ user: { $in: teamMembers.map(m => m._id) } });
        const profileMap = new Map();
        profiles.forEach(p => profileMap.set(p.user.toString(), p));

        const leaderboard = await Promise.all(teamMembers.map(async (member) => {
            const profile = profileMap.get(member._id.toString());
            const targetStatuses = profile && profile.specialization === "video" ? ["Approved", "Done"] : ["Done"];

            const assigned = await Task.countDocuments({
                assignedTo: member._id,
                dueDate: { $gte: monthStart, $lte: monthEnd }
            });

            const completed = await Task.countDocuments({
                assignedTo: member._id,
                dueDate: { $gte: monthStart, $lte: monthEnd },
                status: { $in: targetStatuses }
            });

            return {
                id: member._id,
                name: member.name,
                assigned,
                completed,
                percentage: assigned > 0 ? Number(((completed / assigned) * 100).toFixed(2)) : 0
            };
        }));

        // Sort by percentage descending
        leaderboard.sort((a, b) => b.percentage - a.percentage);

        res.status(200).json({
            success: true,
            data: leaderboard
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
