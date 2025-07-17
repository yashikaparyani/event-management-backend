const express = require('express');
const router = express.Router();
const poetryController = require('../controllers/poetryController');
const authMiddleware = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/checkPermission');

// Submit a poem (participant only)
router.post('/submit', authMiddleware, checkPermission(['participant']), poetryController.submitPoem);

// Get all submissions for a poetry event (open to all)
router.get('/:eventId/submissions', poetryController.getSubmissions);

// Delete a poem (admin/coordinator only)
router.delete('/:poemId', authMiddleware, checkPermission(['admin', 'coordinator']), poetryController.deletePoem);

module.exports = router; 