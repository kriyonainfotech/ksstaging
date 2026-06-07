const express = require('express');
const router = express.Router();
const { getFinancialStats, getTaskStats, getUserStats } = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/stats/financials', getFinancialStats);
router.get('/stats/tasks', getTaskStats);
router.get('/stats/users', getUserStats);

module.exports = router;
