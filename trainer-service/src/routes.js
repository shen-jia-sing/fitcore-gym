const express = require('express');
const { requireUser } = require('./lib/middleware');
const trainers = require('./controllers/trainerController');
const workoutPlans = require('./controllers/workoutPlanController');

const router = express.Router();

// Role checks happen at the API gateway; ownership checks happen in the controllers.
router.use(['/trainers', '/workout-plans'], requireUser);

router.post('/trainers', trainers.createTrainer);
router.get('/trainers', trainers.listTrainers);
router.get('/trainers/:id', trainers.getTrainer);
router.patch('/trainers/:id', trainers.updateTrainer);
router.delete('/trainers/:id', trainers.deleteTrainer);

router.post('/workout-plans', workoutPlans.createWorkoutPlan);
router.get('/workout-plans', workoutPlans.listWorkoutPlans);
router.get('/workout-plans/:id', workoutPlans.getWorkoutPlan);
router.patch('/workout-plans/:id', workoutPlans.updateWorkoutPlan);
router.delete('/workout-plans/:id', workoutPlans.deleteWorkoutPlan);

// Internal service-to-service API
router.get('/internal/trainers/by-user/:userId', trainers.internalGetByUser);

module.exports = router;
