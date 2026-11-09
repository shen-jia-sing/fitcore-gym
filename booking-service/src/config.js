const { requireEnv, requireIntEnv } = require('./lib/config');

module.exports = {
  serviceName: 'booking-service',
  port: requireIntEnv('PORT'),
  instanceName: requireEnv('INSTANCE_NAME'),
  mongoUri: requireEnv('MONGO_URI'),
  mongoDbName: requireEnv('MONGO_DB_NAME'),
  internalApiKey: requireEnv('INTERNAL_API_KEY'),
  classServiceUrl: requireEnv('CLASS_SERVICE_URL')
};
