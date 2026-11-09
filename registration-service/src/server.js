const app = require('./app');
const config = require('./config');
const { startService } = require('./lib/server');
const { ensureSeedAdmin } = require('./controllers/userController');

startService({
  app,
  config,
  onDatabaseReady: () => ensureSeedAdmin(config.seedAdmin)
}).catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
