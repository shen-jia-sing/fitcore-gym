const Plan = require('../models/Plan');
const Membership = require('../models/Membership');
const { HttpError } = require('../lib/errors');
const { readBody, toObjectId, paginate } = require('../lib/validate');

const DAY_MS = 24 * 60 * 60 * 1000;

// A member can hold one membership that is awaiting payment or still running.
function currentMembershipFilter(userId) {
  return {
    userId,
    $or: [{ status: 'pending' }, { status: 'active', endDate: { $gt: new Date() } }]
  };
}

async function findMembership(id) {
  toObjectId(id, 'id');
  const membership = await Membership.findById(id);

  if (!membership) {
    throw new HttpError(404, 'Membership not found');
  }

  return membership;
}

function assertOwnerOrAdmin(req, membership) {
  if (req.user.role !== 'admin' && membership.userId.toString() !== req.user.id) {
    throw new HttpError(403, 'You can only access your own memberships');
  }
}

// POST /memberships (member: for themself; admin: for any userId). Starts as 'pending' until paid.
async function createMembership(req, res) {
  const isAdmin = req.user.role === 'admin';
  const body = readBody(req, isAdmin ? ['planId', 'userId'] : ['planId']);
  const userId = toObjectId(isAdmin ? body.userId : req.user.id, 'userId');
  const planId = toObjectId(body.planId, 'planId');

  const plan = await Plan.findById(planId);

  if (!plan) {
    throw new HttpError(404, 'Plan not found');
  }

  if (!plan.isActive) {
    throw new HttpError(409, 'This plan is no longer offered');
  }

  if (await Membership.exists(currentMembershipFilter(userId))) {
    throw new HttpError(409, 'User already has a pending or active membership');
  }

  const membership = await Membership.create({
    userId,
    planId,
    planName: plan.name,
    price: plan.price,
    durationDays: plan.durationDays
  });

  res.status(201).json({
    message: 'Membership created. Complete payment to activate it.',
    data: membership
  });
}

// GET /memberships (admin: all, ?userId= ?status=; member: own)
async function listMemberships(req, res) {
  const filter = {};

  if (req.user.role === 'admin') {
    if (req.query.userId) filter.userId = toObjectId(req.query.userId, 'userId');
  } else {
    filter.userId = toObjectId(req.user.id, 'userId');
  }

  if (req.query.status) filter.status = req.query.status;

  res.json(await paginate(Membership, filter, req.query, { createdAt: -1 }));
}

// GET /memberships/:id (admin or owner)
async function getMembership(req, res) {
  const membership = await findMembership(req.params.id);
  assertOwnerOrAdmin(req, membership);
  res.json({ data: membership });
}

// PATCH /memberships/:id (admin): change status or dates.
async function updateMembership(req, res) {
  toObjectId(req.params.id, 'id');
  const updates = readBody(req, ['status', 'startDate', 'endDate'], { requireAny: true });

  const membership = await Membership.findByIdAndUpdate(req.params.id, { $set: updates }, {
    returnDocument: 'after',
    runValidators: true
  });

  if (!membership) {
    throw new HttpError(404, 'Membership not found');
  }

  res.json({ message: 'Membership updated', data: membership });
}

// DELETE /memberships/:id (admin)
async function deleteMembership(req, res) {
  toObjectId(req.params.id, 'id');
  const membership = await Membership.findByIdAndDelete(req.params.id);

  if (!membership) {
    throw new HttpError(404, 'Membership not found');
  }

  res.json({ message: 'Membership deleted', data: { id: membership.id } });
}

// --- Internal API (called by payment-service and attendance-service, never exposed by the gateway) ---

// GET /internal/memberships/:id
async function internalGetMembership(req, res) {
  res.json({ data: await findMembership(req.params.id) });
}

// POST /internal/memberships/:id/activate: pending -> active, called after a successful payment.
async function internalActivateMembership(req, res) {
  const existing = await findMembership(req.params.id);
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + existing.durationDays * DAY_MS);

  const membership = await Membership.findOneAndUpdate(
    { _id: existing._id, status: 'pending' },
    { $set: { status: 'active', startDate, endDate } },
    { returnDocument: 'after' }
  );

  if (!membership) {
    throw new HttpError(409, 'Membership is not awaiting payment');
  }

  res.json({ data: membership });
}

// GET /internal/members/:userId/active-membership
async function internalGetActiveMembership(req, res) {
  const userId = toObjectId(req.params.userId, 'userId');
  const membership = await Membership.findOne({
    userId,
    status: 'active',
    endDate: { $gt: new Date() }
  });

  if (!membership) {
    throw new HttpError(404, 'No active membership');
  }

  res.json({ data: membership });
}

module.exports = {
  createMembership,
  listMemberships,
  getMembership,
  updateMembership,
  deleteMembership,
  internalGetMembership,
  internalActivateMembership,
  internalGetActiveMembership
};
