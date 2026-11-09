const config = require('../config');
const Booking = require('../models/Booking');
const { HttpError } = require('../lib/errors');
const { readBody, toObjectId, paginate } = require('../lib/validate');
const { createServiceClient } = require('../lib/serviceClient');

const classService = createServiceClient(config.classServiceUrl, config.internalApiKey, 'class-service');

const isStaff = (user) => user.role === 'admin' || user.role === 'trainer';

async function findBooking(id) {
  toObjectId(id, 'id');
  const booking = await Booking.findById(id);

  if (!booking) {
    throw new HttpError(404, 'Booking not found');
  }

  return booking;
}

function releaseSeat(classId) {
  return classService('POST', `/internal/classes/${classId}/release`);
}

// POST /bookings (member): reserves a seat in class-service, then stores the booking.
async function createBooking(req, res) {
  const body = readBody(req, ['classId', 'notes']);
  const classId = toObjectId(body.classId, 'classId');
  const userId = toObjectId(req.user.id, 'userId');

  if (await Booking.exists({ userId, classId, status: 'confirmed' })) {
    throw new HttpError(409, 'You already booked this class');
  }

  const gymClass = await classService('POST', `/internal/classes/${classId}/reserve`);

  try {
    const booking = await Booking.create({
      userId,
      classId,
      classTitle: gymClass.title,
      classStartTime: gymClass.startTime,
      notes: body.notes
    });

    res.status(201).json({
      message: 'Class booked',
      data: { booking, seatsLeft: gymClass.availableSeats }
    });
  } catch (err) {
    await releaseSeat(classId);
    throw err.code === 11000 ? new HttpError(409, 'You already booked this class') : err;
  }
}

// GET /bookings (admin/trainer: all, ?classId= ?userId= ?status=; member: own)
async function listBookings(req, res) {
  const filter = {};

  if (isStaff(req.user)) {
    if (req.query.userId) filter.userId = toObjectId(req.query.userId, 'userId');
  } else {
    filter.userId = toObjectId(req.user.id, 'userId');
  }

  if (req.query.classId) filter.classId = toObjectId(req.query.classId, 'classId');
  if (req.query.status) filter.status = req.query.status;

  res.json(await paginate(Booking, filter, req.query, { createdAt: -1 }));
}

// GET /bookings/:id (staff, or the member who booked)
async function getBooking(req, res) {
  const booking = await findBooking(req.params.id);

  if (!isStaff(req.user) && booking.userId.toString() !== req.user.id) {
    throw new HttpError(403, 'You can only view your own bookings');
  }

  res.json({ data: booking });
}

// PATCH /bookings/:id (admin, or the member who booked): update notes or cancel.
async function updateBooking(req, res) {
  const booking = await findBooking(req.params.id);

  if (req.user.role !== 'admin' && booking.userId.toString() !== req.user.id) {
    throw new HttpError(403, 'You can only change your own bookings');
  }

  const updates = readBody(req, ['status', 'notes'], { requireAny: true });

  if (updates.status !== undefined) {
    if (updates.status !== 'cancelled') {
      throw new HttpError(400, "status can only be changed to 'cancelled'");
    }

    if (booking.status === 'cancelled') {
      throw new HttpError(409, 'Booking is already cancelled');
    }

    await releaseSeat(booking.classId);
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
  }

  if (updates.notes !== undefined) {
    booking.notes = updates.notes;
  }

  await booking.save();
  res.json({ message: 'Booking updated', data: booking });
}

// DELETE /bookings/:id (admin): frees the seat if the booking was still confirmed.
async function deleteBooking(req, res) {
  const booking = await findBooking(req.params.id);

  if (booking.status === 'confirmed') {
    await releaseSeat(booking.classId);
  }

  await booking.deleteOne();
  res.json({ message: 'Booking deleted', data: { id: booking.id } });
}

module.exports = { createBooking, listBookings, getBooking, updateBooking, deleteBooking };
