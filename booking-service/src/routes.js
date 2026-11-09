const express = require('express');
const { requireUser } = require('./lib/middleware');
const bookings = require('./controllers/bookingController');

const router = express.Router();

// Role checks happen at the API gateway; ownership checks happen in the controllers.
router.use('/bookings', requireUser);

router.post('/bookings', bookings.createBooking);
router.get('/bookings', bookings.listBookings);
router.get('/bookings/:id', bookings.getBooking);
router.patch('/bookings/:id', bookings.updateBooking);
router.delete('/bookings/:id', bookings.deleteBooking);

module.exports = router;
