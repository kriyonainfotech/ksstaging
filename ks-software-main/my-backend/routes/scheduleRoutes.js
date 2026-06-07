const express = require("express");
const router = express.Router();
const {
    getSchedulesByClient,
    getScheduleAnalytics,
    getScheduleSummary,
    updateSchedule,
    createChutakItem,
    getChutakItemsByClient,
    deleteSchedule
} = require("../controllers/scheduleController");

// Basic CRUD and Specialized routes
router.get("/client/:id", getSchedulesByClient);
router.get("/analytics", getScheduleAnalytics);
router.get("/summary", getScheduleSummary);
router.put("/:id", updateSchedule);
router.delete("/:id", deleteSchedule);
router.post("/chutak", createChutakItem);
router.get("/chutak/client/:id", getChutakItemsByClient);

module.exports = router;
