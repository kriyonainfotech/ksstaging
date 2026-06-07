const Schedule = require("../models/Schedule");
const Task = require("../models/Task");

// @desc    Get all schedule items for a client
// @route   GET /api/schedules/client/:id
// @access  Private
exports.getSchedulesByClient = async (req, res) => {
    try {
        const schedules = await Schedule.find({ client: req.params.id })
            .populate("service")
            .populate("assignedTo", "name email")
            .populate({
                path: "linkedTask",
                populate: {
                    path: "assignedTo",
                    select: "name"
                }
            })
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: schedules.length,
            data: schedules
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Get dashboard analytics for schedules
// @route   GET /api/schedules/analytics
// @access  Private
exports.getScheduleAnalytics = async (req, res) => {
    try {
        // Basic counts for dashboard cards
        const totalPending = await Schedule.countDocuments({ status: "Unscheduled" });
        const totalScheduled = await Schedule.countDocuments({ status: "Scheduled" });
        const totalCompleted = await Schedule.countDocuments({ status: "Completed" });

        // Growth or health metrics could go here

        return res.status(200).json({
            success: true,
            data: {
                totalPending,
                totalScheduled,
                totalCompleted
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Manual update for a schedule item
// @route   PUT /api/schedules/:id
exports.updateSchedule = async (req, res) => {
    try {
        const schedule = await Schedule.findById(req.params.id);
        if (!schedule) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }

        // --- DATE VALIDATION ---
        if (req.body.date) {
            const { startOfDay, isBefore } = require("date-fns");
            const scheduleDate = new Date(req.body.date);
            const today = startOfDay(new Date());

            if (isBefore(scheduleDate, today)) {
                return res.status(400).json({ success: false, message: "Schedule date cannot be in the past" });
            }

            if (schedule.subscription) {
                const ClientSubscription = require("../models/ClientSubscription");
                const sub = await ClientSubscription.findById(schedule.subscription);

                if (sub) {
                    if (isBefore(scheduleDate, startOfDay(new Date(sub.startDate))) ||
                        isBefore(startOfDay(new Date(sub.endDate)), scheduleDate)) {
                        return res.status(400).json({
                            success: false,
                            message: `Schedule date must be within package range (${new Date(sub.startDate).toLocaleDateString()} - ${new Date(sub.endDate).toLocaleDateString()})`
                        });
                    }
                }
            }
        }

        Object.assign(schedule, req.body);
        await schedule.save();

        return res.status(200).json({ success: true, data: schedule });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};
// @desc    Get summary counts for all clients
// @route   GET /api/schedules/summary
exports.getScheduleSummary = async (req, res) => {
    try {
        const summary = await Schedule.aggregate([
            {
                $group: {
                    _id: "$client",
                    total: { $sum: 1 },
                    unscheduled: { $sum: { $cond: [{ $eq: ["$status", "Unscheduled"] }, 1, 0] } },
                    scheduled: { $sum: { $cond: [{ $eq: ["$status", "Scheduled"] }, 1, 0] } },
                    completed: { $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] } }
                }
            }
        ]);

        return res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};
// @desc    Create a Chutak (one-off) schedule item
// @route   POST /api/schedules/chutak
exports.createChutakItem = async (req, res) => {
    try {
        const { client, postType, content, price, description } = req.body;

        if (!client || !postType || !content) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const chutakItem = await Schedule.create({
            client,
            postType,
            content,
            price,
            description,
            isChutak: true,
            status: "Unscheduled"
        });

        return res.status(201).json({
            success: true,
            data: chutakItem
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Get Chutak items for a client with date filtering
// @route   GET /api/schedules/chutak/client/:id
exports.getChutakItemsByClient = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let query = { 
            client: req.params.id,
            isChutak: true 
        };

        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const items = await Schedule.find(query).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: items.length,
            data: items
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Delete a schedule item
// @route   DELETE /api/schedules/:id
exports.deleteSchedule = async (req, res) => {
    try {
        const schedule = await Schedule.findById(req.params.id);
        if (!schedule) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }

        await schedule.deleteOne();

        return res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};
