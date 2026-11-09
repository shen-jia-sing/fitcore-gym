const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('./config');

const PROXY_TIMEOUT_MS = 15000;

function createServiceProxy(serviceName, target) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    proxyTimeout: PROXY_TIMEOUT_MS,
    pathRewrite: { '^/api': '' },
    on: {
      error: (err, req, res) => {
        console.error(`Proxy error for ${serviceName}: ${err.message}`);
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ message: `${serviceName} service is unavailable` }));
      }
    }
  });
}

const proxies = Object.fromEntries(
  Object.entries(config.services).map(([name, url]) => [name, createServiceProxy(name, url)])
);

// Streams the request (body untouched) to the service chosen by the RBAC rule.
function proxyToService(req, res, next) {
  return proxies[req.targetService](req, res, next);
}

module.exports = { proxyToService };
