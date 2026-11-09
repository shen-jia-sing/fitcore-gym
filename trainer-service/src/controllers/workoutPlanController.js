const WorkoutPlan = require('../models/WorkoutPlan');
const { HttpError } = require('../lib/errors');
const { readBody, toObjectId, paginate } = require('../lib/validate');

const PLAN_FIELDS = ['title', 'goal', 'level', 'durationWeeks', 'exercises', 'notes'];

// Admin sees every plan, a trainer sees plans they wrote, a member sees plans assigned to them.
function canRead(user, plan) {
  if (user.role === 'admin') return true;
  if (user.role === 'trainer') return plan.trainerId.toString() === user.id;
  return plan.memberId.toString() === user.id;
}

function canModify(user, plan) {
  return user.role === 'admin' || plan.trainerId.toString() === user.id;
}

async function findPlan(id) {
  toObjectId(id, 'id');
  const plan = await WorkoutPlan.findById(id);

  if (!plan) {
    throw new HttpError(404, 'Workout plan not found');
  }

  return plan;
}

// POST /workout-plans (trainer): write a plan for a member.
async function createWorkoutPlan(req, res) {
  const body = readBody(req, [...PLAN_FIELDS, 'memberId']);

  const plan = await WorkoutPlan.create({
    ...body,
    memberId: toObjectId(body.memberId, 'memberId'),
    trainerId: req.user.id
  });

  res.status(201).json({ message: 'Workout plan created', data: plan });
}

// GET /workout-plans (scoped by role): ?memberId= ?status=
async function listWorkoutPlans(req, res) {
  const filter = {};

  if (req.user.role === 'member') {
    filter.memberId = toObjectId(req.user.id, 'memberId');
  } else {
    if (req.user.role === 'trainer') filter.trainerId = toObjectId(req.user.id, 'trainerId');
    if (req.query.memberId) filter.memberId = toObjectId(req.query.memberId, 'memberId');
  }

  if (req.query.status) filter.status = req.query.status;

  res.json(await paginate(WorkoutPlan, filter, req.query, { createdAt: -1 }));
}

// GET /workout-plans/:id
async function getWorkoutPlan(req, res) {
  const plan = await findPlan(req.params.id);

  if (!canRead(req.user, plan)) {
    throw new HttpError(403, 'You do not have access to this workout plan');
  }

  res.json({ data: plan });
}

// PATCH /workout-plans/:id (admin, or the trainer who wrote it)
async function updateWorkoutPlan(req, res) {
  const plan = await findPlan(req.params.id);

  if (!canModify(req.user, plan)) {
    throw new HttpError(403, 'Only the trainer who wrote this plan can change it');
  }

  plan.set(readBody(req, [...PLAN_FIELDS, 'status'], { requireAny: true }));
  await plan.save();

  res.json({ message: 'Workout plan updated', data: plan });
}

// DELETE /workout-plans/:id (admin, or the trainer who wrote it)
async function deleteWorkoutPlan(req, res) {
  const plan = await findPlan(req.params.id);

  if (!canModify(req.user, plan)) {
    throw new HttpError(403, 'Only the trainer who wrote this plan can delete it');
  }

  await plan.deleteOne();
  res.json({ message: 'Workout plan deleted', data: { id: plan.id, title: plan.title } });
}

module.exports = {
  createWorkoutPlan,
  listWorkoutPlans,
  getWorkoutPlan,
  updateWorkoutPlan,
  deleteWorkoutPlan
};
