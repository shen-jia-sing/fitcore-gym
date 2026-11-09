const mongoose = require('mongoose');
const { HttpError } = require('./errors');

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// Returns the JSON body and rejects any field the endpoint does not accept.
function readBody(req, allowedFields, { requireAny = false } = {}) {
  const body = req.body ?? {};

  if (typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }

  const notAllowed = Object.keys(body).filter((field) => !allowedFields.includes(field));

  if (notAllowed.length > 0) {
    throw new HttpError(400, `Field(s) not allowed: ${notAllowed.join(', ')}`, { allowedFields });
  }

  if (requireAny && Object.keys(body).length === 0) {
    throw new HttpError(400, `Provide at least one of: ${allowedFields.join(', ')}`);
  }

  return body;
}

function toObjectId(value, label) {
  if (typeof value !== 'string' || !OBJECT_ID_PATTERN.test(value)) {
    throw new HttpError(400, `${label} must be a valid 24-character id`);
  }

  return new mongoose.Types.ObjectId(value);
}

function readPagination(query) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? DEFAULT_PAGE_SIZE : Number(query.limit);

  if (!Number.isInteger(page) || page < 1) {
    throw new HttpError(400, 'page must be a positive integer');
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new HttpError(400, `limit must be an integer from 1 to ${MAX_PAGE_SIZE}`);
  }

  return { page, limit, skip: (page - 1) * limit };
}

// Runs a paginated find and returns { data, pagination }.
async function paginate(Model, filter, query, sort) {
  const { page, limit, skip } = readPagination(query);

  const [data, total] = await Promise.all([
    Model.find(filter).sort(sort).skip(skip).limit(limit),
    Model.countDocuments(filter)
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
}

module.exports = { readBody, toObjectId, readPagination, paginate };
