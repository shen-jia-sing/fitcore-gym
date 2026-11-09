const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { HttpError } = require('../lib/errors');
const { readBody, toObjectId, paginate } = require('../lib/validate');

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

const ADMIN_UPDATABLE = ['name', 'phone', 'role', 'status'];
const SELF_UPDATABLE = ['name', 'phone'];

function assertPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
}

async function createUser({ name, email, password, role, phone }) {
  assertPassword(password);

  if (typeof email === 'string' && (await User.exists({ email: email.trim().toLowerCase() }))) {
    throw new HttpError(409, 'Email is already registered');
  }

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return User.create({ name, email, password: hashed, role, phone });
}

// POST /auth/register (public): self sign-up always creates a member.
async function register(req, res) {
  const body = readBody(req, ['name', 'email', 'password', 'phone']);
  const user = await createUser({ ...body, role: 'member' });

  res.status(201).json({ message: 'Registration successful. You can now log in.', data: user });
}

// POST /users (admin): create a trainer, member, or another admin.
async function createStaffUser(req, res) {
  const body = readBody(req, ['name', 'email', 'password', 'role', 'phone']);
  const user = await createUser(body);

  res.status(201).json({ message: `User created with role '${user.role}'`, data: user });
}

// GET /users (admin): filter by role and status.
async function listUsers(req, res) {
  const filter = {};

  if (req.query.role) filter.role = req.query.role;
  if (req.query.status) filter.status = req.query.status;

  res.json(await paginate(User, filter, req.query, { createdAt: -1 }));
}

function assertSelfOrAdmin(req, userId) {
  if (req.user.role !== 'admin' && req.user.id !== userId) {
    throw new HttpError(403, 'You can only access your own account');
  }
}

// GET /users/:id (admin, or the user themself)
async function getUser(req, res) {
  toObjectId(req.params.id, 'id');
  assertSelfOrAdmin(req, req.params.id);

  const user = await User.findById(req.params.id);

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  res.json({ data: user });
}

// PATCH /users/:id (admin: name, phone, role, status; user themself: name, phone)
async function updateUser(req, res) {
  toObjectId(req.params.id, 'id');
  assertSelfOrAdmin(req, req.params.id);

  const isAdmin = req.user.role === 'admin';
  const updates = readBody(req, isAdmin ? ADMIN_UPDATABLE : SELF_UPDATABLE, { requireAny: true });
  const isOwnAccount = req.user.id === req.params.id;

  if (isAdmin && isOwnAccount && (updates.role || updates.status)) {
    throw new HttpError(409, 'Admins cannot change their own role or status');
  }

  const user = await User.findByIdAndUpdate(req.params.id, { $set: updates }, {
    returnDocument: 'after',
    runValidators: true
  });

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  res.json({ message: 'User updated', data: user });
}

// DELETE /users/:id (admin)
async function deleteUser(req, res) {
  toObjectId(req.params.id, 'id');

  if (req.user.id === req.params.id) {
    throw new HttpError(409, 'Admins cannot delete their own account');
  }

  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    throw new HttpError(404, 'User not found');
  }

  res.json({ message: 'User deleted', data: { id: user.id, email: user.email } });
}

// Creates the first admin from environment variables so the system can be managed after deploy.
async function ensureSeedAdmin({ name, email, password }) {
  if (await User.exists({ email: email.toLowerCase() })) {
    console.log(`Seed admin ${email} already exists`);
    return;
  }

  await createUser({ name, email, password, role: 'admin' });
  console.log(`Seed admin ${email} created`);
}

module.exports = {
  register,
  createStaffUser,
  listUsers,
  getUser,
  updateUser,
  deleteUser,
  ensureSeedAdmin
};
