const express = require('express');
const { requireUser } = require('./lib/middleware');
const attendance = require('./controllers/attendanceController');

const router = express.Router();

// Role checks happen at the API gateway; ownership checks happen in the controllers.
router.use('/attendance', requireUser);

router.post('/attendance/check-in', attendance.checkIn);
router.post('/attendance/check-out', attendance.checkOut);
router.get('/attendance', attendance.listVisits);
router.get('/attendance/stats', attendance.visitStats);
router.get('/attendance/:id', attendance.getVisit);
router.patch('/attendance/:id', attendance.updateVisit);
router.delete('/attendance/:id', attendance.deleteVisit);

module.exports = router;
