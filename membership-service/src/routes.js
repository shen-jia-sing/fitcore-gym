const express = require('express');
const { requireUser } = require('./lib/middleware');
const plans = require('./controllers/planController');
const memberships = require('./controllers/membershipController');

const router = express.Router();

// Role checks happen at the API gateway; ownership checks happen in the controllers.
router.post('/plans', requireUser, plans.createPlan);
router.get('/plans', plans.listPlans);
router.get('/plans/:id', plans.getPlan);
router.patch('/plans/:id', requireUser, plans.updatePlan);
router.delete('/plans/:id', requireUser, plans.deletePlan);

router.post('/memberships', requireUser, memberships.createMembership);
router.get('/memberships', requireUser, memberships.listMemberships);
router.get('/memberships/:id', requireUser, memberships.getMembership);
router.patch('/memberships/:id', requireUser, memberships.updateMembership);
router.delete('/memberships/:id', requireUser, memberships.deleteMembership);

// Internal service-to-service API
router.get('/internal/memberships/:id', memberships.internalGetMembership);
router.post('/internal/memberships/:id/activate', memberships.internalActivateMembership);
router.get('/internal/members/:userId/active-membership', memberships.internalGetActiveMembership);

module.exports = router;
