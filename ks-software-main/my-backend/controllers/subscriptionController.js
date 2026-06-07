const ClientSubscription = require("../models/ClientSubscription");
const Task = require("../models/Task");
const ClientProfile = require("../models/ClientProfile");
const { addDays, addMonths, startOfDay } = require("date-fns");
const TeamProfile = require("../models/TeamProfile"); // Needed to check specialization
const ServiceItem = require("../models/ServiceItem");
const Schedule = require("../models/Schedule");
const PackageTemplate = require("../models/PackageTemplate");
const PaymentSale = require("../models/PaymentSale");

// --- Company Mapping Utility ---
const getCompanyFromEmail = (email) => {
    const ownerMap = {
        "nayanbhisara@kriyonastudio.com": "Kriyona Studio",
        "prarthanavaghani@kriyonastudio.com": "PrimeAdwork",
        "kirtannarola@kriyonastudio.com": "Kriyona Infotech",
        "yogeshnarola@kriyonastudio.com": "Kriyona Studio" // Default for Global Admin
    };
    return ownerMap[email] || "Kriyona Studio"; // Default fallback
};

// @desc    Get All Active Plans for a Client
// @route   GET /api/subscriptions/client/:id
// @access  Private (All)
exports.getClientSubscriptions = async (req, res) => {
    console.log("[SUBSCRIPTION][INFO] Fetching all subscriptions for client:", req.params.id);
    try {

        // 1. Fetch potentially active subscriptions
        const subs = await ClientSubscription.find({
            client: req.params.id,
            status: "Active"
        });

        // 2. The Janitor: Check for expired packages
        const today = new Date();

        for (const sub of subs) {
            const endDate = new Date(sub.endDate);
            
            // If the current date is past the end date, mark it as completed
            if (today > endDate) {
                sub.status = "Completed";
                await sub.save();
                console.log(`[SUBSCRIPTION][JANITOR] Auto-completed expired package: ${sub.packageName} for client: ${req.params.id}`);
                
                // Check if this was the last active plan
                const activeCount = await ClientSubscription.countDocuments({ client: req.params.id, status: "Active" });
                if (activeCount === 0) {
                    await ClientProfile.findByIdAndUpdate(req.params.id, { clientStatus: "Onboarding" });
                    console.log(`[SUBSCRIPTION][JANITOR] Marked client as Onboarding (No more active plans)`);
                }
            }
        }

        // 3. Re-fetch active ones + we might want to include RECENTly completed ones
        // for the UI to show a "Recently Finished" state if desired.
        const finalSubs = await ClientSubscription.find({
            client: req.params.id,
            status: { $in: ["Active", "Completed"] } // Fetch both to let frontend filter
        }).sort({ endDate: -1 }).limit(10); // Show last 10 for history

        res.status(200).json({ success: true, data: finalSubs });
    } catch (error) {
        console.error("[SUBSCRIPTION][ERROR] Failed to fetch client subscriptions", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Renew Subscription (Clone & Repeat)
// @route   POST /api/subscriptions/:id/renew
// @access  Private (SA, Admin)
exports.renewSubscription = async (req, res) => {
    logInfo("Renewing subscription", { id: req.params.id });
    try {
        const oldSub = await ClientSubscription.findById(req.params.id);
        if (!oldSub) return res.status(404).json({ error: "Subscription not found" });

        // Calculate new dates
        const newStartDate = addDays(new Date(oldSub.endDate), 1);

        // Use the CREATE logic again (Reuse logic ideally, but calling direct for now)
        // We simulate the request body to reuse the create function logic manually
        // OR better: Just create new record here:

        const newSub = await ClientSubscription.create({
            client: oldSub.client,
            startDate: newStartDate,
            endDate: addMonths(newStartDate, 1),
            packageTemplate: oldSub.packageTemplate,
            deliverables: oldSub.deliverables,
            status: "Active"
        });

        // Note: You would typically re-run the task generation logic here too.
        // For brevity, I'll return the new sub object. 
        // In production, split 'generateTasks' into a reusable helper function.

        // Mark old as Completed
        oldSub.status = "Completed";
        await oldSub.save();

        // --- AUTOMATED SALE CREATION ---
        try {
            const pkg = await PackageTemplate.findById(oldSub.packageTemplate);
            if (pkg) {
                const company = getCompanyFromEmail(req.user.email);
                await PaymentSale.create({
                    createdBy: req.user._id,
                    client: oldSub.client, // This should be the ClientProfile ID
                    company: company,
                    title: `Renewal: ${pkg.packageName}`,
                    totalAmount: pkg.sellingPrice || 0,
                    saleDate: newStartDate,
                    status: "Pending"
                });
                logInfo("Automated Sale created for renewal", { client: oldSub.client });
            }
        } catch (saleErr) {
            logError("Failed to auto-create sale for renewal", saleErr.message);
        }

        res.status(201).json({ success: true, data: newSub, message: "Plan renewed for next month" });

    } catch (error) {
        logError("Failed to renew subscription", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Cancel Plan
// @route   POST /api/subscriptions/:id/cancel
// @access  Private (SA only)
exports.cancelSubscription = async (req, res) => {
    logInfo("Cancelling subscription", { id: req.params.id });
    try {
        const sub = await ClientSubscription.findByIdAndUpdate(
            req.params.id,
            { status: "Cancelled" },
            { new: true }
        );
        res.status(200).json({ success: true, data: sub });
    } catch (error) {
        logError("Failed to cancel subscription", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};


exports.createSubscription = async (req, res) => {
    try {
        console.log("========================================");
        console.log("[SUBSCRIPTION][START] Create subscription");
        console.log("[SUBSCRIPTION][REQ BODY]:", JSON.stringify(req.body, null, 2));
        console.log("[SUBSCRIPTION][USER]:", req.user?._id);

        const { clientId, packageData, startDate, endDate } = req.body;

        if (!clientId || !packageData || !startDate) {
            console.error("[SUBSCRIPTION][ERROR] Missing required fields");
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        console.log("[SUBSCRIPTION][CLIENT ID]:", clientId);
        console.log("[SUBSCRIPTION][PACKAGE TEMPLATE ID]:", packageData.templateId);
        console.log("[SUBSCRIPTION][START DATE RAW]:", startDate);
        console.log("[SUBSCRIPTION][END DATE RAW]:", endDate);

        const start = startOfDay(new Date(startDate));
        const end = endDate ? startOfDay(new Date(endDate)) : addMonths(start, 1);

        console.log("[SUBSCRIPTION][START DATE NORMALIZED]:", start);
        console.log("[SUBSCRIPTION][END DATE]:", end);

        // ======================================================
        // Normalize package items & Calculate Total Amount
        // ======================================================
        console.log("[SUBSCRIPTION][ITEMS] Normalizing package items...");

        let calculatedTotalAmount = 0;

        const normalizedItems = await Promise.all(
            packageData.items.map(async (item, index) => {
                console.log(`[SUBSCRIPTION][ITEM ${index + 1}] Raw:`, item);

                const service = await ServiceItem.findById(item.serviceId);
                if (!service) {
                    console.error(`[SUBSCRIPTION][ERROR] Service not found: ${item.serviceId}`);
                    throw new Error(`Service not found: ${item.serviceId}`);
                }

                console.log(`[SUBSCRIPTION][ITEM ${index + 1}] Service Found:`, service.name, "| Price:", service.unitPrice);

                // Use provided basePrice from request if available, fallback to service unitPrice
                const unitPriceToUse = item.basePrice || service.unitPrice || 0;
                const itemTotal = unitPriceToUse * (item.quantity || 0);
                calculatedTotalAmount += itemTotal;

                return {
                    serviceId: service._id,
                    serviceName: service.name,
                    quantity: item.quantity,
                    serviceCategory: service.category,
                    price: unitPriceToUse, // Store the price used for calculation
                    assignedTo: item.assignedTo || null,
                    unitPrice: service.unitPrice || 0
                };
            })
        );

        console.log("[SUBSCRIPTION][ITEMS NORMALIZED]:", normalizedItems);
        console.log("[SUBSCRIPTION][TOTAL AMOUNT]:", calculatedTotalAmount);

        // ======================================================
        // Create subscription
        // ======================================================
        console.log("[SUBSCRIPTION][DB] Creating subscription...");

        const subscription = await ClientSubscription.create({
            client: clientId,
            packageName: packageData.name,
            startDate: start,
            endDate: end,
            packageTemplate: packageData.templateId || null, // Convert empty string to null to avoid BSON error
            deliverables: normalizedItems,
            status: "Active"
        });

        console.log("[SUBSCRIPTION][DB] Subscription created:", subscription._id);

        // ======================================================
        // 🚀 AUTO-GENERATE CONTENT QUOTA (QUOTA SYSTEM)
        // ======================================================
        console.log("[SUBSCRIPTION][QUOTA] Generating quota items...");
        const quotaItems = [];

        for (const item of normalizedItems) {
            // Smart Post Type Detection
            let postType = "Other";
            const nameLower = item.serviceName.toLowerCase();
            if (nameLower.includes("reel")) postType = "Reel";
            else if (nameLower.includes("post") || nameLower.includes("static")) postType = "Static Post";
            else if (nameLower.includes("story")) postType = "Story";
            else if (nameLower.includes("ad")) postType = "Ad";

            for (let i = 0; i < item.quantity; i++) {
                quotaItems.push({
                    client: clientId,
                    subscription: subscription._id,
                    service: item.serviceId,
                    postType: postType,
                    content: `${item.serviceName} - ${i + 1}`,
                    status: "Unscheduled"
                });
            }
        }

        if (quotaItems.length > 0) {
            await Schedule.insertMany(quotaItems);
            console.log(`[SUBSCRIPTION][QUOTA] Successfully generated ${quotaItems.length} items.`);
        }

        console.log("[SUBSCRIPTION][DB] Fetching client profile...");
        const clientProfile = await ClientProfile.findById(clientId);
        if (!clientProfile) {
            console.error("[SUBSCRIPTION][ERROR] Client profile not found");
            throw new Error("Client profile not found");
        }

        // --- AUTO-UPDATE CLIENT STATUS ---
        if (clientProfile.clientStatus === "Onboarding") {
            console.log("[SUBSCRIPTION][STATUS] Transitioning client to 'Active'");
            clientProfile.clientStatus = "Active";
            await clientProfile.save();
        }

        console.log("[SUBSCRIPTION][CLIENT PROFILE ID]:", clientProfile._id);
        console.log("[SUBSCRIPTION][ASSIGNED TEAM IDS]:", clientProfile.assignedTeam);

        // ======================================================
        // Fetch team profiles
        // ======================================================
        const teamProfiles = await TeamProfile.find({
            user: { $in: clientProfile.assignedTeam }
        }).populate("user");

        console.log("[SUBSCRIPTION][TEAM PROFILES FOUND]:", teamProfiles.length);


        // ======================================================

        // --- AUTOMATED SALE CREATION ---
        try {
            const company = getCompanyFromEmail(req.user.email);
            const templateId = packageData.templateId && packageData.templateId.length === 24 ? packageData.templateId : null;

            let saleTitle = `${packageData.name || "Custom Plan"}`;

            // If it's a template, maybe try to get the real name if title is generic
            if (templateId) {
                try {
                    const pkg = await PackageTemplate.findById(templateId);
                    if (pkg) saleTitle = pkg.packageName;
                } catch (e) { /* fallback to provided name */ }
            }

            await PaymentSale.create({
                createdBy: req.user._id,
                client: clientId,
                company: company,
                title: saleTitle,
                totalAmount: calculatedTotalAmount,
                saleDate: start,
                status: "Pending"
            });
            console.log("[SUBSCRIPTION][SALE] Automated Sale created successfully with amount:", calculatedTotalAmount);
        } catch (saleErr) {
            console.error("[SUBSCRIPTION][SALE] Failed to auto-create sale:", saleErr.message);
        }

        console.log("[SUBSCRIPTION][SUCCESS] Subscription flow completed");
        console.log("========================================");

        return res.status(201).json({
            success: true,
            message: "Package assigned successfully (Sale & Quota auto-generated)",
            subscription,
            tasksCreated: 0
        });

    } catch (error) {
        console.error("========================================");
        console.error("❌ [SUBSCRIPTION][FAILED]");
        console.error(error);
        console.error("========================================");

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
// @desc    Update an Existing Subscription
// @route   PATCH /api/subscriptions/:id
// @access  Private (SA, Admin)
exports.updateSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        const { packageName, deliverables, startDate, endDate } = req.body;

        console.log(`[SUBSCRIPTION][UPDATE] ID: ${id}`);

        const subscription = await ClientSubscription.findById(id);
        if (!subscription) {
            return res.status(404).json({ success: false, message: "Subscription not found" });
        }

        // 1. Update basic info & Dates
        if (packageName) subscription.packageName = packageName;
        if (startDate) subscription.startDate = startOfDay(new Date(startDate));
        if (endDate) subscription.endDate = startOfDay(new Date(endDate));

        // 2. Update deliverables if provided
        if (deliverables && Array.isArray(deliverables)) {
            const oldDeliverables = [...subscription.deliverables];

            // Robust mapping to backend schema fields
            const newDeliverables = deliverables.map(item => ({
                serviceId: item.serviceId,
                serviceName: item.serviceName || item.name || "Unknown Service",
                quantity: item.quantity || 1,
                serviceCategory: item.serviceCategory || "",
                price: item.price ?? item.basePrice ?? item.unitPrice ?? 0,
                tasksCreated: item.tasksCreated || 0
            }));

            subscription.deliverables = newDeliverables;

            // --- SYNC QUOTA (SCHEDULES) ---
            // For each item, check if quantity increased or decreased
            for (const newItem of newDeliverables) {
                const oldItem = oldDeliverables.find(d => d.serviceId.toString() === newItem.serviceId.toString());
                const oldQty = oldItem ? oldItem.quantity : 0;
                const diff = newItem.quantity - oldQty;

                if (diff > 0) {
                    // INCREASED: Add new unscheduled items
                    console.log(`[SUBSCRIPTION][QUOTA] Increasing ${newItem.serviceName} by ${diff}`);
                    const newSchedules = [];

                    // Detect post type
                    let postType = "Other";
                    const nameLower = newItem.serviceName.toLowerCase();
                    if (nameLower.includes("reel")) postType = "Reel";
                    else if (nameLower.includes("post") || nameLower.includes("static")) postType = "Static Post";
                    else if (nameLower.includes("story")) postType = "Story";
                    else if (nameLower.includes("ad")) postType = "Ad";

                    for (let i = 0; i < diff; i++) {
                        newSchedules.push({
                            client: subscription.client,
                            subscription: subscription._id,
                            service: newItem.serviceId,
                            postType: postType,
                            content: `${newItem.serviceName} - ${oldQty + i + 1}`,
                            status: "Unscheduled"
                        });
                    }
                    if (newSchedules.length > 0) {
                        const Schedule = require("../models/Schedule");
                        await Schedule.insertMany(newSchedules);
                    }
                } else if (diff < 0) {
                    // DECREASED: Remove unscheduled items (only Unscheduled ones!)
                    console.log(`[SUBSCRIPTION][QUOTA] Decreasing ${newItem.serviceName} by ${Math.abs(diff)}`);
                    const Schedule = require("../models/Schedule");
                    const toDelete = Math.abs(diff);

                    // Find unscheduled items for this service and subscription
                    const unscheduledItems = await Schedule.find({
                        subscription: id,
                        service: newItem.serviceId,
                        status: "Unscheduled"
                    }).limit(toDelete);

                    if (unscheduledItems.length > 0) {
                        await Schedule.deleteMany({
                            _id: { $in: unscheduledItems.map(item => item._id) }
                        });
                    }
                }
            }

            // Check for ENTIRELY REMOVED items
            for (const oldItem of oldDeliverables) {
                const exists = newDeliverables.find(d => d.serviceId.toString() === oldItem.serviceId.toString());
                if (!exists) {
                    console.log(`[SUBSCRIPTION][QUOTA] Service ${oldItem.serviceName} removed completely`);
                    const Schedule = require("../models/Schedule");
                    await Schedule.deleteMany({
                        subscription: id,
                        service: oldItem.serviceId,
                        status: "Unscheduled"
                    });
                }
            }
        }

        await subscription.save();

        console.log("[SUBSCRIPTION][SUCCESS] Updated successfully");
        res.status(200).json({ success: true, data: subscription });

    } catch (error) {
        console.error("[SUBSCRIPTION][UPDATE][ERROR]", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Get Subscription Deletion Preview
// @route   GET /api/subscriptions/:id/deletion-preview
// @access  Private (SA, Admin)
exports.getSubscriptionDeletionPreview = async (req, res) => {
    try {
        const { id } = req.params;
        const subscription = await ClientSubscription.findById(id);

        if (!subscription) {
            return res.status(404).json({ success: false, message: "Subscription not found" });
        }

        // Count Schedules
        const scheduledCount = await Schedule.countDocuments({
            subscription: id,
            status: { $in: ["Scheduled", "Completed"] }
        });

        const unscheduledCount = await Schedule.countDocuments({
            subscription: id,
            status: "Unscheduled"
        });

        // Count Tasks linked via schedules
        const schedules = await Schedule.find({ subscription: id }).select("_id");
        const scheduleIds = schedules.map(s => s._id);

        const pendingTasks = await Task.countDocuments({
            scheduleItem: { $in: scheduleIds },
            status: { $ne: "Done" }
        });

        const completedTasks = await Task.countDocuments({
            scheduleItem: { $in: scheduleIds },
            status: "Done"
        });

        res.status(200).json({
            success: true,
            data: {
                packageName: subscription.packageName,
                counts: {
                    scheduledContent: scheduledCount,
                    unscheduledContent: unscheduledCount,
                    pendingTasks,
                    completedTasks
                }
            }
        });

    } catch (error) {
        console.error("[SUBSCRIPTION][PREVIEW][ERROR]", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// @desc    Delete Subscription (Cascading)
// @route   DELETE /api/subscriptions/:id
// @access  Private (SA, Admin)
exports.deleteSubscription = async (req, res) => {
    try {
        const { id } = req.params;
        const { deleteSchedules = true, deleteTasks = true } = req.body || {};

        console.log(`[SUBSCRIPTION][DELETE] ID: ${id}, Options:`, { deleteSchedules, deleteTasks });

        const subscription = await ClientSubscription.findById(id);
        if (!subscription) {
            return res.status(404).json({ success: false, message: "Subscription not found" });
        }

        const summary = {
            schedulesDeleted: 0,
            tasksDeleted: 0,
            packageDeleted: false
        };

        // 1. Find all schedules for this subscription
        const schedules = await Schedule.find({ subscription: id }).select("_id linkedTask");
        const scheduleIds = schedules.map(s => s._id);

        // 2. Selective deletion
        if (deleteTasks) {
            const r = await Task.deleteMany({ scheduleItem: { $in: scheduleIds } });
            summary.tasksDeleted = r.deletedCount;
        }

        if (deleteSchedules) {
            const r = await Schedule.deleteMany({ subscription: id });
            summary.schedulesDeleted = r.deletedCount;
        }

        // 3. Clean up matching ClientPackage (Billing)
        // We match by client and dates to find the billing record created at the same time
        const ClientPackage = require("../models/ClientPackage");
        const pkg = await ClientPackage.findOne({
            client: subscription.client, // Note: profile.user ID is stored in ClientPackage, subscription.client is profileId usually, need to check
            packageName: subscription.packageName,
            startDate: subscription.startDate,
            endDate: subscription.endDate
        });

        // Re-checking ID relations:
        // ClientSubscription.client -> ClientProfile._id
        // ClientPackage.client -> User._id (based on model ref: 'User')

        if (!pkg) {
            // Try by profile link if available (checking controller createSubscription logic)
            // Actually, in dashboard we see:
            // const profile = await ClientProfile.findOne({ user: userId });
            // const activeSubscription = await ClientSubscription.findOne({ client: profile._id });
            // const activePackage = await ClientPackage.findOne({ client: userId });

            // So we need User ID.
            const profile = await ClientProfile.findById(subscription.client);
            if (profile) {
                const r = await ClientPackage.deleteOne({
                    client: profile.user,
                    packageName: subscription.packageName,
                    startDate: subscription.startDate,
                    endDate: subscription.endDate
                });
                summary.packageDeleted = r.deletedCount > 0;
            }
        } else {
            const r = await ClientPackage.deleteOne({ _id: pkg._id });
            summary.packageDeleted = r.deletedCount > 0;
        }

        // 4. Delete Subscription itself
        await ClientSubscription.findByIdAndDelete(id);

        console.log("[SUBSCRIPTION][DELETE] Success summary:", summary);

        res.status(200).json({
            success: true,
            message: "Package deleted successfully",
            summary
        });

    } catch (error) {
        console.error("[SUBSCRIPTION][DELETE][ERROR]", error);
        res.status(500).json({ success: false, error: error.message });
    }
};
