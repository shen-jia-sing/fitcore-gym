const { requireEnv, requireIntEnv } = require('./lib/config');

const jwtSecret = requireEnv('JWT_SECRET');

if (jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}

module.exports = {
  serviceName: 'api-gateway',
  port: requireIntEnv('PORT'),
  instanceName: requireEnv('INSTANCE_NAME'),
  internalApiKey: requireEnv('INTERNAL_API_KEY'),
  jwt: {
    secret: jwtSecret,
    issuer: 'fitcore-login-service',
    audience: 'fitcore-api'
  },
  // Business services point at the Nginx load balancer; identity services are reached directly.
  services: {
    registration: requireEnv('REGISTRATION_URL'),
    login: requireEnv('LOGIN_URL'),
    membership: requireEnv('MEMBERSHIP_URL'),
    payment: requireEnv('PAYMENT_URL'),
    class: requireEnv('CLASS_URL'),
    booking: requireEnv('BOOKING_URL'),
    trainer: requireEnv('TRAINER_URL'),
    attendance: requireEnv('ATTENDANCE_URL')
  }
};
