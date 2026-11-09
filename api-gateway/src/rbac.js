const { match } = require('path-to-regexp');

// Role-based access control: the single source of truth for who may call what.
// Every public route is listed here. Anything not listed is rejected with 404 (deny by default).
// Services enforce data ownership on top of this (e.g. a member reads only their own payments).

const PUBLIC = 'public';
const ADMIN = ['admin'];
const TRAINER = ['trainer'];
const MEMBER = ['member'];
const ADMIN_TRAINER = ['admin', 'trainer'];
const ADMIN_MEMBER = ['admin', 'member'];
const ANY_ROLE = ['admin', 'trainer', 'member'];

// [method, gateway path, who may call it, target service]
const RULES = [
  // Gateway
  ['GET',    '/api/health/:service',          PUBLIC,        'gateway'],
  ['GET',    '/api/status',                   ADMIN,         'gateway'],

  // Registration service (users collection owner)
  ['POST',   '/api/auth/register',            PUBLIC,        'registration'],
  ['POST',   '/api/users',                    ADMIN,         'registration'],
  ['GET',    '/api/users',                    ADMIN,         'registration'],
  ['GET',    '/api/users/:id',                ANY_ROLE,      'registration'],
  ['PATCH',  '/api/users/:id',                ANY_ROLE,      'registration'],
  ['DELETE', '/api/users/:id',                ADMIN,         'registration'],

  // Login service
  ['POST',   '/api/auth/login',               PUBLIC,        'login'],
  ['GET',    '/api/auth/me',                  ANY_ROLE,      'login'],
  ['PATCH',  '/api/auth/password',            ANY_ROLE,      'login'],

  // Membership service
  ['GET',    '/api/plans',                    PUBLIC,        'membership'],
  ['GET',    '/api/plans/:id',                PUBLIC,        'membership'],
  ['POST',   '/api/plans',                    ADMIN,         'membership'],
  ['PATCH',  '/api/plans/:id',                ADMIN,         'membership'],
  ['DELETE', '/api/plans/:id',                ADMIN,         'membership'],
  ['POST',   '/api/memberships',              ADMIN_MEMBER,  'membership'],
  ['GET',    '/api/memberships',              ADMIN_MEMBER,  'membership'],
  ['GET',    '/api/memberships/:id',          ADMIN_MEMBER,  'membership'],
  ['PATCH',  '/api/memberships/:id',          ADMIN,         'membership'],
  ['DELETE', '/api/memberships/:id',          ADMIN,         'membership'],

  // Payment service
  ['POST',   '/api/payments',                 ADMIN_MEMBER,  'payment'],
  ['GET',    '/api/payments',                 ADMIN_MEMBER,  'payment'],
  ['GET',    '/api/payments/stats/revenue',   ADMIN,         'payment'],
  ['GET',    '/api/payments/:id',             ADMIN_MEMBER,  'payment'],
  ['PATCH',  '/api/payments/:id',             ADMIN,         'payment'],
  ['DELETE', '/api/payments/:id',             ADMIN,         'payment'],

  // Class service
  ['POST',   '/api/classes',                  ADMIN_TRAINER, 'class'],
  ['GET',    '/api/classes',                  ANY_ROLE,      'class'],
  ['GET',    '/api/classes/:id',              ANY_ROLE,      'class'],
  ['PATCH',  '/api/classes/:id',              ADMIN_TRAINER, 'class'],
  ['DELETE', '/api/classes/:id',              ADMIN_TRAINER, 'class'],

  // Booking service
  ['POST',   '/api/bookings',                 MEMBER,        'booking'],
  ['GET',    '/api/bookings',                 ANY_ROLE,      'booking'],
  ['GET',    '/api/bookings/:id',             ANY_ROLE,      'booking'],
  ['PATCH',  '/api/bookings/:id',             ADMIN_MEMBER,  'booking'],
  ['DELETE', '/api/bookings/:id',             ADMIN,         'booking'],

  // Trainer service (trainer profiles + workout plans)
  ['POST',   '/api/trainers',                 ADMIN_TRAINER, 'trainer'],
  ['GET',    '/api/trainers',                 ANY_ROLE,      'trainer'],
  ['GET',    '/api/trainers/:id',             ANY_ROLE,      'trainer'],
  ['PATCH',  '/api/trainers/:id',             ADMIN_TRAINER, 'trainer'],
  ['DELETE', '/api/trainers/:id',             ADMIN,         'trainer'],
  ['POST',   '/api/workout-plans',            TRAINER,       'trainer'],
  ['GET',    '/api/workout-plans',            ANY_ROLE,      'trainer'],
  ['GET',    '/api/workout-plans/:id',        ANY_ROLE,      'trainer'],
  ['PATCH',  '/api/workout-plans/:id',        ADMIN_TRAINER, 'trainer'],
  ['DELETE', '/api/workout-plans/:id',        ADMIN_TRAINER, 'trainer'],

  // Attendance service
  ['POST',   '/api/attendance/check-in',      ADMIN_MEMBER,  'attendance'],
  ['POST',   '/api/attendance/check-out',     ADMIN_MEMBER,  'attendance'],
  ['GET',    '/api/attendance',               ANY_ROLE,      'attendance'],
  ['GET',    '/api/attendance/stats',         ANY_ROLE,      'attendance'],
  ['GET',    '/api/attendance/:id',           ANY_ROLE,      'attendance'],
  ['PATCH',  '/api/attendance/:id',           ADMIN,         'attendance'],
  ['DELETE', '/api/attendance/:id',           ADMIN,         'attendance']
];

const routes = RULES.map(([method, path, access, service]) => ({
  method,
  path,
  access,
  service,
  matches: match(path)
}));

// Returns the first rule matching the method and path. Literal paths are listed before
// parameterised ones (e.g. /api/payments/stats/revenue before /api/payments/:id).
function findRoute(method, path) {
  return routes.find((route) => route.method === method && route.matches(path));
}

module.exports = { PUBLIC, routes, findRoute };
