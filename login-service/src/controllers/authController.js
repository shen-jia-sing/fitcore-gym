const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { HttpError } = require('../lib/errors');
const { readBody } = require('../lib/validate');

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

// POST /auth/login (public): verifies credentials and issues a signed JWT.
async function login(req, res) {
  const { email, password } = readBody(req, ['email', 'password']);

  if (typeof email !== 'string' || typeof password !== 'string') {
    throw new HttpError(400, 'email and password are required');
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
  const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;

  if (!passwordMatches) {
    throw new HttpError(401, 'Invalid email or password');
  }

  if (user.status !== 'active') {
    throw new HttpError(403, 'This account is inactive. Contact an admin.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = jwt.sign(
    { sub: user.id, role: user.role, name: user.name, email: user.email },
    config.jwt.secret,
    {
      algorithm: 'HS256',
      expiresIn: config.jwt.expiresIn,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience
    }
  );

  res.json({
    message: 'Login successful',
    data: { token, tokenType: 'Bearer', expiresIn: config.jwt.expiresIn, user }
  });
}

// GET /auth/me (any logged-in user): profile of the token's owner.
async function me(req, res) {
  const user = await User.findById(req.user.id);

  if (!user) {
    throw new HttpError(404, 'User no longer exists');
  }

  res.json({ data: user });
}

// PATCH /auth/password (any logged-in user): change own password.
async function changePassword(req, res) {
  const { currentPassword, newPassword } = readBody(req, ['currentPassword', 'newPassword']);

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    throw new HttpError(400, 'currentPassword and newPassword are required');
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `newPassword must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  if (newPassword === currentPassword) {
    throw new HttpError(400, 'newPassword must be different from currentPassword');
  }

  const user = await User.findById(req.user.id).select('+password');

  if (!user) {
    throw new HttpError(404, 'User no longer exists');
  }

  if (!(await bcrypt.compare(currentPassword, user.password))) {
    throw new HttpError(401, 'currentPassword is incorrect');
  }

  user.password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await user.save();

  res.json({ message: 'Password changed. Existing tokens stay valid until they expire.' });
}

module.exports = { login, me, changePassword };
