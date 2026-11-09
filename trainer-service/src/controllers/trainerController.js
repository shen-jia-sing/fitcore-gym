const Trainer = require('../models/Trainer');
const { HttpError } = require('../lib/errors');
const { readBody, toObjectId, paginate } = require('../lib/validate');

const PROFILE_FIELDS = [
  'fullName',
  'specialties',
  'bio',
  'experienceYears',
  'certifications',
  'hourlyRate',
  'availability'
];

async function findTrainer(id) {
  toObjectId(id, 'id');
  const trainer = await Trainer.findById(id);

  if (!trainer) {
    throw new HttpError(404, 'Trainer profile not found');
  }

  return trainer;
}

function assertOwnerOrAdmin(req, trainer) {
  if (req.user.role !== 'admin' && trainer.userId.toString() !== req.user.id) {
    throw new HttpError(403, 'You can only manage your own trainer profile');
  }
}

// POST /trainers (trainer: own profile; admin: profile for any trainer userId)
async function createTrainer(req, res) {
  const isAdmin = req.user.role === 'admin';
  const body = readBody(req, isAdmin ? [...PROFILE_FIELDS, 'userId'] : PROFILE_FIELDS);
  const userId = toObjectId(isAdmin ? body.userId : req.user.id, 'userId');

  if (await Trainer.exists({ userId })) {
    throw new HttpError(409, 'A trainer profile already exists for this user');
  }

  const trainer = await Trainer.create({ ...body, userId });
  res.status(201).json({ message: 'Trainer profile created', data: trainer });
}

// GET /trainers (any role): ?specialty= ?isActive=
async function listTrainers(req, res) {
  const filter = {};

  if (req.query.specialty) filter.specialties = req.query.specialty;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  res.json(await paginate(Trainer, filter, req.query, { fullName: 1 }));
}

// GET /trainers/:id (any role)
async function getTrainer(req, res) {
  res.json({ data: await findTrainer(req.params.id) });
}

// PATCH /trainers/:id (admin, or the trainer who owns the profile)
async function updateTrainer(req, res) {
  const trainer = await findTrainer(req.params.id);
  assertOwnerOrAdmin(req, trainer);

  const updates = readBody(req, [...PROFILE_FIELDS, 'isActive'], { requireAny: true });
  trainer.set(updates);
  await trainer.save();

  res.json({ message: 'Trainer profile updated', data: trainer });
}

// DELETE /trainers/:id (admin)
async function deleteTrainer(req, res) {
  toObjectId(req.params.id, 'id');
  const trainer = await Trainer.findByIdAndDelete(req.params.id);

  if (!trainer) {
    throw new HttpError(404, 'Trainer profile not found');
  }

  res.json({ message: 'Trainer profile deleted', data: { id: trainer.id, fullName: trainer.fullName } });
}

// GET /internal/trainers/by-user/:userId (called by class-service before scheduling a class)
async function internalGetByUser(req, res) {
  const userId = toObjectId(req.params.userId, 'userId');
  const trainer = await Trainer.findOne({ userId });

  if (!trainer) {
    throw new HttpError(404, 'Trainer profile not found. Create it with POST /api/trainers first.');
  }

  if (!trainer.isActive) {
    throw new HttpError(409, 'Trainer profile is inactive');
  }

  res.json({ data: trainer });
}

module.exports = {
  createTrainer,
  listTrainers,
  getTrainer,
  updateTrainer,
  deleteTrainer,
  internalGetByUser
};
