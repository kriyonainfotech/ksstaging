const Attendance = require("../models/Attendance");
const User = require("../models/user");
const CalendarException = require("../models/CalendarException");
const { startOfDay, format } = require("date-fns");


// @desc    Mark attendance manually (Admin/Superadmin only)
// @route   POST /api/attendance/mark-manual
// @access  Private (Superadmin/Admin)
exports.markManual = async (req, res) => {
    try {
        let { userId, status, date, userModel } = req.body;

        if (!userId || !status) {
            return res.status(400).json({ success: false, message: "User ID and Status are required" });
        }

        // --- Robust Model Discovery ---
        if (!userModel) {
            const user = await User.findById(userId);
            userModel = user ? user.role : 'User';
        }

        const queryDate = date ? startOfDay(new Date(date)) : startOfDay(new Date());
        const today = startOfDay(new Date());

        if (queryDate > today) {
            return res.status(400).json({ success: false, message: "Cannot mark attendance for future dates." });
        }

        // Find existing record for this user and date
        let attendance = await Attendance.findOne({
            user: userId,
            date: queryDate
        });

        if (attendance) {
            // Update existing
            attendance.status = status;
            attendance.userModel = userModel; // Ensure model is updated too
            // If it was previously on leave and now marked present, we might want to set a scanTime/startTime
            if (status !== 'Leave' && !attendance.startTime) {
                attendance.startTime = "09:00"; // Default start time for manual entries
            }
            await attendance.save();
        } else {
            // Create new
            attendance = await Attendance.create({
                user: userId,
                userModel: userModel, // Use the discovered/passed model
                date: queryDate,
                status: status,
                startTime: status !== 'Leave' ? "09:00" : undefined,
                scanTime: status !== 'Leave' ? new Date() : undefined
            });
        }


        res.status(200).json({
            success: true,
            data: attendance,
            message: `Attendance marked as ${status} successfully!`
        });

    } catch (error) {
        console.error("Mark Manual Attendance Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update attendance manually (Admin/Superadmin only)
// @route   PUT /api/attendance/:id
// @access  Private (Superadmin/Admin)
exports.updateAttendance = async (req, res) => {
    try {
        const { status, startTime, endTime } = req.body;

        let attendance = await Attendance.findById(req.params.id);

        if (!attendance) {
            return res.status(404).json({ success: false, message: "Attendance record not found." });
        }

        if (status) attendance.status = status;
        if (startTime !== undefined) attendance.startTime = startTime;
        if (endTime !== undefined) attendance.endTime = endTime;

        // If times are cleared and we need to recalculate totalHours
        if (attendance.startTime && attendance.endTime) {
            const [startHours, startMins] = attendance.startTime.split(':').map(Number);
            const [endHours, endMins] = attendance.endTime.split(':').map(Number);

            const startTotalMins = startHours * 60 + startMins;
            const endTotalMins = endHours * 60 + endMins;

            const workedMins = endTotalMins - startTotalMins;
            attendance.totalHours = Number((workedMins / 60).toFixed(2));
        } else {
            attendance.totalHours = 0;
        }

        await attendance.save();

        res.status(200).json({
            success: true,
            data: attendance,
            message: "Attendance updated successfully!"
        });

    } catch (error) {
        console.error("Update Attendance Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete attendance manually (Admin/Superadmin only)
// @route   DELETE /api/attendance/:id
// @access  Private (Superadmin/Admin)
exports.deleteAttendance = async (req, res) => {
    try {
        const attendance = await Attendance.findByIdAndDelete(req.params.id);

        if (!attendance) {
            return res.status(404).json({ success: false, message: "Attendance record not found." });
        }

        res.status(200).json({
            success: true,
            message: "Attendance cleared successfully!"
        });

    } catch (error) {
        console.error("Delete Attendance Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all attendance records (Admin)
// @route   GET /api/attendance/all
// @access  Private (Admin/Superadmin)
exports.getAllAttendance = async (req, res) => {
    try {
        const { date } = req.query;
        let query = {};

        // --- Role Based Filtering ---
        if (req.user.role === "Admin") {
            // Find all users managed by this admin
            const managedUsers = await User.find({ managedBy: req.user._id }, "_id");
            const managedUserIds = managedUsers.map(u => u._id);

            // Include both managed users and the admin themselves
            query.user = { $in: [...managedUserIds, req.user._id] };
        }

        if (date) {
            const queryDate = startOfDay(new Date(date));
            query.date = queryDate;
        }

        const attendance = await Attendance.find(query)
            .populate("user", "name email role")
            .sort({ date: -1, scanTime: -1 });

        res.status(200).json({
            success: true,
            count: attendance.length,
            data: attendance
        });

    } catch (error) {
        console.error("Get All Attendance Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get attendance status for current user (Team Dashboard)
// @route   GET /api/attendance/status
// @access  Private
exports.getAttendanceStatus = async (req, res) => {
    try {
        const userId = req.user._id;
        const today = startOfDay(new Date());

        const attendance = await Attendance.findOne({
            user: userId,
            date: today
        });

        if (attendance) {
            return res.status(200).json({
                success: true,
                checkedIn: true,
                data: attendance
            });
        } else {
            return res.status(200).json({
                success: true,
                checkedIn: false
            });
        }

    } catch (error) {
        console.error("Get Attendance Status Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
// @desc    Generate QR Link for attendance
// @route   GET /api/attendance/qr-link
// @access  Private
exports.generateQRLink = async (req, res) => {
    try {
        const userId = req.user._id;
        const today = startOfDay(new Date());

        // Check if already checked in
        const existing = await Attendance.findOne({ user: userId, date: today });
        if (existing) {
            return res.status(200).json({
                success: true,
                alreadyCheckedIn: true,
                message: "Already checked in today"
            });
        }

        // Generate a simple token (in production use something more secure like JWT or crypto)
        const token = Buffer.from(`${userId}-${today.getTime()}`).toString('base64');
        const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
        const url = `${baseUrl}/team/attendance/scan?token=${token}`;

        res.status(200).json({
            success: true,
            url,
            token
        });
    } catch (error) {
        console.error("Generate QR Link Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Mark attendance via Clock IN
// @route   POST /api/attendance/clock-in
// @access  Private (Team member)
exports.clockIn = async (req, res) => {
    try {
        const userId = req.user._id;
        const today = startOfDay(new Date());

        let attendance = await Attendance.findOne({ user: userId, date: today });

        if (attendance && attendance.startTime) {
            return res.status(400).json({
                success: false,
                message: "You have already clocked in for today."
            });
        }

        const now = new Date();
        const startTime = format(now, "HH:mm");

        if (attendance) {
            attendance.startTime = startTime;
            attendance.scanTime = now;
            attendance.status = "Full Day"; // Default to Full Day when clocking in
            await attendance.save();
        } else {
            attendance = await Attendance.create({
                user: userId,
                userModel: req.user.role || 'Team',
                date: today,
                startTime,
                scanTime: now,
                status: "Full Day"
            });
        }


        res.status(200).json({
            success: true,
            message: "Clocked in successfully!",
            data: attendance
        });
    } catch (error) {
        console.error("Clock In Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Mark attendance via Clock OUT
// @route   POST /api/attendance/clock-out
// @access  Private (Team member)
exports.clockOut = async (req, res) => {
    try {
        const userId = req.user._id;
        const today = startOfDay(new Date());

        const attendance = await Attendance.findOne({ user: userId, date: today });

        if (!attendance || !attendance.startTime) {
            return res.status(400).json({
                success: false,
                message: "You must clock in before clocking out."
            });
        }

        if (attendance.endTime) {
            return res.status(400).json({
                success: false,
                message: "You have already clocked out for today."
            });
        }

        const now = new Date();
        const endTime = format(now, "HH:mm");
        attendance.endTime = endTime;

        // Calculate total hours
        const [startHours, startMins] = attendance.startTime.split(':').map(Number);
        const [endHours, endMins] = endTime.split(':').map(Number);

        const startTotalMins = startHours * 60 + startMins;
        const endTotalMins = endHours * 60 + endMins;

        const workedMins = endTotalMins - startTotalMins;
        const totalHours = Number((workedMins / 60).toFixed(2));

        attendance.totalHours = totalHours;

        // Update status based on hours if needed (e.g., < 4 hours = Half Day)
        if (totalHours < 4) {
            attendance.status = "Half Day";
        }

        await attendance.save();

        res.status(200).json({
            success: true,
            message: "Clocked out successfully!",
            data: attendance
        });
    } catch (error) {
        console.error("Clock Out Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Verify QR and mark attendance
// @route   GET /api/attendance/verify-qr/:token
// @access  Private
exports.verifyQR = async (req, res) => {
    try {
        const { token } = req.params;
        const userId = req.user._id;

        // Decode token and verify (simple verification for now)
        const decoded = Buffer.from(token, 'base64').toString('ascii');
        const [tokenUserId, timestamp] = decoded.split('-');

        if (tokenUserId !== userId.toString()) {
            return res.status(401).json({ success: false, message: "Invalid or unauthorized token" });
        }

        // Check if token is expired (e.g., older than 5 minutes)
        const tokenTime = parseInt(timestamp);
        if (Date.now() - tokenTime > 5 * 60 * 1000) {
            return res.status(400).json({ success: false, message: "QR Code expired" });
        }

        const today = startOfDay(new Date());
        let attendance = await Attendance.findOne({ user: userId, date: today });

        if (attendance && attendance.startTime) {
            return res.status(200).json({ success: true, message: "Already checked in", data: attendance });
        }

        const now = new Date();
        const startTime = format(now, "HH:mm");

        if (attendance) {
            attendance.startTime = startTime;
            attendance.scanTime = now;
            attendance.status = "Full Day";
            await attendance.save();
        } else {
            attendance = await Attendance.create({
                user: userId,
                userModel: req.user.role || 'Team',
                date: today,
                status: 'Full Day',
                startTime: startTime,
                scanTime: now
            });
        }


        res.status(200).json({
            success: true,
            message: "Attendance marked successfully!",
            data: attendance
        });
    } catch (error) {
        console.error("Verify QR Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all calendar exceptions
// @route   GET /api/attendance/calendar-exceptions
// @access  Private (Admin/Superadmin)
exports.getCalendarExceptions = async (req, res) => {
    try {
        const exceptions = await CalendarException.find().sort({ date: 1 });
        res.status(200).json({ success: true, data: exceptions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Add a calendar exception
// @route   POST /api/attendance/calendar-exceptions
// @access  Private (Admin/Superadmin)
exports.addCalendarException = async (req, res) => {
    try {
        const { date, type, description } = req.body;
        const queryDate = startOfDay(new Date(date));

        const existing = await CalendarException.findOne({ date: queryDate });
        if (existing) {
            return res.status(400).json({ success: false, message: "Exception already exists for this date" });
        }

        const exception = await CalendarException.create({
            date: queryDate,
            type,
            description
        });

        res.status(201).json({ success: true, data: exception });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete a calendar exception
// @route   DELETE /api/attendance/calendar-exceptions/:id
// @access  Private (Admin/Superadmin)
exports.deleteCalendarException = async (req, res) => {
    try {
        const exception = await CalendarException.findByIdAndDelete(req.params.id);
        if (!exception) {
            return res.status(404).json({ success: false, message: "Exception not found" });
        }
        res.status(200).json({ success: true, message: "Exception deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get missing attendance dates for 2026 up to today
// @route   GET /api/attendance/missing-dates
// @access  Private (Admin/Superadmin)
exports.getMissingDates = async (req, res) => {
    try {
        const today = startOfDay(new Date());
        // Forcing to start from 2026-01-01 as requested
        const yearStart = new Date("2026-01-01T00:00:00.000Z");

        // Use today if today is in 2026, otherwise end at the end of 2026
        let endDate = today;
        if (today.getFullYear() > 2026) {
            endDate = new Date("2026-12-31T00:00:00.000Z");
        } else if (today.getFullYear() < 2026) {
            // It's not 2026 yet, return empty
            return res.status(200).json({ success: true, data: [] });
        }

        const attendanceRecords = await Attendance.aggregate([
            { $match: { date: { $gte: yearStart, $lte: endDate } } },
            { $group: { _id: "$date" } }
        ]);

        const datesWithAttendance = attendanceRecords.map(r => r._id.getTime());

        const exceptions = await CalendarException.find({
            date: { $gte: yearStart, $lte: endDate }
        });

        let missingDates = [];
        let currDate = new Date(yearStart);

        while (currDate <= endDate) {
            const time = startOfDay(currDate).getTime();
            const dayOfWeek = currDate.getDay();
            const exception = exceptions.find(ex => startOfDay(ex.date).getTime() === time);

            let isWorkingDay = true;
            if (dayOfWeek === 0) { // Sunday
                isWorkingDay = exception?.type === "Working Sunday";
            } else {
                isWorkingDay = exception?.type !== "Holiday";
            }

            if (isWorkingDay && !datesWithAttendance.includes(time)) {
                missingDates.push(format(currDate, "yyyy-MM-dd"));
            }

            currDate.setDate(currDate.getDate() + 1);
        }

        // Return most recent missing dates first
        missingDates.reverse();

        res.status(200).json({ success: true, data: missingDates });
    } catch (error) {
        console.error("Get Missing Dates Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
