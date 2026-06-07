const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    // The specific day this record is for, stripped of time
    date: {
        type: Date,
        required: true,
    },
    // Stored as a string like "09:00"
    startTime: {
        type: String,
        // required: true, // Made optional for simple attendance marking
    },
    // Stored as a string like "17:30"
    endTime: {
        type: String,
        // required: true, // Made optional/updated later
    },
    // Exact time of scan
    scanTime: {
        type: Date,
    },
    // Stored as a number, e.g., 0.5 for 30 mins
    breakHours: {
        type: Number,
        default: 0,
    },
    totalHours: {
        type: Number, // This will be calculated by your API on save
        default: 0,
    },
    // Status set by the Admin
    status: {
        type: String,
        enum: ['Full Day', 'Half Day', 'Leave'],
        default: 'Leave',
    },
}, { timestamps: true });

// This ensures a team member can only have ONE entry per day.
// It's a compound index.
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);

