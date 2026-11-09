const app = require('./app');
const config = require('./config');

const server = app.listen(config.port, () => {
  console.log(`${config.serviceName} (${config.instanceName}) listening on port ${config.port}`);
});

const shutdown = (signal) => {
  console.log(`${signal} received: closing HTTP server`);
  server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
