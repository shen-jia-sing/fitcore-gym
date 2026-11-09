const express = require('express');
const config = require('./config');
const routes = require('./routes');
const { healthRoute } = require('./lib/server');
const {
  servedBy,
  requestLogger,
  trustGateway,
  notFound,
  errorHandler
} = require('./lib/middleware');

const app = express();

app.disable('x-powered-by');
app.use(servedBy(config.serviceName, config.instanceName));
app.use(requestLogger(config.serviceName, config.instanceName));
app.use(express.json({ limit: '100kb' }));

app.get('/health', healthRoute(config.serviceName, config.instanceName));

app.use(trustGateway(config.internalApiKey));
app.use(routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
