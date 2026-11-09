const config = require('./config');

const HEALTH_TIMEOUT_MS = 3000;

async function fetchHealth(name) {
  try {
    const response = await fetch(`${config.services[name]}/health`, {
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS)
    });

    return {
      httpStatus: response.status,
      body: await response.json(),
      servedBy: response.headers.get('x-served-by'),
      upstream: response.headers.get('x-upstream-addr')
    };
  } catch (err) {
    return {
      httpStatus: 503,
      body: { service: `${name}-service`, status: 'unreachable', error: err.message },
      servedBy: null,
      upstream: null
    };
  }
}

// GET /health: the gateway itself.
function gatewayHealth(req, res) {
  res.json({
    service: config.serviceName,
    instance: config.instanceName,
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  });
}

// GET /api/health/:service (public): one service's health, through the load balancer.
// Call it several times to watch the "instance" alternate between node-a and node-b.
async function serviceHealth(req, res) {
  const name = req.params.service;

  if (!Object.hasOwn(config.services, name)) {
    return res.status(404).json({
      message: `Unknown service '${name}'. Use one of: ${Object.keys(config.services).join(', ')}`
    });
  }

  const result = await fetchHealth(name);

  if (result.servedBy) res.set('X-Served-By', result.servedBy);
  if (result.upstream) res.set('X-Upstream-Addr', result.upstream);

  res.status(result.httpStatus).json({ ...result.body, upstream: result.upstream });
}

// GET /api/status (admin): every service at once.
async function systemStatus(req, res) {
  const names = Object.keys(config.services);
  const results = await Promise.all(names.map(fetchHealth));

  const services = names.map((name, i) => ({
    name,
    status: results[i].body.status,
    instance: results[i].body.instance ?? null,
    db: results[i].body.db ?? null,
    upstream: results[i].upstream
  }));

  const allHealthy = services.every((service) => service.status === 'ok');

  res.status(allHealthy ? 200 : 503).json({
    gateway: { instance: config.instanceName, status: 'ok' },
    overall: allHealthy ? 'ok' : 'degraded',
    services
  });
}

module.exports = { gatewayHealth, serviceHealth, systemStatus };
