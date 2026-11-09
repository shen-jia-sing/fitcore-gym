const crypto = require('crypto');
const config = require('../config');
const Payment = require('../models/Payment');
const { HttpError } = require('../lib/errors');
const { readBody, toObjectId, paginate } = require('../lib/validate');
const { createServiceClient } = require('../lib/serviceClient');

const membershipService = createServiceClient(
  config.membershipServiceUrl,
  config.internalApiKey,
  'membership-service'
);

function newReceiptNo() {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `RCP-${date}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function assertOwnerOrAdmin(req, payment) {
  if (req.user.role !== 'admin' && payment.userId.toString() !== req.user.id) {
    throw new HttpError(403, 'You can only access your own payments');
  }
}

// POST /payments (member: own membership; admin: any membership, e.g. cash at the front desk)
// Flow: read membership -> record pending payment -> activate membership -> mark payment completed.
async function createPayment(req, res) {
  const body = readBody(req, ['membershipId', 'method', 'note']);
  const membershipId = toObjectId(body.membershipId, 'membershipId');

  const membership = await membershipService('GET', `/internal/memberships/${membershipId}`);

  if (req.user.role !== 'admin' && membership.userId !== req.user.id) {
    throw new HttpError(403, 'You can only pay for your own membership');
  }

  if (membership.status !== 'pending') {
    throw new HttpError(409, `Membership is ${membership.status}, not awaiting payment`);
  }

  const payment = await Payment.create({
    receiptNo: newReceiptNo(),
    userId: membership.userId,
    membershipId,
    amount: membership.price,
    method: body.method,
    note: body.note
  });

  let activatedMembership;

  try {
    activatedMembership = await membershipService(
      'POST',
      `/internal/memberships/${membershipId}/activate`
    );
  } catch (err) {
    payment.status = 'failed';
    await payment.save();
    throw err;
  }

  payment.status = 'completed';
  payment.paidAt = new Date();
  await payment.save();

  res.status(201).json({
    message: 'Payment completed and membership activated',
    data: { payment, membership: activatedMembership }
  });
}

// GET /payments (admin: all, ?userId= ?status= ?method=; member: own)
async function listPayments(req, res) {
  const filter = {};

  if (req.user.role === 'admin') {
    if (req.query.userId) filter.userId = toObjectId(req.query.userId, 'userId');
  } else {
    filter.userId = toObjectId(req.user.id, 'userId');
  }

  if (req.query.status) filter.status = req.query.status;
  if (req.query.method) filter.method = req.query.method;

  res.json(await paginate(Payment, filter, req.query, { createdAt: -1 }));
}

// GET /payments/:id (admin or owner)
async function getPayment(req, res) {
  toObjectId(req.params.id, 'id');
  const payment = await Payment.findById(req.params.id);

  if (!payment) {
    throw new HttpError(404, 'Payment not found');
  }

  assertOwnerOrAdmin(req, payment);
  res.json({ data: payment });
}

// PATCH /payments/:id (admin): e.g. mark refunded, add a note.
async function updatePayment(req, res) {
  toObjectId(req.params.id, 'id');
  const updates = readBody(req, ['status', 'note'], { requireAny: true });

  const payment = await Payment.findByIdAndUpdate(req.params.id, { $set: updates }, {
    returnDocument: 'after',
    runValidators: true
  });

  if (!payment) {
    throw new HttpError(404, 'Payment not found');
  }

  res.json({ message: 'Payment updated', data: payment });
}

// DELETE /payments/:id (admin)
async function deletePayment(req, res) {
  toObjectId(req.params.id, 'id');
  const payment = await Payment.findByIdAndDelete(req.params.id);

  if (!payment) {
    throw new HttpError(404, 'Payment not found');
  }

  res.json({ message: 'Payment deleted', data: { id: payment.id, receiptNo: payment.receiptNo } });
}

// GET /payments/stats/revenue (admin): completed revenue, total and per method.
async function revenueStats(req, res) {
  const byMethod = await Payment.aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $project: { _id: 0, method: '$_id', total: 1, count: 1 } },
    { $sort: { total: -1 } }
  ]);

  const totalRevenue = byMethod.reduce((sum, row) => sum + row.total, 0);
  const totalPayments = byMethod.reduce((sum, row) => sum + row.count, 0);

  res.json({ data: { currency: 'USD', totalRevenue, totalPayments, byMethod } });
}

module.exports = {
  createPayment,
  listPayments,
  getPayment,
  updatePayment,
  deletePayment,
  revenueStats
};
