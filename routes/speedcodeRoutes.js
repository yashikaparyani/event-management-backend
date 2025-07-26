const express = require('express');
const router = express.Router();
const speedcodeController = require('../controllers/speedcodeControllers');
const authMiddleware = require('../middleware/authMiddleware');

// Coordinator: Create a coding problem
router.post('/problems', authMiddleware, speedcodeController.createProblem);

// Coordinator/Participant: Get all problems for an event
router.get('/problems/:eventId', authMiddleware, speedcodeController.getProblemsByEvent);

// Participant: Submit code for a problem
router.post('/submit/:problemId', authMiddleware, speedcodeController.submitCode);

// (You can add more routes later for edit, delete, leaderboard, etc.)
router.put('/problems/:problemId', authMiddleware, speedcodeController.updateProblem);
router.delete('/problems/:problemId', authMiddleware, speedcodeController.deleteProblem);
router.get('/submissions', authMiddleware, speedcodeController.getSubmissionsByEvent);

module.exports = router;