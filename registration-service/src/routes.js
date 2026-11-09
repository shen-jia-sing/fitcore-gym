const express = require('express');
const { requireUser } = require('./lib/middleware');
const users = require('./controllers/userController');

const router = express.Router();

// Role checks happen at the API gateway; ownership checks happen in the controllers.
router.post('/auth/register', users.register);

router.post('/users', requireUser, users.createStaffUser);
router.get('/users', requireUser, users.listUsers);
router.get('/users/:id', requireUser, users.getUser);
router.patch('/users/:id', requireUser, users.updateUser);
router.delete('/users/:id', requireUser, users.deleteUser);

module.exports = router;
