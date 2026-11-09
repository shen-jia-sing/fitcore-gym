const express = require('express');
const { requireUser } = require('./lib/middleware');
const payments = require('./controllers/paymentController');

const router = express.Router();

// Role checks happen at the API gateway; ownership checks happen in the controllers.
router.use('/payments', requireUser);

router.post('/payments', payments.createPayment);
router.get('/payments', payments.listPayments);
router.get('/payments/stats/revenue', payments.revenueStats);
router.get('/payments/:id', payments.getPayment);
router.patch('/payments/:id', payments.updatePayment);
router.delete('/payments/:id', payments.deletePayment);

module.exports = router;
