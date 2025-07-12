const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const authMiddleware = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/checkPermission');

// Create a new quiz (coordinator only)
router.post('/', authMiddleware, checkPermission('create_event'), quizController.createQuiz);

// Get quiz by ID
router.get('/:id', authMiddleware, checkPermission('view'), quizController.getQuizById);

// Update quiz (coordinator only)
router.put('/:id', authMiddleware, checkPermission('edit_event'), quizController.updateQuiz);

// Get quizzes for an event
router.get('/event/:eventId', authMiddleware, checkPermission('view'), quizController.getQuizzesByEvent);

// Get quizzes created by a coordinator
router.get('/coordinator/quizzes', authMiddleware, checkPermission('view'), quizController.getQuizzesByCoordinator);

module.exports = router; 