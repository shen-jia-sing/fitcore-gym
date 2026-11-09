const { requireEnv, requireIntEnv } = require('./lib/config');

module.exports = {
  serviceName: 'payment-service',
  port: requireIntEnv('PORT'),
  instanceName: requireEnv('INSTANCE_NAME'),
  mongoUri: requireEnv('MONGO_URI'),
  mongoDbName: requireEnv('MONGO_DB_NAME'),
  internalApiKey: requireEnv('INTERNAL_API_KEY'),
  membershipServiceUrl: requireEnv('MEMBERSHIP_SERVICE_URL')
};
