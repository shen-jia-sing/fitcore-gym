const crypto = require('crypto');
const morgan = require('morgan');
const { HttpError } = require('./errors');

// Tags every response with the service and instance that produced it (used to show load balancing).
function servedBy(serviceName, instanceName) {
  const label = `${serviceName}@${instanceName}`;

  return (req, res, next) => {
    res.set('X-Served-By', label);
    next();
  };
}

function requestLogger(serviceName, instanceName) {
  return morgan(
    `[${serviceName}@${instanceName}] :method :url :status :response-time ms req=:req[x-request-id]`
  );
}

// Accepts only requests that carry the internal key. The API gateway adds it after
// verifying the JWT, together with the caller's identity (x-user-id, x-user-role).
function trustGateway(internalApiKey) {
  const expected = Buffer.from(internalApiKey);

  return (req, res, next) => {
    const provided = Buffer.from(req.get('x-internal-key') ?? '');

    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      throw new HttpError(401, 'Direct access is not allowed. Send requests through the API gateway.');
    }

    const userId = req.get('x-user-id');
    req.user = userId ? { id: userId, role: req.get('x-user-role') } : null;
    next();
  };
}

// For routes the gateway protects with a JWT. Missing identity means the gateway is misconfigured.
function requireUser(req, res, next) {
  if (!req.user) {
    throw new HttpError(401, 'Authentication required');
  }

  next();
}

function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
}

// Maps known error types to HTTP responses. Anything else is a 500.
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      message: err.message,
      ...(err.details && { details: err.details })
    });
  }

  if (err.name === 'ValidationError') {
    const details = Object.fromEntries(
      Object.entries(err.errors).map(([field, error]) => [field, error.message])
    );
    return res.status(400).json({ message: 'Validation failed', details });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({ message: `Invalid value for ${err.path}` });
  }

  if (err.code === 11000) {
    return res.status(409).json({ message: 'Duplicate value', details: err.keyValue });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body' });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large' });
  }

  console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
}

module.exports = { servedBy, requestLogger, trustGateway, requireUser, notFound, errorHandler };
