const mongoose = require("mongoose");

const CalendarExceptionSchema = new mongoose.Schema(
    {
        date: {
            type: Date,
            required: [true, "Please add a date"],
            unique: true
        },
        type: {
            type: String,
            enum: ["Working Sunday", "Holiday"],
            required: [true, "Please specify exception type"]
        },
        description: {
            type: String,
            trim: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("CalendarException", CalendarExceptionSchema);
