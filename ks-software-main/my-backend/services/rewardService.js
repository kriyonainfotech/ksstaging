const Reward = require("../models/Reward");
const TeamProfile = require("../models/TeamProfile");

/**
 * Award points to a user and update their profile.
 * @param {String} userId - ID of the user
 * @param {Number} points - Number of points to award
 * @param {String} type - Type of reward (Attendance, Task, Bonus)
 * @param {String} reason - Brief description
 * @param {String} referenceId - (Optional) ID of Task or Attendance record
 */
const awardPoints = async (userId, points, type, reason, referenceId = null) => {
    try {
        if (points === 0) return;

        // 1. Create Reward Entry
        await Reward.create({
            user: userId,
            points,
            type,
            reason,
            referenceId
        });

        // 2. Update TeamProfile Total Points
        await TeamProfile.findOneAndUpdate(
            { user: userId },
            { $inc: { totalPoints: points } },
            { new: true, upsert: true }
        );

        console.log(`[REWARD] ${points} points awarded to ${userId} for ${reason}`);
    } catch (error) {
        console.error("[REWARD_SERVICE] Error awarding points:", error);
    }
};

module.exports = { awardPoints };
