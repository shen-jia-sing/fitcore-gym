const config = require('../config');
const GymClass = require('../models/GymClass');
const { HttpError } = require('../lib/errors');
const { readBody, toObjectId, paginate } = require('../lib/validate');
const { createServiceClient } = require('../lib/serviceClient');

const trainerService = createServiceClient(
  config.trainerServiceUrl,
  config.internalApiKey,
  'trainer-service'
);

const CLASS_FIELDS = ['title', 'description', 'category', 'room', 'startTime', 'durationMinutes', 'capacity'];

async function findClass(id) {
  toObjectId(id, 'id');
  const gymClass = await GymClass.findById(id);

  if (!gymClass) {
    throw new HttpError(404, 'Class not found');
  }

  return gymClass;
}

function assertOwnerOrAdmin(req, gymClass) {
  if (req.user.role !== 'admin' && gymClass.trainerId.toString() !== req.user.id) {
    throw new HttpError(403, 'Only the class trainer or an admin can change this class');
  }
}

function assertFutureDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime()) || date <= new Date()) {
    throw new HttpError(400, 'startTime must be a valid date in the future');
  }
}

// POST /classes (trainer: teaches it themself; admin: assigns trainerId).
// The trainer must have an active profile in trainer-service.
async function createClass(req, res) {
  const isAdmin = req.user.role === 'admin';
  const body = readBody(req, isAdmin ? [...CLASS_FIELDS, 'trainerId'] : CLASS_FIELDS);
  const trainerId = toObjectId(isAdmin ? body.trainerId : req.user.id, 'trainerId');
  assertFutureDate(body.startTime);

  const trainer = await trainerService('GET', `/internal/trainers/by-user/${trainerId}`);

  const gymClass = await GymClass.create({
    ...body,
    trainerId,
    trainerName: trainer.fullName,
    availableSeats: body.capacity
  });

  res.status(201).json({ message: 'Class scheduled', data: gymClass });
}

// GET /classes (any role): ?category= ?trainerId= ?status= ?from=ISO-date
async function listClasses(req, res) {
  const filter = {};

  if (req.query.category) filter.category = req.query.category;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.trainerId) filter.trainerId = toObjectId(req.query.trainerId, 'trainerId');

  if (req.query.from) {
    const from = new Date(req.query.from);

    if (Number.isNaN(from.getTime())) {
      throw new HttpError(400, 'from must be a valid date');
    }

    filter.startTime = { $gte: from };
  }

  res.json(await paginate(GymClass, filter, req.query, { startTime: 1 }));
}

// GET /classes/:id (any role)
async function getClass(req, res) {
  res.json({ data: await findClass(req.params.id) });
}

// PATCH /classes/:id (admin, or the class trainer).
// Changing capacity keeps already-booked seats: availableSeats = newCapacity - booked.
async function updateClass(req, res) {
  const gymClass = await findClass(req.params.id);
  assertOwnerOrAdmin(req, gymClass);

  const updates = readBody(req, [...CLASS_FIELDS, 'status'], { requireAny: true });

  if (updates.startTime !== undefined) {
    assertFutureDate(updates.startTime);
  }

  const set = { ...updates };

  if (updates.capacity !== undefined) {
    const booked = gymClass.capacity - gymClass.availableSeats;

    if (!Number.isInteger(updates.capacity) || updates.capacity < booked) {
      throw new HttpError(409, `capacity must be a whole number of at least ${booked} (seats already booked)`);
    }

    set.availableSeats = updates.capacity - booked;
  }

  // Matching the seat counts we read guards against a booking landing in between.
  const updated = await GymClass.findOneAndUpdate(
    { _id: gymClass._id, capacity: gymClass.capacity, availableSeats: gymClass.availableSeats },
    { $set: set },
    { returnDocument: 'after', runValidators: true }
  );

  if (!updated) {
    throw new HttpError(409, 'Class was booked while you were editing it. Please retry.');
  }

  res.json({ message: 'Class updated', data: updated });
}

// DELETE /classes/:id (admin, or the class trainer): only when nobody is booked.
async function deleteClass(req, res) {
  const gymClass = await findClass(req.params.id);
  assertOwnerOrAdmin(req, gymClass);

  const booked = gymClass.capacity - gymClass.availableSeats;

  if (booked > 0) {
    throw new HttpError(409, `Class has ${booked} booking(s). Set status to 'cancelled' instead.`);
  }

  await gymClass.deleteOne();
  res.json({ message: 'Class deleted', data: { id: gymClass.id, title: gymClass.title } });
}

// --- Internal API (called by booking-service) ---

// POST /internal/classes/:id/reserve: takes one seat atomically.
async function internalReserveSeat(req, res) {
  const id = toObjectId(req.params.id, 'id');

  const gymClass = await GymClass.findOneAndUpdate(
    { _id: id, status: 'scheduled', startTime: { $gt: new Date() }, availableSeats: { $gt: 0 } },
    { $inc: { availableSeats: -1 } },
    { returnDocument: 'after' }
  );

  if (gymClass) {
    return res.json({ data: gymClass });
  }

  const existing = await findClass(req.params.id);

  if (existing.status !== 'scheduled' || existing.startTime <= new Date()) {
    throw new HttpError(409, 'Class is not open for booking');
  }

  throw new HttpError(409, 'Class is full');
}

// POST /internal/classes/:id/release: gives one seat back (booking cancelled or deleted).
async function internalReleaseSeat(req, res) {
  const id = toObjectId(req.params.id, 'id');

  const gymClass = await GymClass.findOneAndUpdate(
    { _id: id, $expr: { $lt: ['$availableSeats', '$capacity'] } },
    { $inc: { availableSeats: 1 } },
    { returnDocument: 'after' }
  );

  if (!gymClass) {
    await findClass(req.params.id);
    throw new HttpError(409, 'Class has no booked seats to release');
  }

  res.json({ data: gymClass });
}

module.exports = {
  createClass,
  listClasses,
  getClass,
  updateClass,
  deleteClass,
  internalReserveSeat,
  internalReleaseSeat
};
