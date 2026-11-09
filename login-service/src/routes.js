const express = require('express');
const { requireUser } = require('./lib/middleware');
const auth = require('./controllers/authController');

const router = express.Router();

router.post('/auth/login', auth.login);
router.get('/auth/me', requireUser, auth.me);
router.patch('/auth/password', requireUser, auth.changePassword);

module.exports = router;
