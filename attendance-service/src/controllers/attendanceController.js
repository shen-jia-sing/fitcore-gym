const config = require('../config');
const CheckIn = require('../models/CheckIn');
const { HttpError } = require('../lib/errors');
const { readBody, toObjectId, paginate } = require('../lib/validate');
const { createServiceClient } = require('../lib/serviceClient');

const membershipService = createServiceClient(
  config.membershipServiceUrl,
  config.internalApiKey,
  'membership-service'
);

const isStaff = (user) => user.role === 'admin' || user.role === 'trainer';
const minutesBetween = (start, end) => Math.round((end - start) / 60000);

// Members act for themselves; an admin at the front desk passes userId in the body.
function targetUserId(req, body) {
  return toObjectId(req.user.role === 'admin' ? body.userId : req.user.id, 'userId');
}

function parseDate(value, label) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${label} must be a valid date`);
  }

  return date;
}

async function findVisit(id) {
  toObjectId(id, 'id');
  const visit = await CheckIn.findById(id);

  if (!visit) {
    throw new HttpError(404, 'Check-in not found');
  }

  return visit;
}

// POST /attendance/check-in (member, or admin with userId): requires an active membership.
async function checkIn(req, res) {
  const body = readBody(req, req.user.role === 'admin' ? ['userId', 'notes'] : ['notes']);
  const userId = targetUserId(req, body);

  if (await CheckIn.exists({ userId, status: 'checked_in' })) {
    throw new HttpError(409, 'Already checked in. Check out first.');
  }

  let membership;

  try {
    membership = await membershipService('GET', `/internal/members/${userId}/active-membership`);
  } catch (err) {
    if (err.status === 404) {
      throw new HttpError(403, 'No active membership. Buy or renew a membership to enter the gym.');
    }
    throw err;
  }

  try {
    const visit = await CheckIn.create({
      userId,
      membershipId: membership._id,
      checkInAt: new Date(),
      notes: body.notes
    });

    res.status(201).json({
      message: `Welcome! ${membership.planName} membership valid until ${membership.endDate}`,
      data: visit
    });
  } catch (err) {
    throw err.code === 11000 ? new HttpError(409, 'Already checked in. Check out first.') : err;
  }
}

// POST /attendance/check-out (member, or admin with userId): closes the open visit.
async function checkOut(req, res) {
  const body = readBody(req, req.user.role === 'admin' ? ['userId', 'notes'] : ['notes']);
  const userId = targetUserId(req, body);
  const visit = await CheckIn.findOne({ userId, status: 'checked_in' });

  if (!visit) {
    throw new HttpError(404, 'No open check-in found');
  }

  visit.checkOutAt = new Date();
  visit.durationMinutes = minutesBetween(visit.checkInAt, visit.checkOutAt);
  visit.status = 'checked_out';

  if (body.notes !== undefined) {
    visit.notes = body.notes;
  }

  await visit.save();
  res.json({ message: `Checked out after ${visit.durationMinutes} minute(s)`, data: visit });
}

// GET /attendance (admin/trainer: all, ?userId= ?status= ?from= ?to=; member: own)
async function listVisits(req, res) {
  const filter = {};

  if (isStaff(req.user)) {
    if (req.query.userId) filter.userId = toObjectId(req.query.userId, 'userId');
  } else {
    filter.userId = toObjectId(req.user.id, 'userId');
  }

  if (req.query.status) filter.status = req.query.status;

  if (req.query.from || req.query.to) {
    filter.checkInAt = {};
    if (req.query.from) filter.checkInAt.$gte = parseDate(req.query.from, 'from');
    if (req.query.to) filter.checkInAt.$lte = parseDate(req.query.to, 'to');
  }

  res.json(await paginate(CheckIn, filter, req.query, { checkInAt: -1 }));
}

// GET /attendance/stats (member: own; admin/trainer: everyone or ?userId=)
async function visitStats(req, res) {
  const match = {};

  if (isStaff(req.user)) {
    if (req.query.userId) match.userId = toObjectId(req.query.userId, 'userId');
  } else {
    match.userId = toObjectId(req.user.id, 'userId');
  }

  const [stats] = await CheckIn.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalVisits: { $sum: 1 },
        completedVisits: { $sum: { $cond: [{ $eq: ['$status', 'checked_out'] }, 1, 0] } },
        totalMinutes: { $sum: { $ifNull: ['$durationMinutes', 0] } },
        averageMinutes: { $avg: '$durationMinutes' },
        lastCheckInAt: { $max: '$checkInAt' }
      }
    },
    { $project: { _id: 0 } }
  ]);

  res.json({
    data: stats ?? {
      totalVisits: 0,
      completedVisits: 0,
      totalMinutes: 0,
      averageMinutes: null,
      lastCheckInAt: null
    }
  });
}

// GET /attendance/:id (staff, or the member)
async function getVisit(req, res) {
  const visit = await findVisit(req.params.id);

  if (!isStaff(req.user) && visit.userId.toString() !== req.user.id) {
    throw new HttpError(403, 'You can only view your own visits');
  }

  res.json({ data: visit });
}

// PATCH /attendance/:id (admin): correct times or notes. Duration is recalculated.
async function updateVisit(req, res) {
  const visit = await findVisit(req.params.id);
  const updates = readBody(req, ['checkInAt', 'checkOutAt', 'notes'], { requireAny: true });

  if (updates.checkInAt !== undefined) visit.checkInAt = parseDate(updates.checkInAt, 'checkInAt');
  if (updates.checkOutAt !== undefined) visit.checkOutAt = parseDate(updates.checkOutAt, 'checkOutAt');
  if (updates.notes !== undefined) visit.notes = updates.notes;

  if (visit.checkOutAt) {
    if (visit.checkOutAt <= visit.checkInAt) {
      throw new HttpError(400, 'checkOutAt must be after checkInAt');
    }

    visit.status = 'checked_out';
    visit.durationMinutes = minutesBetween(visit.checkInAt, visit.checkOutAt);
  }

  await visit.save();
  res.json({ message: 'Visit updated', data: visit });
}

// DELETE /attendance/:id (admin)
async function deleteVisit(req, res) {
  const visit = await findVisit(req.params.id);
  await visit.deleteOne();
  res.json({ message: 'Visit deleted', data: { id: visit.id } });
}

module.exports = {
  checkIn,
  checkOut,
  listVisits,
  visitStats,
  getVisit,
  updateVisit,
  deleteVisit
};
