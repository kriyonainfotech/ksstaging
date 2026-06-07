const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const {
    markManual,
    getAttendanceStatus,
    getAllAttendance,
    generateQRLink,
    verifyQR,
    getCalendarExceptions,
    addCalendarException,
    deleteCalendarException,
    getMissingDates,
    clockIn,
    clockOut,
    updateAttendance,
    deleteAttendance
} = require('../controllers/attendanceController');

// All routes are protected
router.use(protect);

// Admin/Superadmin only routes
router.post('/mark-manual', authorize('Superadmin', 'Admin'), markManual);
router.put('/:id', authorize('Superadmin', 'Admin'), updateAttendance);
router.delete('/:id', authorize('Superadmin', 'Admin'), deleteAttendance);
router.get('/all', authorize('Superadmin', 'Admin'), getAllAttendance);
router.get('/missing-dates', authorize('Superadmin', 'Admin'), getMissingDates);

// Calendar Exception routes
router.get('/calendar-exceptions', authorize('Superadmin', 'Admin'), getCalendarExceptions);
router.post('/calendar-exceptions', authorize('Superadmin', 'Admin'), addCalendarException);
router.delete('/calendar-exceptions/:id', authorize('Superadmin', 'Admin'), deleteCalendarException);

// Team member routes
router.get('/status', getAttendanceStatus);
router.get('/qr-link', generateQRLink);
router.get('/verify-qr/:token', verifyQR);
router.post('/clock-in', clockIn);
router.post('/clock-out', clockOut);

module.exports = router;
