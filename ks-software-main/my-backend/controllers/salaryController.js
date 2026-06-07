const Attendance = require("../models/Attendance");
const TeamProfile = require("../models/TeamProfile");
const AdminProfile = require("../models/AdminProfile");
const SalaryProfile = require("../models/SalaryProfile");
const PayrollRun = require("../models/PayrollRun");
const PayrollLine = require("../models/PayrollLine");
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

const getSalaryProfileForUser = async (user) => {
    const userId = user?._id || user;
    if (!userId) {
        return {
            baseSalary: 0,
            salaryType: "Monthly",
            currency: "INR",
            bankInfo: {},
            paymentPreferences: {},
            source: "none"
        };
    }

    const salaryProfile = await SalaryProfile.findOne({
        user: userId,
        isActive: true
    }).lean();

    if (salaryProfile) {
        return {
            profileId: salaryProfile._id,
            baseSalary: salaryProfile.salary?.amount || 0,
            salaryType: salaryProfile.salary?.type || "Monthly",
            currency: salaryProfile.salary?.currency || "INR",
            bankInfo: salaryProfile.bankInfo || {},
            paymentPreferences: salaryProfile.paymentPreferences || {},
            effectiveFrom: salaryProfile.effectiveFrom,
            effectiveTo: salaryProfile.effectiveTo,
            source: "SalaryProfile"
        };
    }

    if (user?.salary?.amount) {
        return {
            baseSalary: user.salary.amount,
            salaryType: user.salary.type || "Monthly",
            currency: user.salary.currency || "INR",
            bankInfo: user.bankInfo || {},
            paymentPreferences: {},
            source: "User"
        };
    }

    const teamProfile = await TeamProfile.findOne({ user: userId }).lean();
    const adminProfile = teamProfile ? null : await AdminProfile.findOne({ user: userId }).lean();
    const profile = teamProfile || adminProfile;

    return {
        baseSalary: profile?.salary?.amount || 0,
        salaryType: profile?.salary?.type || "Monthly",
        currency: profile?.salary?.currency || "INR",
        bankInfo: profile?.bankInfo || {},
        paymentPreferences: {},
        source: teamProfile ? "TeamProfile" : adminProfile ? "AdminProfile" : "none"
    };
};

// Helper to calculate earned salary for a user in a specific month
const calculateEarnedSalary = async (userId, month, year, baseSalary) => {
    try {
        const targetDate = new Date(year, month - 1, 1);
        const monthStart = startOfMonth(targetDate);
        const monthEnd = endOfMonth(targetDate);

        const workingDays = getWorkingDaysInMonth(targetDate);
        const totalWorkingDaysCount = workingDays.length;

        const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const sundaysCount = allDays.filter(day => isSunday(day)).length;

        const attendanceRecords = await Attendance.find({
            user: userId,
            date: { $gte: monthStart, $lte: monthEnd }
        });

        let presentDays = 0;
        let halfDays = 0;
        let leaveDays = 0;
        attendanceRecords.forEach(r => {
            if (r.status === 'Full Day') presentDays++;
            else if (r.status === 'Half Day') halfDays++;
            else if (r.status === 'Leave') leaveDays++;
        });

        const dailyRate = totalWorkingDaysCount > 0 ? baseSalary / totalWorkingDaysCount : 0;
        const earned = (presentDays * dailyRate) + (halfDays * dailyRate * 0.5);
        const absentDays = Math.max(totalWorkingDaysCount - (presentDays + halfDays + leaveDays), 0);

        return {
            earned: Math.round(earned),
            present: presentDays,
            half: halfDays,
            leave: leaveDays,
            absent: absentDays,
            sundays: sundaysCount,
            totalWorkingDays: totalWorkingDaysCount,
            monthDays: allDays.length,
            paidDays: presentDays + (halfDays * 0.5)
        };
    } catch (error) {
        console.error(`Error calculating salary for user ${userId}:`, error);
        return { earned: 0, present: 0, half: 0, leave: 0, absent: 0, sundays: 0, totalWorkingDays: 0, monthDays: 0, paidDays: 0 };
    }
};

const getPayrollUsersForMonth = async (monthEnd, tab = "All") => {
    const query = {
        isActive: true
    };

    if (tab === "All") {
        query.role = { $in: ["Superadmin", "Admin", "Team"] };
    } else if (tab === "Admins") {
        query.role = "Admin";
    } else if (tab === "Superadmins") {
        query.role = "Superadmin";
    } else {
        query.role = "Team";
    }

    const members = await User.find(query);
    return members.filter(m => {
        const joined = m.joinedDate || m.createdAt;
        return joined <= monthEnd;
    });
};

const normalizeTiming = (timing) => ({
    start: timing?.start || "09:00 AM",
    end: timing?.end || "07:00 PM"
});

const getMemberProfileForPayroll = async (member) => {
    let profile = null;

    if (member.role === "Team") {
        profile = await TeamProfile.findOne({ user: member._id }).lean();
    } else if (member.role === "Admin" || member.role === "Superadmin") {
        profile = await AdminProfile.findOne({ user: member._id }).lean();
    }

    return {
        department: profile?.specialization || member.specialization || "Other",
        timing: normalizeTiming(profile?.timing || member.timing)
    };
};

const buildPayrollLineSnapshot = async (member, payrollRun, month, year) => {
    const salaryProfile = await getSalaryProfileForUser(member);
    const memberProfile = await getMemberProfileForPayroll(member);
    const earnedInfo = await calculateEarnedSalary(member._id, month, year, salaryProfile.baseSalary);

    const disbursements = await PaymentCollection.find({
        transactionType: "Expense",
        expenseCategory: "Salary",
        $or: [
            { salaryUser: member._id },
            { payerName: member.name },
            { notes: { $regex: member.name, $options: "i" } }
        ],
        salaryMonth: month,
        salaryYear: year
    });
    const paid = disbursements.reduce((sum, d) => sum + d.amountCollected, 0);
    const pending = Math.max(earnedInfo.earned - paid, 0);

    let status = "Pending";
    if (earnedInfo.earned > 0 && paid >= earnedInfo.earned) status = "Paid";
    else if (paid > 0) status = "Partially Paid";

    return {
        payrollRun: payrollRun._id,
        user: member._id,
        employeeSnapshot: {
            name: member.name,
            email: member.email,
            role: member.role,
            department: memberProfile.department,
            profilePic: member.profilePic?.url || member.photo || null,
            timing: memberProfile.timing
        },
        salarySnapshot: {
            baseSalary: salaryProfile.baseSalary,
            salaryType: salaryProfile.salaryType,
            currency: salaryProfile.currency,
            salaryProfile: salaryProfile.profileId,
            salarySource: salaryProfile.source,
            bankInfo: salaryProfile.bankInfo
        },
        attendanceSnapshot: {
            present: earnedInfo.present,
            half: earnedInfo.half,
            leave: earnedInfo.leave,
            absent: earnedInfo.absent,
            sundays: earnedInfo.sundays,
            totalWorking: earnedInfo.totalWorkingDays,
            monthDays: earnedInfo.monthDays,
            paidDays: earnedInfo.paidDays
        },
        amounts: {
            earned: earnedInfo.earned,
            paid,
            pending
        },
        status,
        paymentCollections: disbursements.map(d => d._id)
    };
};

const calculatePayrollRunTotals = (lines) => {
    const totals = lines.reduce((acc, line) => {
        const attendance = line.attendanceSnapshot || {};
        const amounts = line.amounts || {};
        const salary = line.salarySnapshot || {};

        acc.employees += 1;
        acc.baseSalary += salary.baseSalary || 0;
        acc.earned += amounts.earned || 0;
        acc.paid += amounts.paid || 0;
        acc.pending += amounts.pending || 0;
        acc.present += attendance.present || 0;
        acc.half += attendance.half || 0;
        acc.leave += attendance.leave || 0;
        acc.absent += attendance.absent || 0;
        acc.sundays = Math.max(acc.sundays, attendance.sundays || 0);
        acc.workingDays = Math.max(acc.workingDays, attendance.totalWorking || 0);
        acc.monthDays = Math.max(acc.monthDays, attendance.monthDays || 0);
        return acc;
    }, {
        employees: 0,
        baseSalary: 0,
        earned: 0,
        paid: 0,
        pending: 0,
        present: 0,
        half: 0,
        leave: 0,
        absent: 0,
        sundays: 0,
        workingDays: 0,
        monthDays: 0
    });

    return totals;
};

const syncPayrollRunTotals = async (payrollRunId) => {
    const lines = await PayrollLine.find({ payrollRun: payrollRunId });
    const totals = calculatePayrollRunTotals(lines);
    const status = lines.length > 0 && lines.every(line => line.status === "Paid") ? "Paid" : undefined;

    const update = { totals };
    if (status) update.status = status;

    return PayrollRun.findByIdAndUpdate(payrollRunId, { $set: update }, { new: true });
};

const mapPayrollLineForList = async (line) => {
    const member = line.user;
    const todayRecord = member?._id ? await Attendance.findOne({
        user: member._id,
        date: { $gte: startOfDay(new Date()), $lte: endOfDay(new Date()) }
    }) : null;

    let todayStatus = "Absent";
    if (todayRecord && (todayRecord.status === "Full Day" || todayRecord.status === "Half Day")) {
        todayStatus = "Clocked In";
    }

    const employee = line.employeeSnapshot || {};
    const salary = line.salarySnapshot || {};
    const attendance = line.attendanceSnapshot || {};
    const amounts = line.amounts || {};

    return {
        _id: member?._id || line.user,
        payrollRunId: line.payrollRun,
        payrollLineId: line._id,
        lineStatus: line.status,
        name: employee.name,
        email: employee.email,
        role: employee.role,
        profilePic: employee.profilePic || null,
        timing: employee.timing || { start: "09:00 AM", end: "07:00 PM" },
        department: employee.department || "Other",
        baseSalary: salary.baseSalary || 0,
        salaryType: salary.salaryType || "Monthly",
        currency: salary.currency || "INR",
        bankInfo: salary.bankInfo || {},
        salaryProfileId: salary.salaryProfile,
        salarySource: salary.salarySource,
        earnedBalance: amounts.earned || 0,
        paidAmount: amounts.paid || 0,
        attendance: {
            present: attendance.present || 0,
            half: attendance.half || 0,
            leave: attendance.leave || 0,
            absent: attendance.absent || 0,
            sundays: attendance.sundays || 0,
            totalWorking: attendance.totalWorking || 0,
            monthDays: attendance.monthDays || 0,
            paidDays: attendance.paidDays || 0
        },
        todayStatus
    };
};

// @desc    Get personal wallet stats for current month
// @route   GET /api/salary/wallet
exports.getMyWalletStats = async (req, res) => {
    try {
        const userId = req.user._id;
        const { month, year } = req.query;
        const now = new Date();

        let member = await User.findById(userId);
        const salaryProfile = await getSalaryProfileForUser(member || userId);
        const salaryAmount = salaryProfile.baseSalary;

        const targetMonth = parseInt(month) || now.getMonth() + 1;
        const targetYear = parseInt(year) || now.getFullYear();
        const stats = await calculateEarnedSalary(userId, targetMonth, targetYear, salaryAmount);

        res.status(200).json({
            success: true,
            data: {
                earnedSalary: stats.earned,
                baseSalary: salaryAmount,
                salaryType: salaryProfile.salaryType,
                currency: salaryProfile.currency,
                bankInfo: salaryProfile.bankInfo,
                salaryProfileId: salaryProfile.profileId,
                salarySource: salaryProfile.source,
                dailyRate: stats.totalWorkingDays > 0 ? Math.round(salaryAmount / stats.totalWorkingDays) : 0,
                totalWorkingDaysCount: stats.totalWorkingDays,
                attendanceSummary: {
                    present: stats.present,
                    halfDay: stats.half,
                    leave: stats.leave,
                    absent: stats.absent,
                    sundays: stats.sundays,
                    totalWorking: stats.totalWorkingDays,
                    monthDays: stats.monthDays,
                    paidDays: stats.paidDays
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

        const existingRun = await PayrollRun.findOne({ month: targetMonth, year: targetYear }).lean();
        if (existingRun) {
            const totals = existingRun.totals || {};
            return res.status(200).json({
                success: true,
                data: {
                    totalPayroll: totals.baseSalary || 0,
                    accruedTillDate: totals.earned || 0,
                    disbursed: totals.paid || 0,
                    workingDaysCount: totals.workingDays || getWorkingDaysInMonth(targetDate).length,
                    sundaysCount: totals.sundays || 0,
                    payrollRun: {
                        _id: existingRun._id,
                        status: existingRun.status,
                        generatedAt: existingRun.createdAt,
                        finalizedAt: existingRun.finalizedAt
                    }
                }
            });
        }

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
            const salaryProfile = await getSalaryProfileForUser(m);
            const baseSalary = salaryProfile.baseSalary;

            // 🔍 Fallback for legacy users
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
        const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const sundaysCount = allDays.filter(day => isSunday(day)).length;

        res.status(200).json({
            success: true,
            data: {
                totalPayroll: totalFixed,
                accruedTillDate: totalAccrued,
                disbursed: totalDisbursed,
                workingDaysCount: totalWorkingDaysCount,
                sundaysCount,
                payrollRun: null
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

        const existingRun = await PayrollRun.findOne({ month: targetMonth, year: targetYear });
        if (existingRun) {
            const roleFilter = {};
            if (tab === "Admins") roleFilter["employeeSnapshot.role"] = "Admin";
            else if (tab === "Superadmins") roleFilter["employeeSnapshot.role"] = "Superadmin";
            else if (tab !== "All") roleFilter["employeeSnapshot.role"] = "Team";

            const lines = await PayrollLine.find({
                payrollRun: existingRun._id,
                ...roleFilter
            }).populate("user").sort({ "employeeSnapshot.name": 1 });

            const list = await Promise.all(lines.map(mapPayrollLineForList));

            return res.status(200).json({
                success: true,
                data: list,
                payrollRun: {
                    _id: existingRun._id,
                    status: existingRun.status
                }
            });
        }

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
            const salaryProfile = await getSalaryProfileForUser(m);
            const memberProfile = await getMemberProfileForPayroll(m);
            const baseSalary = salaryProfile.baseSalary;

            // 🔍 Fallback to TeamProfile if not found on root model (Legacy Users)
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
                    { salaryUser: m._id },
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
                timing: memberProfile.timing,
                department: memberProfile.department,
                baseSalary,
                salaryType: salaryProfile.salaryType,
                currency: salaryProfile.currency,
                bankInfo: salaryProfile.bankInfo,
                salaryProfileId: salaryProfile.profileId,
                salarySource: salaryProfile.source,
                earnedBalance: earnedInfo.earned,
                paidAmount: paid,
                attendance: {
                    present: earnedInfo.present,
                    half: earnedInfo.half,
                    leave: earnedInfo.leave,
                    absent: earnedInfo.absent,
                    sundays: earnedInfo.sundays,
                    totalWorking: earnedInfo.totalWorkingDays,
                    monthDays: earnedInfo.monthDays,
                    paidDays: earnedInfo.paidDays
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

// @desc    Generate or refresh a monthly payroll run from salary + attendance snapshots
// @route   POST /api/salary/runs/generate
exports.generatePayrollRun = async (req, res) => {
    try {
        const { month, year, force = false, notes } = req.body;
        const targetMonth = parseInt(month) || new Date().getMonth() + 1;
        const targetYear = parseInt(year) || new Date().getFullYear();
        const targetDate = new Date(targetYear, targetMonth - 1, 1);
        const monthEnd = endOfMonth(targetDate);

        let payrollRun = await PayrollRun.findOne({ month: targetMonth, year: targetYear });

        if (payrollRun && payrollRun.status !== "Draft" && !force) {
            return res.status(409).json({
                success: false,
                message: `Payroll for ${targetMonth}/${targetYear} is ${payrollRun.status}. Use force only when you intentionally want to rebuild it.`
            });
        }

        if (!payrollRun) {
            payrollRun = await PayrollRun.create({
                month: targetMonth,
                year: targetYear,
                generatedBy: req.user._id,
                notes
            });
        } else {
            payrollRun.status = "Draft";
            payrollRun.generatedBy = req.user._id;
            payrollRun.finalizedBy = undefined;
            payrollRun.finalizedAt = undefined;
            if (notes !== undefined) payrollRun.notes = notes;
            await payrollRun.save();
        }

        const members = await getPayrollUsersForMonth(monthEnd, "All");
        const touchedLineIds = [];

        for (const member of members) {
            const snapshot = await buildPayrollLineSnapshot(member, payrollRun, targetMonth, targetYear);
            const line = await PayrollLine.findOneAndUpdate(
                { payrollRun: payrollRun._id, user: member._id },
                { $set: snapshot },
                { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
            );

            touchedLineIds.push(line._id);

            await PaymentCollection.updateMany(
                {
                    _id: { $in: line.paymentCollections },
                    expenseCategory: "Salary"
                },
                {
                    $set: {
                        payrollRun: payrollRun._id,
                        payrollLine: line._id,
                        salaryUser: member._id
                    }
                }
            );
        }

        await PayrollLine.deleteMany({
            payrollRun: payrollRun._id,
            _id: { $nin: touchedLineIds }
        });

        payrollRun = await syncPayrollRunTotals(payrollRun._id);
        const lines = await PayrollLine.find({ payrollRun: payrollRun._id }).populate("user").sort({ "employeeSnapshot.name": 1 });

        res.status(200).json({
            success: true,
            message: "Payroll run generated successfully",
            data: {
                payrollRun,
                lines
            }
        });
    } catch (error) {
        console.error("[Salary] Generate Payroll Run Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get a payroll run with lines for a month or run id
exports.getPayrollRun = async (req, res) => {
    try {
        const { runId } = req.params;
        const { month, year } = req.query;

        const query = runId
            ? { _id: runId }
            : { month: parseInt(month), year: parseInt(year) };

        if (!query._id && (!query.month || !query.year)) {
            return res.status(400).json({ success: false, message: "Provide run id or month/year" });
        }

        const payrollRun = await PayrollRun.findOne(query)
            .populate("generatedBy", "name email role")
            .populate("finalizedBy", "name email role");

        if (!payrollRun) {
            return res.status(404).json({ success: false, message: "Payroll run not found" });
        }

        const lines = await PayrollLine.find({ payrollRun: payrollRun._id })
            .populate("user", "name email role profilePic")
            .sort({ "employeeSnapshot.name": 1 });

        res.status(200).json({
            success: true,
            data: {
                payrollRun,
                lines
            }
        });
    } catch (error) {
        console.error("[Salary] Get Payroll Run Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    List saved payroll runs for history
// @route   GET /api/salary/runs/history/list
exports.listPayrollRuns = async (req, res) => {
    try {
        const { status, search } = req.query;
        const query = {};

        if (status && status !== "All") {
            query.status = status;
        }

        const runs = await PayrollRun.find(query)
            .populate("generatedBy", "name email role")
            .populate("finalizedBy", "name email role")
            .sort({ year: -1, month: -1, createdAt: -1 })
            .lean();

        const normalizedSearch = search?.toString().trim().toLowerCase();
        const filteredRuns = normalizedSearch
            ? runs.filter(run => {
                const label = `${run.month}/${run.year} ${run.status} ${run.notes || ""}`.toLowerCase();
                return label.includes(normalizedSearch);
            })
            : runs;

        res.status(200).json({
            success: true,
            data: filteredRuns
        });
    } catch (error) {
        console.error("[Salary] List Payroll Runs Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Finalize a payroll run so it becomes the month snapshot
// @route   PATCH /api/salary/runs/:runId/finalize
exports.finalizePayrollRun = async (req, res) => {
    try {
        const { runId } = req.params;

        const payrollRun = await PayrollRun.findById(runId);
        if (!payrollRun) {
            return res.status(404).json({ success: false, message: "Payroll run not found" });
        }

        if (payrollRun.status === "Cancelled") {
            return res.status(400).json({ success: false, message: "Cancelled payroll cannot be finalized" });
        }

        const lines = await PayrollLine.find({ payrollRun: payrollRun._id });
        if (lines.length === 0) {
            return res.status(400).json({ success: false, message: "Generate payroll lines before finalizing" });
        }

        payrollRun.totals = calculatePayrollRunTotals(lines);
        payrollRun.status = lines.every(line => line.status === "Paid") ? "Paid" : "Finalized";
        payrollRun.finalizedBy = req.user._id;
        payrollRun.finalizedAt = new Date();
        await payrollRun.save();

        res.status(200).json({
            success: true,
            message: "Payroll run finalized successfully",
            data: payrollRun
        });
    } catch (error) {
        console.error("[Salary] Finalize Payroll Run Error:", error);
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
            salaryYear,
            payrollLineId
        } = req.body;

        if (!userId || !amount || !company || !paymentSource) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        // Check balance limit
        const collections = await PaymentCollection.find({ company });
        let balance = 0;
        collections.forEach(col => {
            const amt = col.amountCollected;
            const matchesAccount = (
                (paymentSource === "Personal Bank" && (col.destinationAccount === "Personal Bank" || col.destinationAccount === "Personal")) ||
                (paymentSource === "Company Bank" && (col.destinationAccount === "Company Bank" || col.destinationAccount === "Company")) ||
                (paymentSource === "Cash" && col.destinationAccount === "Cash")
            );
            if (matchesAccount) {
                if (col.transactionType === "Income") {
                    balance += amt;
                } else {
                    balance -= amt;
                }
            }
        });

        if (Number(amount) > balance) {
            return res.status(400).json({
                success: false,
                message: `Insufficient funds in ${paymentSource}. Available balance is ₹${balance.toLocaleString()}. Negative values not allowed.`
            });
        }

        const resolvedSalaryMonth = salaryMonth || new Date(date || new Date()).getMonth() + 1;
        const resolvedSalaryYear = salaryYear || new Date(date || new Date()).getFullYear();
        let payrollLine = null;

        if (payrollLineId && mongoose.Types.ObjectId.isValid(payrollLineId)) {
            payrollLine = await PayrollLine.findById(payrollLineId);
        }

        if (!payrollLine && userId && resolvedSalaryMonth && resolvedSalaryYear) {
            const payrollRun = await PayrollRun.findOne({
                month: resolvedSalaryMonth,
                year: resolvedSalaryYear
            });

            if (payrollRun) {
                payrollLine = await PayrollLine.findOne({
                    payrollRun: payrollRun._id,
                    user: userId
                });
            }
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
            salaryMonth: resolvedSalaryMonth,
            salaryYear: resolvedSalaryYear,
            salaryUser: userId,
            payrollRun: payrollLine?.payrollRun,
            payrollLine: payrollLine?._id,
            notes: notes || `Salary Payment for ${format(new Date(date || new Date()), "MMMM yyyy")}`
        });

        if (payrollLine) {
            const nextPaid = (payrollLine.amounts?.paid || 0) + Number(amount);
            const earned = payrollLine.amounts?.earned || 0;
            payrollLine.amounts.paid = nextPaid;
            payrollLine.amounts.pending = Math.max(earned - nextPaid, 0);
            payrollLine.status = earned > 0 && nextPaid >= earned ? "Paid" : "Partially Paid";
            payrollLine.paymentCollections = Array.from(new Set([
                ...(payrollLine.paymentCollections || []).map(id => id.toString()),
                expense._id.toString()
            ]));
            await payrollLine.save();
            await syncPayrollRunTotals(payrollLine.payrollRun);
        }

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

// @desc    Get separated salary profile for a user
// @route   GET /api/salary/profile/:userId
exports.getSalaryProfile = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid user id" });
        }

        const user = await User.findById(userId).select("-password");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const salaryData = await getSalaryProfileForUser(user);
        const rawProfile = await SalaryProfile.findOne({ user: userId }).lean();

        res.status(200).json({
            success: true,
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                profile: rawProfile,
                resolved: salaryData
            }
        });
    } catch (error) {
        console.error("[Salary] Get Profile Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create or update separated salary profile for a user
// @route   PUT /api/salary/profile/:userId
exports.upsertSalaryProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const {
            salary,
            bankInfo,
            paymentPreferences,
            effectiveFrom,
            effectiveTo,
            isActive
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid user id" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const update = {
            user: userId
        };

        if (salary) {
            update.salary = {
                amount: Number(salary.amount || 0),
                type: salary.type || "Monthly",
                currency: salary.currency || "INR"
            };
        }

        if (bankInfo) update.bankInfo = bankInfo;
        if (paymentPreferences) update.paymentPreferences = paymentPreferences;
        if (effectiveFrom) update.effectiveFrom = new Date(effectiveFrom);
        if (effectiveTo !== undefined) update.effectiveTo = effectiveTo ? new Date(effectiveTo) : null;
        if (isActive !== undefined) update.isActive = Boolean(isActive);

        const profile = await SalaryProfile.findOneAndUpdate(
            { user: userId },
            { $set: update },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({
            success: true,
            message: "Salary profile saved successfully",
            data: profile
        });
    } catch (error) {
        console.error("[Salary] Upsert Profile Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getTeamSalaryOverview = async (req, res) => {
    return exports.getPayrollList(req, res);
};
