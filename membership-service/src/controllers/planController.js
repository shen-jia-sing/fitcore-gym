const Plan = require('../models/Plan');
const Membership = require('../models/Membership');
const { HttpError } = require('../lib/errors');
const { readBody, toObjectId, paginate } = require('../lib/validate');

const PLAN_FIELDS = ['name', 'description', 'price', 'durationDays', 'features', 'isActive'];

// POST /plans (admin)
async function createPlan(req, res) {
  const plan = await Plan.create(readBody(req, PLAN_FIELDS));
  res.status(201).json({ message: 'Plan created', data: plan });
}

// GET /plans (public): ?isActive=true|false
async function listPlans(req, res) {
  const filter = {};

  if (req.query.isActive !== undefined) {
    filter.isActive = req.query.isActive === 'true';
  }

  res.json(await paginate(Plan, filter, req.query, { price: 1 }));
}

// GET /plans/:id (public)
async function getPlan(req, res) {
  toObjectId(req.params.id, 'id');
  const plan = await Plan.findById(req.params.id);

  if (!plan) {
    throw new HttpError(404, 'Plan not found');
  }

  res.json({ data: plan });
}

// PATCH /plans/:id (admin)
async function updatePlan(req, res) {
  toObjectId(req.params.id, 'id');
  const updates = readBody(req, PLAN_FIELDS, { requireAny: true });

  const plan = await Plan.findByIdAndUpdate(req.params.id, { $set: updates }, {
    returnDocument: 'after',
    runValidators: true
  });

  if (!plan) {
    throw new HttpError(404, 'Plan not found');
  }

  res.json({ message: 'Plan updated', data: plan });
}

// DELETE /plans/:id (admin): only plans nobody has subscribed to.
async function deletePlan(req, res) {
  const planId = toObjectId(req.params.id, 'id');

  if (await Membership.exists({ planId })) {
    throw new HttpError(409, 'Plan has memberships. Set isActive=false to retire it instead.');
  }

  const plan = await Plan.findByIdAndDelete(planId);

  if (!plan) {
    throw new HttpError(404, 'Plan not found');
  }

  res.json({ message: 'Plan deleted', data: { id: plan.id, name: plan.name } });
}

module.exports = { createPlan, listPlans, getPlan, updatePlan, deletePlan };
