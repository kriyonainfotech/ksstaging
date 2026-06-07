const cron = require('node-cron');
const Task = require('../models/Task');
const { sendNotification } = require('../services/oneSignalService');

const startNotificationJob = () => {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();
            console.log(`[Job] Running Notification Check at ${now.toISOString()}`);

            // Find tasks where:
            // 1. notificationTime is set and is in the past (or now)
            // 2. notificationSent is false (or doesn't exist)
            // 3. Status is NOT 'Done' or 'Completed' (optional, but good practice)
            const tasks = await Task.find({
                notificationTime: { $lte: now },
                notificationSent: { $ne: true },
                status: { $nin: ["Done", "Completed", "Posted", "Approved", "DONE", "COMPLETED", "POSTED", "APPROVED", "done", "completed", "posted", "approved"] } // Don't notify for completed tasks
            }).populate("assignedTo", "name");

            if (tasks.length > 0) {
                console.log(`[Job] Found ${tasks.length} tasks needing notification.`);
            }

            for (const task of tasks) {
                // Strict Targeting: Only notify the assigned user
                const recipientId = task.assignedTo?._id?.toString();

                if (recipientId) {
                    await sendNotification(
                        [recipientId],
                        "Task Reminder", // Heading
                        `It's time for: ${task.title}`, // Content
                        { taskId: task._id, type: "task_reminder" } // Data
                    );

                    // --- SAVE TO DB ---
                    try {
                        const Notification = require('../models/Notification');
                        await Notification.create({
                            recipient: recipientId,
                            title: "Task Reminder",
                            message: `It's time for: ${task.title}`,
                            type: "task_reminder",
                            relatedId: task._id,
                            isRead: false
                        });
                        console.log(`[Job] Saved notification for user ${recipientId}`);
                    } catch (dbError) {
                        console.error("[Job] Failed to save notification to DB:", dbError);
                    }
                }

                // Mark as sent
                task.notificationSent = true;
                await task.save();
            }

        } catch (error) {
            console.error("[Job] Error in notification cron:", error);
        }
    });

    console.log("[Job] Notification scheduler started.");
};

module.exports = startNotificationJob;
