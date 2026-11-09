const { requireEnv, requireIntEnv } = require('./lib/config');

const jwtSecret = requireEnv('JWT_SECRET');

if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

module.exports = {
  serviceName: 'login-service',
  port: requireIntEnv('PORT'),
  instanceName: requireEnv('INSTANCE_NAME'),
  mongoUri: requireEnv('MONGO_URI'),
  mongoDbName: requireEnv('MONGO_DB_NAME'),
  internalApiKey: requireEnv('INTERNAL_API_KEY'),
  jwt: {
    secret: jwtSecret,
    expiresIn: requireEnv('JWT_EXPIRES_IN'),
    issuer: 'fitcore-login-service',
    audience: 'fitcore-api'
  }
};
