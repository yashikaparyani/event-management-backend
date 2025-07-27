const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const authMiddleware = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/checkPermission');

// Create a new event (requires create_event permission)
router.post('/', authMiddleware, checkPermission('create_event'), eventController.createEvent);

// Get all events (requires 'view' permission)
router.get('/', authMiddleware, checkPermission('view'), eventController.getEvents);

// Get upcoming events
router.get('/upcoming', authMiddleware, checkPermission('view'), eventController.getUpcomingEvents);

// Get registered events
router.get('/registered', authMiddleware, checkPermission('view'), eventController.getRegisteredEvents);

// Get a single event by ID (requires 'view' permission)
router.get('/:id', authMiddleware, checkPermission('view'), eventController.getEventById);

// Update an event by ID (requires 'edit_event' permission)
router.put('/:id', authMiddleware, checkPermission('edit_event'), eventController.updateEvent);

// Delete an event by ID (requires 'delete' permission)
router.delete('/:id', authMiddleware, checkPermission('delete'), eventController.deleteEvent);

// Register for an event (participant)
router.post('/:id/register', authMiddleware, eventController.registerForEvent);

// Debate leaderboard for Debate events (all roles)
router.get('/:id/debate-leaderboard', authMiddleware, eventController.getDebateLeaderboard);

// Debate setup for Debate events (coordinator only)
router.put('/:id/debate-setup', authMiddleware, checkPermission('manage_events'), eventController.debateSetup);

// Get participants for an event (for debate, returns registered users)
router.get('/:id/participants', authMiddleware, eventController.getParticipants);

// Future routes for events (GET, PUT, DELETE) will be added here

module.exports = router; 