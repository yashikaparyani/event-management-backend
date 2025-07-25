const express = require('express');
const router = express.Router();
const debateController = require('../controllers/debateController');
const authMiddleware = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/checkPermission');

// Create a new debate (admin/coordinator)
router.post('/', authMiddleware, checkPermission('create_event'), debateController.createDebate);

// Get debate details
router.get('/:id', authMiddleware, checkPermission('view'), debateController.getDebate);

// Get debate by event ID
router.get('/event/:eventId', authMiddleware, checkPermission('view'), debateController.getDebateByEvent);

// Register a team (participant)
router.post('/:debateId/teams', authMiddleware, checkPermission('register'), debateController.registerTeam);

// Register as audience
router.post('/:debateId/audience', authMiddleware, checkPermission('register'), debateController.registerAudience);

// Register participant for debate
router.post('/:debateId/participants', authMiddleware, checkPermission('register'), debateController.registerParticipant);

// Start debate session (coordinator)
router.post('/:debateId/session/start', authMiddleware, checkPermission('edit_event'), debateController.startSession);

// End debate session (coordinator)
router.post('/:debateId/session/end', authMiddleware, checkPermission('edit_event'), debateController.endSession);

// Move to next speaker (coordinator)
router.post('/:debateId/session/next-speaker', authMiddleware, checkPermission('edit_event'), debateController.nextSpeaker);

// Assign score to team (coordinator)
router.post('/:debateId/session/score', authMiddleware, checkPermission('edit_event'), debateController.assignScore);

// Get current session state
router.get('/:debateId/session', authMiddleware, checkPermission('view'), debateController.getSession);

// Get debate session by event ID
router.get('/event/:eventId/session', authMiddleware, checkPermission('view'), debateController.getSessionByEvent);

// Participant flow - Get debate details for participant
router.get('/participant/:eventId', authMiddleware, checkPermission('participate'), debateController.getParticipantDebate);

// Audience flow - Get debate details for audience
router.get('/audience/:eventId', authMiddleware, checkPermission('view'), debateController.getAudienceDebate);

// Get leaderboard for a debate
router.get('/:debateId/leaderboard', authMiddleware, checkPermission('view'), debateController.getLeaderboard);

// Update debate status
router.patch('/:debateId/status', authMiddleware, checkPermission('edit_event'), debateController.updateDebateStatus);

module.exports = router; 