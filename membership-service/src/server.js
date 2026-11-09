const app = require('./app');
const config = require('./config');
const { startService } = require('./lib/server');

startService({ app, config }).catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
