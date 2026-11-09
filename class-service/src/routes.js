const express = require('express');
const { requireUser } = require('./lib/middleware');
const classes = require('./controllers/classController');

const router = express.Router();

// Role checks happen at the API gateway; ownership checks happen in the controllers.
router.use('/classes', requireUser);

router.post('/classes', classes.createClass);
router.get('/classes', classes.listClasses);
router.get('/classes/:id', classes.getClass);
router.patch('/classes/:id', classes.updateClass);
router.delete('/classes/:id', classes.deleteClass);

// Internal service-to-service API
router.post('/internal/classes/:id/reserve', classes.internalReserveSeat);
router.post('/internal/classes/:id/release', classes.internalReleaseSeat);

module.exports = router;
