const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const { rateLimit } = require('express-rate-limit');
const config = require('./config');
const { authorize } = require('./authorize');
const { proxyToService } = require('./proxy');
const { gatewayHealth, serviceHealth, systemStatus } = require('./healthController');

const app = express();

app.disable('x-powered-by');
app.use(helmet());

// Every request gets an id that is forwarded to the services and returned to the client.
app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  req.headers['x-request-id'] = requestId;
  res.set('X-Request-Id', requestId);
  next();
});

app.use(
  morgan(`[${config.serviceName}@${config.instanceName}] :method :url :status :response-time ms req=:req[x-request-id]`)
);

app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many requests. Try again in a minute.' }
  })
);

app.use(
  '/api/auth/login',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { message: 'Too many login attempts. Try again in a minute.' }
  })
);

app.get('/health', gatewayHealth);

// No body parser here: request bodies stream straight through to the services.
app.use(authorize);
app.get('/api/health/:service', serviceHealth);
app.get('/api/status', systemStatus);
app.use(proxyToService);

module.exports = app;
