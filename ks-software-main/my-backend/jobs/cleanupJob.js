const cron = require("node-cron");
const Schedule = require("../models/Schedule");
const Task = require("../models/Task");
const PaymentCollection = require("../models/PaymentCollection");
const ClientSubscription = require("../models/ClientSubscription");
const { subMonths, subYears } = require("date-fns");

/**
 * Cleanup job to remove old records as requested
 * Runs every day at 3 AM
 */
const startCleanupJob = () => {
    // 0 3 * * * = 3:00 AM every day
    cron.schedule("0 3 * * *", async () => {
        try {
            console.log("[CLEANUP] Starting data cleanup job...");
            
            const threeMonthsAgo = subMonths(new Date(), 3);
            const sixMonthsAgo = subMonths(new Date(), 6);
            const oneYearAgo = subYears(new Date(), 1);

            // 1. Salary Data - yearly delete
            const salaryResult = await PaymentCollection.deleteMany({
                expenseCategory: "Salary",
                collectionDate: { $lt: oneYearAgo }
            });
            console.log(`[CLEANUP] Deleted ${salaryResult.deletedCount} old salary records (older than 1 year).`);

            // 2. Task - every 3 month delete
            // Note: Only deleting completed/finalized tasks to avoid losing active work
            const taskResult = await Task.deleteMany({
                status: { $in: ["Done", "Posted", "Approved", "Cancelled", "DONE", "POSTED", "APPROVED", "CANCELLED", "done", "posted", "approved", "cancelled"] },
                updatedAt: { $lt: threeMonthsAgo }
            });
            console.log(`[CLEANUP] Deleted ${taskResult.deletedCount} old finalized tasks (older than 3 months).`);

            // 3. Assign Package - every 6 month delete
            const subscriptionResult = await ClientSubscription.deleteMany({
                status: { $in: ["Completed", "Cancelled"] },
                updatedAt: { $lt: sixMonthsAgo }
            });
            console.log(`[CLEANUP] Deleted ${subscriptionResult.deletedCount} old completed/cancelled subscriptions (older than 6 months).`);

            // 4. Schedule Management - Package complete then delete
            // We search for all schedules belonging to Completed subscriptions and delete them
            const completedSubs = await ClientSubscription.find({ status: "Completed" }).select("_id");
            const completedSubIds = completedSubs.map(sub => sub._id);
            
            if (completedSubIds.length > 0) {
                const scheduleResult = await Schedule.deleteMany({
                    subscription: { $in: completedSubIds }
                });
                console.log(`[CLEANUP] Deleted ${scheduleResult.deletedCount} schedules from completed packages.`);
            }

            // 5. Auto-Complete Expired Subscriptions
            const activeSubs = await ClientSubscription.find({ status: "Active" });
            const today = new Date();
            let autoCompletedCount = 0;
            const clientsToSync = new Set();

            for (const sub of activeSubs) {
                if (today > new Date(sub.endDate)) {
                    sub.status = "Completed";
                    await sub.save();
                    autoCompletedCount++;
                    clientsToSync.add(sub.client.toString());
                }
            }

            if (clientsToSync.size > 0) {
                for (const clientId of clientsToSync) {
                    const hasActive = await ClientSubscription.exists({ client: clientId, status: "Active" });
                    if (!hasActive) {
                        await ClientProfile.findByIdAndUpdate(clientId, { clientStatus: "Onboarding" });
                    }
                }
            }

            if (autoCompletedCount > 0) {
                console.log(`[CLEANUP] Auto-completed ${autoCompletedCount} expired subscriptions.`);
            }
            
            console.log("[CLEANUP] Cleanup job finished successfully.");
        } catch (error) {
            console.error("[CLEANUP] Error in cleanup job:", error);
        }
    });

    console.log("[CLEANUP] Task cleanup scheduler started (Daily at 3 AM).");
};

module.exports = startCleanupJob;

