const Client = require("../models/Client");
const Task = require("../models/Task");
const ClientSubscription = require("../models/ClientSubscription");
const Lead = require("../models/Lead");
const User = require("../models/user");
const PaymentSale = require("../models/PaymentSale");
const PaymentCollection = require("../models/PaymentCollection");
const TeamProfile = require("../models/TeamProfile");
const { startOfDay, endOfDay } = require("date-fns");

// exports.getFinancialStats = async (req, res) => {
//     try {
//         const monthStart = new Date();
//         monthStart.setDate(1);
//         monthStart.setHours(0, 0, 0, 0);

//         const monthEnd = new Date();
//         monthEnd.setMonth(monthEnd.getMonth() + 1);
//         monthEnd.setDate(0);
//         monthEnd.setHours(23, 59, 59, 999);

//         const companyName = req.user.activeCompanyName;

//         // If no company context is set, Superadmin sees ALL data (Global View), others see 0 (Security)
//         let filter = {};
//         if (companyName) {
//             filter.company = companyName;
//         } else if (req.user.role !== "Superadmin") {
//             filter.company = "NONE_SELECTED"; // Ensures 0 results for users without company context
//         }

//         const salesData = await PaymentSale.aggregate([
//             { $match: { ...filter, saleDate: { $gte: monthStart, $lte: monthEnd } } },
//             {
//                 $group: {
//                     _id: null,
//                     totalSales: { $sum: "$totalAmount" },
//                     totalOutstanding: {
//                         $sum: {
//                             $cond: [{ $gt: ["$remainingAmount", 0] }, "$remainingAmount", 0]
//                         }
//                     },
//                     totalRecovery: { $sum: { $subtract: ["$totalAmount", "$remainingAmount"] } }
//                 }
//             }
//         ]);

//         const totalSales = salesData.length > 0 ? salesData[0].totalSales : 0;
//         const totalOutstanding = salesData.length > 0 ? salesData[0].totalOutstanding : 0; 

//         // 1. Monthly Collections (Actual money received this month, regardless of sale date)
//         const monthlyCollections = await PaymentCollection.aggregate([
//             { $match: { ...filter, collectionDate: { $gte: monthStart, $lte: monthEnd }, transactionType: "Income" } },
//             { $group: { _id: null, total: { $sum: "$amountCollected" } } }
//         ]);
//         const totalCollection = monthlyCollections.length > 0 ? monthlyCollections[0].total : 0;

//         const allTimeIncome = await PaymentCollection.aggregate([
//             { $match: { ...filter, transactionType: "Income" } },
//             { $group: { _id: null, total: { $sum: "$amountCollected" } } }
//         ]);

//         const allTimeExpense = await PaymentCollection.aggregate([
//             { $match: { ...filter, transactionType: "Expense" } },
//             { $group: { _id: null, total: { $sum: "$amountCollected" } } }
//         ]);

//         const monthlyExpenses = await PaymentCollection.aggregate([
//             { $match: { ...filter, collectionDate: { $gte: monthStart, $lte: monthEnd }, transactionType: "Expense" } },
//             { $group: { _id: null, totalExpense: { $sum: "$amountCollected" } } }
//         ]);

//         const totalMonthlyExpense = monthlyExpenses.length > 0 ? monthlyExpenses[0].totalExpense : 0;
//         const netIncome = allTimeIncome.length > 0 ? allTimeIncome[0].total : 0;
//         const netExpense = allTimeExpense.length > 0 ? allTimeExpense[0].total : 0;
//         const totalAvailableFunds = netIncome - netExpense;

//         res.status(200).json({
//             success: true,
//             financials: {
//                 sales: totalSales,
//                 collection: totalCollection,
//                 expense: totalMonthlyExpense,
//                 outstanding: totalOutstanding,
//                 totalAvailableFunds: totalAvailableFunds
//             }
//         });
//     } catch (error) {
//         console.error("Financial Stats Error:", error);
//         res.status(500).json({ success: false, message: "Server Error" });
//     }
// };

exports.getFinancialStats = async (req, res) => {
    try {
        console.log("\n================ FINANCIAL STATS API ================\n");

        const now = new Date();

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        monthStart.setHours(0, 0, 0, 0);

        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);

        console.log("📅 Current Date:", now);
        console.log("📅 Month Start:", monthStart);
        console.log("📅 Month End:", monthEnd);

        const companyName = req.user.activeCompanyName;
        const isGlobalSuperadmin = req.user.isGlobalSuperadmin || false;

        console.log("👤 Logged in User:", req.user.name, `(${req.user.email})`);
        console.log("🏢 Active Company:", companyName);
        console.log("🌍 isGlobalSuperadmin:", isGlobalSuperadmin);
        console.log("👮 User Role:", req.user.role);

        let filter = {};

        // GLOBAL SUPERADMIN LOGIC: 
        // If Global Superadmin, show EVERYTHING (no filter). 
        // Otherwise, filter by activeCompanyName.
        if (isGlobalSuperadmin) {
            filter = {}; // No filter
            console.log("🔓 Global Superadmin detected: Bypassing company filter.");
        } else {
            // All other users (including normal Superadmins) MUST use activeCompanyName
            filter.company = companyName || "NONE_SELECTED";
            console.log(`🔒 Applying company filter: ${companyName || "NONE_SELECTED"}`);
        }

        console.log("🔍 Final Applied Filter:", filter);

        // =====================================================
        // 1. CURRENT MONTH SALES + OUTSTANDING
        // =====================================================

        console.log("\n📈 FETCHING SALES DATA...\n");

        const salesMatch = {
            ...filter,
            saleDate: {
                $gte: monthStart,
                $lte: monthEnd
            }
        };

        console.log("🧾 Sales Match Query:", JSON.stringify(salesMatch, null, 2));

        const salesData = await PaymentSale.aggregate([
            {
                $match: salesMatch
            },
            {
                $group: {
                    _id: null,
                    sales: { $sum: "$totalAmount" },
                    collection: { $sum: "$collectedAmount" },
                    outstanding: {
                        $sum: {
                            $cond: [{ $gt: ["$remainingAmount", 0] }, "$remainingAmount", 0]
                        }
                    }
                }
            }
        ]);

        console.log("📊 Sales Aggregation Result:", salesData);

        // =====================================================
        // 2. CURRENT MONTH COLLECTION
        // =====================================================

        console.log("\n💰 FETCHING COLLECTION DATA...\n");

        const collectionMatch = {
            ...filter,
            transactionType: "Income",
            collectionDate: {
                $gte: monthStart,
                $lte: monthEnd
            }
        };

        console.log("🧾 Collection Match Query:", JSON.stringify(collectionMatch, null, 2));

        const collectionData = await PaymentCollection.aggregate([
            {
                $match: collectionMatch
            },
            {
                $group: {
                    _id: null,
                    collection: { $sum: "$amountCollected" }
                }
            }
        ]);

        console.log("📊 Collection Aggregation Result:", collectionData);

        // =====================================================
        // =====================================================
        // 3. ALL TIME FUNDS
        // =====================================================

        console.log("\n🏦 FETCHING FUNDS DATA...\n");

        const fundsMatch = {
            ...filter
        };

        console.log("🧾 Funds Match Query:", JSON.stringify(fundsMatch, null, 2));

        const fundData = await PaymentCollection.aggregate([
            {
                $match: fundsMatch
            },
            {
                $group: {
                    _id: "$transactionType",
                    total: { $sum: "$amountCollected" }
                }
            }
        ]);

        console.log("📊 Funds Aggregation Result:", fundData);

        // =====================================================
        // 4. ALL TIME OUTSTANDING
        // =====================================================

        console.log("\n⏳ FETCHING ALL TIME OUTSTANDING DATA...\n");

        const totalOutstandingData = await PaymentSale.aggregate([
            {
                $match: filter
            },
            {
                $group: {
                    _id: null,
                    totalOutstanding: {
                        $sum: {
                            $cond: [{ $gt: ["$remainingAmount", 0] }, "$remainingAmount", 0]
                        }
                    }
                }
            }
        ]);

        console.log("📊 Outstanding Aggregation Result:", totalOutstandingData);

        // =====================================================
        // FINAL VALUES
        // =====================================================

        const sales = salesData[0]?.sales || 0;
        const outstanding = salesData[0]?.outstanding || 0;
        const collection = salesData[0]?.collection || 0;
        const totalOutstanding = totalOutstandingData[0]?.totalOutstanding || 0;

        const totalIncome =
            fundData.find(item => item._id === "Income")?.total || 0;

        const totalExpense =
            fundData.find(item => item._id === "Expense")?.total || 0;

        const totalAvailableFunds = totalIncome - totalExpense;

        console.log("\n================ FINAL CALCULATED VALUES ================\n");

        console.log("💵 Sales:", sales);
        console.log("💵 Collection:", collection);
        console.log("💵 Outstanding:", outstanding);
        console.log("💵 Total Outstanding:", totalOutstanding);

        console.log("💵 Total Income:", totalIncome);
        console.log("💵 Total Expense:", totalExpense);

        console.log("💵 Total Available Funds:", totalAvailableFunds);

        console.log("\n=========================================================\n");

        return res.status(200).json({
            success: true,
            financials: {
                sales,
                collection,
                outstanding,
                totalAvailableFunds,
                totalOutstanding
            }
        });

    } catch (error) {

        console.error("\n❌ FINANCIAL STATS ERROR ❌\n");
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Server Error"
        });
    }
};

exports.getTaskStats = async (req, res) => {
    try {
        const userId = req.user.id;

        const myTaskCount = await Task.countDocuments({ type: "Personal", assignedTo: userId });
        const superadmins = await User.find({ role: "Superadmin" }, "_id name email");
        const saIds = superadmins.map(s => s._id.toString()).filter(id => id !== userId);
        const partnerTaskCount = await Task.countDocuments({ type: "Personal", assignedTo: { $in: saIds } });
        const teamTaskCount = await Task.countDocuments({ type: "Team" });
        const adminTaskCount = await Task.countDocuments({ type: "Admin" });

        const today = new Date();
        const superadminIds = superadmins.map(s => s._id);

        const todayFilter = {
            $or: [
                // 1. Pending/Done tasks strictly due today
                {
                    dueDate: { $gte: startOfDay(today), $lte: endOfDay(today) }
                },
                // 2. Tasks completed/posted today (in case a past task was completed today)
                {
                    completedAt: { $gte: startOfDay(today), $lte: endOfDay(today) }
                }
            ]
        };

        const todayTasks = await Task.find({
            assignedTo: { $in: superadminIds },
            ...todayFilter
        })
            .populate("client", "businessName")
            .populate("assignedTo", "name email")
            .sort({ dueDate: 1 })
            .lean();

        const allTeamTasks = await Task.find({
            type: "Team",
            ...todayFilter
        })
            .populate("assignedTo", "name")
            .populate("client", "businessName")
            .sort({ dueDate: 1 })
            .lean();

        const allAdminTasks = await Task.find({
            type: "Admin",
            ...todayFilter
        })
            .populate("assignedTo", "name")
            .populate("client", "businessName")
            .sort({ dueDate: 1 })
            .lean();

        const teamTaskWithSpecialization = await Promise.all(allTeamTasks.map(async (task) => {
            const profile = await TeamProfile.findOne({ user: task.assignedTo?._id }, "specialization");
            return { ...task, specialization: profile?.specialization || "" };
        }));

        const adminTaskWithSpecialization = await Promise.all(allAdminTasks.map(async (task) => {
            const profile = await TeamProfile.findOne({ user: task.assignedTo?._id }, "specialization");
            return { ...task, specialization: profile?.specialization || "" };
        }));

        const teamWorkload = await Task.aggregate([
            { $match: { status: { $nin: ["Done", "Completed", "Posted"] } } },
            { $group: { _id: "$assignedTo", activeTasks: { $sum: 1 } } },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },
            {
                $project: {
                    name: "$user.name",
                    role: "$user.role",
                    activeTasks: 1
                }
            }
        ]);

        res.status(200).json({
            success: true,
            tasks: {
                myTasks: myTaskCount,
                partnerTasks: partnerTaskCount,
                teamTasks: teamTaskCount,
                adminTasks: adminTaskCount
            },
            superadminsList: superadmins.map(s => ({ _id: s._id, name: s.name, email: s.email })),
            todayTasks,
            allTeamTasks: teamTaskWithSpecialization,
            allAdminTasks: adminTaskWithSpecialization,
            teamWorkload
        });
    } catch (error) {
        console.error("Task Stats Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

exports.getUserStats = async (req, res) => {
    try {
        const totalClients = await User.countDocuments({ role: "Client" });
        const totalLeads = await Lead.countDocuments();
        const totalSuperadmin = await User.countDocuments({ role: "Superadmin" });
        const totalAdmin = await User.countDocuments({ role: "Admin" });
        const totalTeam = await User.countDocuments({ role: "Team" });

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);

        const clientGrowth = await User.aggregate([
            { $match: { role: "Client", createdAt: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
                    total: { $sum: 1 }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        const formattedClientGrowth = clientGrowth.map(r => {
            const date = new Date(r._id.year, r._id.month - 1);
            return {
                name: date.toLocaleString('default', { month: 'short' }),
                total: r.total
            };
        });

        res.status(200).json({
            success: true,
            kpi: {
                totalClients,
                totalLeads,
                totalSuperadmin,
                totalAdmin,
                totalTeam
            },
            clientGrowth: formattedClientGrowth
        });
    } catch (error) {
        console.error("User Stats Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
