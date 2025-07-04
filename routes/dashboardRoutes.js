const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const dashboardController = require('../controllers/dashboardController');

router.get('/stats', authMiddleware, dashboardController.getDashboardStats);

// Get allowed public registration roles (public)
router.get('/allowed-public-roles', dashboardController.getAllowedPublicRoles);
// Update allowed public registration roles (admin only)
router.put('/allowed-public-roles', authMiddleware, dashboardController.updateAllowedPublicRoles);

module.exports = router; 