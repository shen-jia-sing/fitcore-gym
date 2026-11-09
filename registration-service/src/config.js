const { requireEnv, requireIntEnv } = require('./lib/config');

module.exports = {
  serviceName: 'registration-service',
  port: requireIntEnv('PORT'),
  instanceName: requireEnv('INSTANCE_NAME'),
  mongoUri: requireEnv('MONGO_URI'),
  mongoDbName: requireEnv('MONGO_DB_NAME'),
  internalApiKey: requireEnv('INTERNAL_API_KEY'),
  seedAdmin: {
    name: requireEnv('SEED_ADMIN_NAME'),
    email: requireEnv('SEED_ADMIN_EMAIL'),
    password: requireEnv('SEED_ADMIN_PASSWORD')
  }
};
