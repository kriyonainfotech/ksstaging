const express = require('express');
const router = express.Router();

router.use('/auth', require('./authRoute'));
router.use('/users', require('./userRoutes'));
router.use("/catalog", require('./catalogRoutes'));
router.use("/subscriptions", require('./subscriptionRoutes'));
router.use('/tasks', require('./taskRoutes'));
router.use('/schedules', require('./scheduleRoutes'));
router.use('/ui-schema', require('./uiSchemaRoutes'));
router.use('/optionset', require('./optionsetRoute'));
router.use('/leads', require('./leadRoutes'));
router.use("/payments", require('./paymentRoutes'));
router.use("/dashboard", require('./dashboardRoutes'));
router.use("/companies", require('./companyRoutes'));
router.use("/notifications", require("./notificationRoute"));
router.use("/attendance", require("./attendanceRoutes"));
router.use("/salary", require("./salaryRoutes"));
router.use("/sop-groups", require("./sopGroupRoutes"));
router.use("/sop-points", require("./sopPointRoutes"));
router.use("/performance", require("./performanceRoutes"));
router.use("/app", require("./app_client_routes"));

module.exports = router;