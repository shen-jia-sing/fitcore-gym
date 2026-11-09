const jwt = require('jsonwebtoken');
const config = require('./config');
const { PUBLIC, findRoute } = require('./rbac');

const IDENTITY_HEADERS = ['x-user-id', 'x-user-role', 'x-internal-key'];

function deny(res, status, message) {
  res.status(status).json({ message });
}

// 1. Find the RBAC rule (unknown routes -> 404)
// 2. Verify the JWT for protected routes (missing/invalid/expired -> 401)
// 3. Check the caller's role against the rule (wrong role -> 403)
// 4. Pass the verified identity to the service in trusted headers
function authorize(req, res, next) {
  const route = findRoute(req.method, req.path);

  if (!route) {
    return deny(res, 404, `No route for ${req.method} ${req.path}`);
  }

  // Never forward identity headers sent by the client.
  for (const header of IDENTITY_HEADERS) {
    delete req.headers[header];
  }

  req.headers['x-internal-key'] = config.internalApiKey;
  req.targetService = route.service;

  if (route.access === PUBLIC) {
    return next();
  }

  const [scheme, token] = (req.get('authorization') ?? '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    return deny(res, 401, 'Missing bearer token. Log in with POST /api/auth/login.');
  }

  let claims;

  try {
    claims = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience
    });
  } catch (err) {
    return deny(res, 401, `Invalid token: ${err.message}`);
  }

  if (!route.access.includes(claims.role)) {
    return deny(
      res,
      403,
      `Role '${claims.role}' cannot ${req.method} ${route.path}. Allowed: ${route.access.join(', ')}`
    );
  }

  req.headers['x-user-id'] = claims.sub;
  req.headers['x-user-role'] = claims.role;
  req.user = { id: claims.sub, role: claims.role };
  return next();
}

module.exports = { authorize };
