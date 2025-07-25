const express = require('express');
const router = express.Router();
const codecRazeController = require('../controllers/codecRazeController');
const authMiddleware = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/checkPermission');

// Create a new problem (admin/coordinator only)
router.post('/problems', authMiddleware, checkPermission('manage_events'), codecRazeController.createProblem);

// Get all problems (open to authenticated users)
router.get('/problems', authMiddleware, codecRazeController.getProblems);

// Get a single problem by ID
router.get('/problems/:id', authMiddleware, codecRazeController.getProblemById);

// Submit code for a problem
router.post('/submit/:problemId', authMiddleware, codecRazeController.submitSolution);

module.exports = router; 