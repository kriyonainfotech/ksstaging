const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema({
    // 1. Core Details
    title: {
        type: String,
        required: [true, "Please add a task title"],
        trim: true,
        maxlength: [100, "Title cannot be more than 100 characters"]
    },
    description: {
        type: String,
    },
    type: {
        type: String,
        enum: ["Personal", "Team", "Admin"],
        default: "Personal",
        required: true
    },
    status: {
        type: String,
        default: "Pending"
    },
    priority: {
        type: String,
        default: "Medium"
    },
    dueDate: {
        type: Date,
        required: [true, "Please add a due date"]
    },
    postingDate: {
        type: Date
    },
    taskCategory: {
        type: String,
        default: "Creative"
    },
    completedAt: {
        type: Date
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    assignedModel: {
        type: String,
        required: true,
        enum: ['Admin', 'Team', 'User'],
        default: 'User'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    creatorModel: {
        type: String,
        required: true,
        enum: ['Admin', 'Team', 'User'],
        default: 'User'
    },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ClientProfile"
    },
    customFields: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },
    scheduleItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Schedule"
    },
    // --- Notification Fields ---
    notificationTime: {
        type: Date
    },
    notificationSent: {
        type: Boolean,
        default: false
    },
    statusHistory: [
        {
            status: String,
            note: String,
            updatedAt: { type: Date, default: Date.now },
            updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
        }
    ]

}, { timestamps: true });

// --- INDEXES FOR PERFORMANCE ---
// 1. Speed up "My Tasks" queries
TaskSchema.index({ assignedTo: 1, status: 1 });

// 2. Speed up "Client Tasks" queries (e.g., Show all work done for Mirosa)
TaskSchema.index({ client: 1 });

// 3. Speed up Overdue Checks (Cron jobs)
TaskSchema.index({ dueDate: 1, status: 1 });

// --- SYNC HOOK ---
// When a task is saved, if it has a scheduleItem, we sync the status and metadata
TaskSchema.post("save", async function (doc) {
    if (doc.scheduleItem) {
        try {
            // Using mongoose.model to avoid circular dependency
            const Schedule = mongoose.model("Schedule");
            const updateData = {
                linkedTask: doc._id,
                date: doc.dueDate,
                content: doc.title,
                description: doc.description,
                status: doc.status && ["done", "approved", "posted"].includes(doc.status.toLowerCase()) ? "Completed" : "Scheduled"
            };

            // 1. Update the Schedule item
            const updatedSchedule = await Schedule.findByIdAndUpdate(doc.scheduleItem, updateData, { new: true });

            // 2. Check if the entire subscription is now completed
            if (updatedSchedule && updatedSchedule.subscription && updatedSchedule.status === "Completed") {
                const remaining = await Schedule.countDocuments({
                    subscription: updatedSchedule.subscription,
                    status: { $nin: ["Completed", "Cancelled"] }
                });

                if (remaining === 0) {
                    const ClientSubscription = mongoose.model("ClientSubscription");
                    await ClientSubscription.findByIdAndUpdate(updatedSchedule.subscription, { status: "Completed" });
                    console.log(`[SUBSCRIPTION][AUTO-COMPLETE] Package ${updatedSchedule.subscription} marked as COMPLETED`);
                }
            }
        } catch (error) {
            console.error("[SYNC][TASK -> SCHEDULE] Error:", error);
        }
    }
});

const Task = mongoose.model("Task", TaskSchema);


module.exports = Task;