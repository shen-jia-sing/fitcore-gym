const mongoose = require('mongoose');

function dbState() {
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
}

// GET /health: used by Docker health checks and the load balancer demo.
function healthRoute(serviceName, instanceName) {
  return (req, res) => {
    const db = dbState();

    res.status(db === 'connected' ? 200 : 503).json({
      service: serviceName,
      instance: instanceName,
      status: db === 'connected' ? 'ok' : 'degraded',
      db,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString()
    });
  };
}

// Connects to MongoDB, builds indexes, starts HTTP, and shuts down cleanly on SIGTERM/SIGINT.
async function startService({ app, config, onDatabaseReady }) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, {
    dbName: config.mongoDbName,
    serverSelectionTimeoutMS: 10000
  });
  console.log(`MongoDB connected (database: ${config.mongoDbName})`);

  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));

  if (onDatabaseReady) {
    await onDatabaseReady();
  }

  const server = app.listen(config.port, () => {
    console.log(`${config.serviceName} (${config.instanceName}) listening on port ${config.port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received: closing HTTP server and MongoDB connection`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = { healthRoute, startService };
