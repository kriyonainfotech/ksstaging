const Attendance = require("../models/Attendance");
const TeamProfile = require("../models/TeamProfile");
const User = require("../models/user");
const PaymentCollection = require("../models/PaymentCollection");
const { startOfMonth, endOfMonth, eachDayOfInterval, isSunday, startOfDay, endOfDay, format } = require("date-fns");
const mongoose = require("mongoose");

// Helper to calculate working days in a month (excluding Sundays)
const getWorkingDaysInMonth = (date) => {
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    return allDays.filter(day => !isSunday(day));
};

// Helper to calculate earned salary for a user in a specific month
const calculateEarnedSalary = async (userId, month, year, baseSalary) => {
    try {
        const targetDate = new Date(year, month - 1, 1);
        const monthStart = startOfMonth(targetDate);
        const monthEnd = endOfMonth(targetDate);

        const workingDays = getWorkingDaysInMonth(targetDate);
        const totalWorkingDaysCount = workingDays.length;

        const attendanceRecords = await Attendance.find({
            user: userId,
            date: { $gte: monthStart, $lte: monthEnd }
        });

        let presentDays = 0;
        let halfDays = 0;
        attendanceRecords.forEach(r => {
            if (r.status === 'Full Day') presentDays++;
            else if (r.status === 'Half Day') halfDays++;
        });

        const dailyRate = totalWorkingDaysCount > 0 ? baseSalary / totalWorkingDaysCount : 0;
        const earned = (presentDays * dailyRate) + (halfDays * dailyRate * 0.5);

        return {
            earned: Math.round(earned),
            present: presentDays,
            half: halfDays,
            totalWorkingDays: totalWorkingDaysCount
        };
    } catch (error) {
        console.error(`Error calculating salary for user ${userId}:`, error);
        return { earned: 0, present: 0, half: 0, totalWorkingDays: 0 };
    }
};

// @desc    Get personal wallet stats for current month
// @route   GET /api/salary/wallet
exports.getMyWalletStats = async (req, res) => {
    try {
        const userId = req.user._id;
        const { month, year } = req.query;
        const now = new Date();

        let salaryAmount = 0;
        let member = await User.findById(userId);

        if (member && member.salary && member.salary.amount) {
            salaryAmount = member.salary.amount;
        } else {
            // Fallback to TeamProfile
            const profile = await TeamProfile.findOne({ user: userId });
            if (profile && profile.salary && profile.salary.amount) {
                salaryAmount = profile.salary.amount;
            }
        }

        const targetMonth = parseInt(month) || now.getMonth() + 1;
        const targetYear = parseInt(year) || now.getFullYear();
        const stats = await calculateEarnedSalary(userId, targetMonth, targetYear, salaryAmount);

        res.status(200).json({
            success: true,
            data: {
                earnedSalary: stats.earned,
                baseSalary: salaryAmount,
                dailyRate: stats.totalWorkingDays > 0 ? Math.round(salaryAmount / stats.totalWorkingDays) : 0,
                totalWorkingDaysCount: stats.totalWorkingDays,
                attendanceSummary: {
                    present: stats.present,
                    halfDay: stats.half,
                    leave: stats.totalWorkingDays - (stats.present + stats.half)
                }
            }
        });

    } catch (error) {
        console.error("[Salary] Wallet Stats Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get payroll summary stats (Superadmin Only)
exports.getPayrollStats = async (req, res) => {
    try {
        const { month, year } = req.query;
        const targetMonth = parseInt(month) || new Date().getMonth() + 1;
        const targetYear = parseInt(year) || new Date().getFullYear();

        const targetDate = new Date(targetYear, targetMonth - 1, 1);
        const monthStart = startOfMonth(targetDate);
        const monthEnd = endOfMonth(targetDate);

        console.log(`[Salary] Stats Requested for ${targetMonth}/${targetYear}`);

        const allPotentialMembers = await User.find({
            role: { $in: ["Admin", "Team"] },
            isActive: true
        });

        // Filter members who were actually in the team during/before this month
        const activeMembersInMonth = allPotentialMembers.filter(m => {
            const joined = m.joinedDate || m.createdAt;
            return joined <= monthEnd;
        });

        let totalFixed = 0;
        let totalAccrued = 0;

        for (const m of activeMembersInMonth) {
            let baseSalary = m.salary?.amount || 0;

            // 🔍 Fallback for legacy users
            if (!baseSalary) {
                const profile = await TeamProfile.findOne({ user: m._id });
                if (profile && profile.salary?.amount) {
                    baseSalary = profile.salary.amount;
                }
            }

            totalFixed += baseSalary;

            const earnedData = await calculateEarnedSalary(m._id, targetMonth, targetYear, baseSalary);
            totalAccrued += earnedData.earned;
        }

        const disbursements = await PaymentCollection.find({
            transactionType: "Expense",
            expenseCategory: "Salary",
            salaryMonth: targetMonth,
            salaryYear: targetYear
        });

        const totalDisbursed = disbursements.reduce((sum, d) => sum + d.amountCollected, 0);

        console.log(`[Salary] Calculation for ${targetMonth}/${targetYear}:`);
        console.log(` - Found ${disbursements.length} salary disbursements.`);
        disbursements.forEach(d => {
            console.log(`   └ ₹${d.amountCollected} | To: ${d.payerName || 'N/A'} | Date: ${format(d.collectionDate, "yyyy-MM-dd")} | Note: ${d.notes || 'No note'}`);
        });
        console.log(` - TOTAL DISBURSED: ₹${totalDisbursed}`);

        const workingDays = getWorkingDaysInMonth(targetDate);
        const totalWorkingDaysCount = workingDays.length;

        res.status(200).json({
            success: true,
            data: {
                totalPayroll: totalFixed,
                accruedTillDate: totalAccrued,
                disbursed: totalDisbursed,
                workingDaysCount: totalWorkingDaysCount
            }
        });
    } catch (error) {
        console.error("[Salary] Stats Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get payroll list grouped or flat (Superadmin Only)
exports.getPayrollList = async (req, res) => {
    try {
        const { month, year, tab } = req.query;
        const targetMonth = parseInt(month) || new Date().getMonth() + 1;
        const targetYear = parseInt(year) || new Date().getFullYear();
        const targetDate = new Date(targetYear, targetMonth - 1, 1);
        const monthStart = startOfMonth(targetDate);
        const monthEnd = endOfMonth(targetDate);

        console.log(`[Salary] List Requested: Tab=${tab}, Date=${targetMonth}/${targetYear}`);

        let query = {};
        if (tab === 'All') {
            query.role = { $in: ["Superadmin", "Admin", "Team"] };
        } else if (tab === 'Admins') {
            query.role = "Admin";
        } else if (tab === 'Superadmins') {
            query.role = "Superadmin";
        } else {
            // Default: Team
            query.role = "Team";
        }

        let members = await User.find(query);

        // Filter by joining date
        members = members.filter(m => {
            const joined = m.joinedDate || m.createdAt;
            return joined <= monthEnd;
        });

        console.log(`[Salary] Found ${members.length} members for tab ${tab}`);

        const list = await Promise.all(members.map(async (m) => {
            let baseSalary = m.salary?.amount || 0;

            // 🔍 Fallback to TeamProfile if not found on root model (Legacy Users)
            if (!baseSalary) {
                const profile = await TeamProfile.findOne({ user: m._id });
                if (profile && profile.salary?.amount) {
                    baseSalary = profile.salary.amount;
                }
            }

            const earnedInfo = await calculateEarnedSalary(m._id, targetMonth, targetYear, baseSalary);

            const todayRecord = await Attendance.findOne({
                user: m._id,
                date: { $gte: startOfDay(new Date()), $lte: endOfDay(new Date()) }
            });

            let todayStatus = "Absent";
            if (todayRecord) {
                if (todayRecord.status === 'Full Day' || todayRecord.status === 'Half Day') todayStatus = "Clocked In";
            }

            const disbursements = await PaymentCollection.find({
                transactionType: "Expense",
                expenseCategory: "Salary",
                $or: [
                    { payerName: m.name },
                    { notes: { $regex: m.name, $options: 'i' } }
                ],
                salaryMonth: targetMonth,
                salaryYear: targetYear
            });
            const paid = disbursements.reduce((sum, d) => sum + d.amountCollected, 0);

            return {
                _id: m._id,
                name: m.name,
                email: m.email,
                role: m.role || tab,
                profilePic: m.profilePic?.url || m.photo || null,
                timing: m.timing || { start: "09:00 AM", end: "07:00 PM" },
                department: m.specialization || "Other",
                baseSalary,
                earnedBalance: earnedInfo.earned,
                paidAmount: paid,
                attendance: {
                    present: earnedInfo.present,
                    half: earnedInfo.half,
                    totalWorking: earnedInfo.totalWorkingDays
                },
                todayStatus
            };
        }));

        res.status(200).json({
            success: true,
            data: list
        });

    } catch (error) {
        console.error("[Salary] List Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Record salary payment as expense
exports.recordSalaryPayment = async (req, res) => {
    try {
        const {
            userId,
            userName,
            amount,
            company,
            paymentSource,
            notes,
            date,
            salaryMonth,
            salaryYear
        } = req.body;

        if (!userId || !amount || !company || !paymentSource) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const expense = await PaymentCollection.create({
            createdBy: req.user._id,
            transactionType: "Expense",
            payerName: userName,
            amountCollected: Number(amount),
            amountLoss: 0,
            company: company,
            expenseCategory: "Salary",
            destinationAccount: paymentSource,
            collectionDate: date || new Date(),
            salaryMonth: salaryMonth || new Date(date || new Date()).getMonth() + 1,
            salaryYear: salaryYear || new Date(date || new Date()).getFullYear(),
            notes: notes || `Salary Payment for ${format(new Date(date || new Date()), "MMMM yyyy")}`
        });

        res.status(201).json({
            success: true,
            message: "Salary payment recorded successfully",
            data: expense
        });
    } catch (error) {
        console.error("[Salary] Pay Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get attendance logs for a user
exports.getAttendanceLogs = async (req, res) => {
    try {
        const { userId } = req.params;
        const { month, year } = req.query;
        const targetMonth = parseInt(month) || new Date().getMonth() + 1;
        const targetYear = parseInt(year) || new Date().getFullYear();

        const monthStart = startOfMonth(new Date(targetYear, targetMonth - 1, 1));
        const monthEnd = endOfMonth(new Date(targetYear, targetMonth - 1, 1));

        const logs = await Attendance.find({
            user: userId,
            date: { $gte: monthStart, $lte: monthEnd }
        }).sort({ date: 1 });

        res.status(200).json({
            success: true,
            data: logs
        });
    } catch (error) {
        console.error("[Salary] Logs Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getTeamSalaryOverview = async (req, res) => {
    return exports.getPayrollList(req, res);
};
