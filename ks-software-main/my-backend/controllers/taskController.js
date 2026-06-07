const Task = require("../models/Task");
const User = require("../models/user");
const ClientProfile = require("../models/ClientProfile");
const ClientSubscription = require("../models/ClientSubscription");
const { startOfDay, endOfDay, startOfMonth, endOfMonth, format, isBefore, isAfter } = require("date-fns");

// Helper to reliably determine which collection a user ID belongs to
const determineModelForUser = async (userId) => {
    return "User";
};

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// @desc    Get all tasks (Smart Filter with Pagination)
// @route   GET /api/tasks/get-tasks
// @access  Private
exports.getTasks = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            startDate,
            endDate,
            type,
            client,
            assignedTo,
            status,
            search
        } = req.query;

        // 1. Build Query for Task List
        const query = {};

        // Date Range Filter
        if (startDate || endDate) {
            query.dueDate = {};
            if (startDate) query.dueDate.$gte = startOfDay(new Date(startDate));
            if (endDate) query.dueDate.$lte = endOfDay(new Date(endDate));
        } else {
            // Default to today if no range provided (as per user request)
            const today = new Date();
            query.dueDate = {
                $gte: startOfDay(today),
                $lte: endOfDay(today)
            };
        }

        if (type && type !== "all") query.type = type;
        if (client && client !== "all") query.client = client;
        if (assignedTo && assignedTo !== "all" && assignedTo !== "none") {
            query.assignedTo = assignedTo;
        } else if (type === "Team" && req.user.role === "Admin") {
            // Restriction: Admins see Team tasks for members they manage + themselves + tasks they created
            const User = require("../models/user");
            const managedTeamIds = await User.find({ managedBy: req.user.id, role: "Team" }).distinct("_id");
            query.$or = [
                { assignedTo: { $in: [...managedTeamIds, req.user.id] } },
                { createdBy: req.user.id, type: "Team" }
            ];
        } else if (assignedTo === "none") {
            query.assignedTo = { $exists: false }; // or handle as null if that's how unassigned is stored
        }
        if (status && status !== "all") query.status = { $regex: `^${escapeRegex(status)}$`, $options: "i" };

        let searchConditions = [];
        if (search) {
            const searchRegex = { $regex: search, $options: "i" };
            const [matchedUsers, matchedClients] = await Promise.all([
                User.find({ $or: [{ name: searchRegex }, { email: searchRegex }] }).distinct("_id"),
                ClientProfile.find({ businessName: searchRegex }).distinct("_id")
            ]);

            searchConditions = [
                { title: searchRegex },
                { description: searchRegex },
                { taskCategory: searchRegex },
                { status: searchRegex },
                { priority: searchRegex },
                { assignedTo: { $in: matchedUsers } },
                { createdBy: { $in: matchedUsers } },
                { client: { $in: matchedClients } }
            ];

            if (query.$or) {
                query.$and = [{ $or: query.$or }, { $or: searchConditions }];
                delete query.$or;
            } else {
                query.$or = searchConditions;
            }
        }


        // 2. Fetch Paginated Tasks
        const tasks = await Task.find(query)
            .populate("assignedTo", "name email")
            .populate("createdBy", "name email")
            .populate("client", "businessName")
            .sort({ dueDate: 1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();


        const total = await Task.countDocuments(query);

        // 3. Month Stats for Calendar Dots
        const refDate = startDate ? new Date(startDate) : new Date();
        const monthStart = startOfMonth(refDate);
        const monthEnd = endOfMonth(refDate);

        const monthQuery = {};
        monthQuery.dueDate = { $gte: monthStart, $lte: monthEnd };
        if (type && type !== "all") monthQuery.type = type;
        if (client && client !== "all") monthQuery.client = client;
        if (status && status !== "all") monthQuery.status = { $regex: `^${escapeRegex(status)}$`, $options: "i" };
        if (searchConditions.length > 0) monthQuery.$or = searchConditions;

        if (assignedTo && assignedTo !== "all" && assignedTo !== "none") {
            monthQuery.assignedTo = assignedTo;
        } else if (type === "Team" && req.user.role === "Admin") {
            const User = require("../models/user");
            const managedTeamIds = await User.find({ managedBy: req.user.id, role: "Team" }).distinct("_id");
            const adminScope = [
                { assignedTo: { $in: [...managedTeamIds, req.user.id] } },
                { createdBy: req.user.id, type: "Team" }
            ];
            if (monthQuery.$or) {
                monthQuery.$and = [{ $or: adminScope }, { $or: monthQuery.$or }];
                delete monthQuery.$or;
            } else {
                monthQuery.$or = adminScope;
            }
        }

        const monthTasks = await Task.find(monthQuery, "dueDate status");

        const calendarData = monthTasks.reduce((acc, task) => {
            const dateStr = format(task.dueDate, "yyyy-MM-dd");
            // Default color is yellow (pending tasks) — use hex so frontend can use inline style
            if (!acc[dateStr]) acc[dateStr] = { total: 0, completed: 0, color: "#eab308" };

            const isCompleted = ["done", "posted", "approved"].includes(task.status?.toLowerCase());

            acc[dateStr].total++;
            if (isCompleted) acc[dateStr].completed++;

            // Re-calculate color: red if any overdue, green if all done, yellow otherwise
            const taskDay = startOfDay(task.dueDate);
            const isPast = isBefore(taskDay, startOfDay(new Date()));
            const hasOverdue = !isCompleted && (task.status?.toLowerCase() === "overdue" || isPast);

            if (hasOverdue) {
                acc[dateStr].color = "#ef4444"; // red-500
            } else if (acc[dateStr].completed === acc[dateStr].total) {
                acc[dateStr].color = "#22c55e"; // green-500
            } else {
                // Keep yellow if not all done and not overdue (but don't overwrite red)
                if (acc[dateStr].color !== "#ef4444") {
                    acc[dateStr].color = "#eab308"; // yellow-500
                }
            }

            return acc;
        }, {});

        // console.log(tasks, "calendarData-------------------------------------");

        res.status(200).json({
            success: true,
            data: tasks,
            total,
            calendarData,
            monthCount: monthTasks.length
        });
    } catch (error) {
        console.log(error, "error");
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Create a Manual Task
// @route   POST /api/tasks
// @access  Private
exports.createTask = async (req, res) => {
    try {
        const assignedTo = req.body.assignedTo || req.user._id;

        // Auto-detect Model for req.user (Creator)
        // From authMiddleware: Superadmins are in "User" model, Admins in "Admin", Team in "Team"
        const getModelName = (role) => {
            return "User";
        };

        const creatorModel = getModelName(req.user.role);

        // Intelligently auto-detect Model for AssignedTo to avoid population bugs
        let assignedModel = req.body.assignedModel;
        if (!assignedModel) {
            assignedModel = await determineModelForUser(assignedTo);
        }

        // --- DATE VALIDATION ---
        if (req.body.dueDate) {
            const dueDate = startOfDay(new Date(req.body.dueDate));
            const today = startOfDay(new Date());

            if (isBefore(dueDate, today)) {
                return res.status(400).json({ success: false, message: "Due date cannot be in the past" });
            }
        }

        // --- POSTING DATE VALIDATION ---
        if (req.body.postingDate) {
            const postingDate = startOfDay(new Date(req.body.postingDate));
            const today = startOfDay(new Date());

            if (isBefore(postingDate, today)) {
                return res.status(400).json({ success: false, message: "Posting date cannot be in the past" });
            }
        }

        let task = await Task.create({
            ...req.body,
            assignedTo,
            assignedModel,
            createdBy: req.user._id,
            creatorModel,
            type: req.body.type || (req.body.client ? "Team" : "Personal")
        });

        // --- SYNC WITH SCHEDULE ---
        if (req.body.scheduleItem) {
            const Schedule = require("../models/Schedule");
            await Schedule.findByIdAndUpdate(req.body.scheduleItem, {
                linkedTask: task._id,
                date: task.dueDate,
                status: "Scheduled"
            });
            console.log(`[TASKS] Linked task ${task._id} to schedule ${req.body.scheduleItem}`);
        }

        // Populate for immediate feedback
        task = await task.populate([
            { path: "assignedTo" },
            { path: "client", select: "businessName" }
        ]);

        res.status(201).json({ success: true, data: task });
    } catch (error) {
        console.log(error, "createTask error");
        res.status(400).json({ success: false, message: error.message });
    }
};

// @desc    Update Task Status (The 3-Stage Workflow)
// @route   PUT /api/tasks/:id/status
// @access  Private
exports.updateTaskStatus = async (req, res) => {
    try {
        const { status, note } = req.body;
        const task = await Task.findById(req.params.id);

        if (!task) return res.status(404).json({ error: "Task not found" });

        if (status) {
            task.status = status;
            
            // Record in history
            task.statusHistory.push({
                status: status,
                note: note || "",
                updatedBy: req.user._id,
                updatedAt: Date.now()
            });
        }

        // Auto-timestamp completion
        if (status && ["posted", "done", "approved"].includes(status.toLowerCase())) {
            task.completedAt = Date.now();
        }

        await task.save();
        res.status(200).json({ success: true, data: task });

    } catch (error) {
        console.log(error, "error");
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Delete Task
// @route   DELETE /api/tasks/:id
// @access  Private (SA/Admin)
exports.deleteTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) return res.status(404).json({ error: "Task not found" });

        // --- SYNC WITH SCHEDULE ---
        if (task.scheduleItem) {
            const Schedule = require("../models/Schedule");
            await Schedule.findByIdAndUpdate(task.scheduleItem, {
                status: "Unscheduled",
                $unset: { date: 1, linkedTask: 1 }
            });
            console.log(`[TASKS] Unscheduled schedule ${task.scheduleItem} due to task deletion`);
        }

        await task.deleteOne();
        res.status(200).json({ success: true, message: "Task deleted and schedule item reverted" });
    } catch (error) {
        console.log(error, "error");
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Update Generic Task Details (Title, DueDate, Priority, etc.)
// @route   PUT /api/tasks/update-task/:id
// @access  Private
exports.updateTask = async (req, res) => {
    try {
        const updateData = { ...req.body };


        // If assignedTo is changing without an explicit model, infer it from DB
        if (req.body.assignedTo && !req.body.assignedModel) {
            updateData.assignedModel = await determineModelForUser(req.body.assignedTo);
        }

        let task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ success: false, message: "Task not found" });
        }

        const { startOfDay, isBefore, isAfter } = require("date-fns");

        // --- DATE VALIDATION ---
        if (req.body.dueDate) {
            const newDueDate = startOfDay(new Date(req.body.dueDate));
            const oldDueDate = task.dueDate ? startOfDay(new Date(task.dueDate)) : null;

            // Only validate if the date is actually being updated
            if (!oldDueDate || newDueDate.getTime() !== oldDueDate.getTime()) {
                const today = startOfDay(new Date());

                // ❗ Allow today, block only dates before today
                if (isBefore(newDueDate, today)) {
                    console.log("[TASKS] Date out of range: Past date");
                    return res.status(400).json({
                        success: false,
                        message: "Due date cannot be in the past"
                    });
                }

                const clientId = req.body.client || task.client;

                if (clientId) {
                    const sub = await ClientSubscription.findOne({
                        client: clientId,
                        status: "Active"
                    }).sort({ createdAt: -1 });

                    if (sub) {
                        const subStart = startOfDay(new Date(sub.startDate));
                        const subEnd = startOfDay(new Date(sub.endDate));

                        if (
                            isBefore(newDueDate, subStart) ||
                            isAfter(newDueDate, subEnd)
                        ) {
                            console.log("[TASKS] Date out of range: Subscription range");
                            return res.status(400).json({
                                success: false,
                                message: `Task date must be within package range (${subStart.toLocaleDateString()} - ${subEnd.toLocaleDateString()})`
                            });
                        }
                    }
                }
            }
        }

        // --- POSTING DATE VALIDATION ---
        if (req.body.postingDate) {
            const newPostingDate = startOfDay(new Date(req.body.postingDate));
            const oldPostingDate = task.postingDate ? startOfDay(new Date(task.postingDate)) : null;

            if (!oldPostingDate || newPostingDate.getTime() !== oldPostingDate.getTime()) {
                const today = startOfDay(new Date());
                if (isBefore(newPostingDate, today)) {
                    return res.status(400).json({
                        success: false,
                        message: "Posting date cannot be in the past"
                    });
                }
            }
        }
        Object.assign(task, updateData);

        // Reset notification sent status if time is updated
        if (req.body.notificationTime) {
            task.notificationSent = false;
            console.log(`[TASKS][UPDATE] Notification Time Updated: ${req.body.notificationTime}`);
        }

        await task.save();

        // --- SYNC WITH SCHEDULE ---
        if (task.scheduleItem) {
            const Schedule = require("../models/Schedule");
            await Schedule.findByIdAndUpdate(task.scheduleItem, {
                date: task.dueDate,
                status: "Scheduled"
            });
            console.log(`[TASKS] Sync'd task ${task._id} with schedule ${task.scheduleItem}`);
        }

        task = await Task.findById(task._id)
            .populate({ path: "assignedTo" })
            .populate({ path: "client", select: "businessName" });

        res.status(200).json({ success: true, data: task });
    } catch (error) {
        console.log("[TASKS] Update Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Get Tasks by Team Member ID
// @route   GET /api/tasks/team-member/:id
// @access  Private
exports.getTasksByTeamMember = async (req, res) => {
    try {
        const tasks = await Task.find({ assignedTo: req.params.id })
            .populate({ path: "assignedTo", select: "name email" })
            .populate({ path: "client", select: "businessName" })
            .sort({ dueDate: 1 });

        res.status(200).json({ success: true, count: tasks.length, data: tasks });
    } catch (error) {
        console.log(error, "error");
        res.status(500).json({ success: false, error: error.message });
    }
};
