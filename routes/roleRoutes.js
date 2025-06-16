const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const authMiddleware = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/checkPermission');

// Get all roles
router.get('/roles', authMiddleware, checkPermission('view_roles'), roleController.getAllRoles);

// Get role by ID
router.get('/roles/:id', authMiddleware, checkPermission('view_roles'), roleController.getRoleById);

// Create new role
router.post('/roles', authMiddleware, checkPermission('manage_roles'), roleController.createRole);

// Update role
router.put('/roles/:id', authMiddleware, checkPermission('manage_roles'), roleController.updateRole);

// Delete role
router.delete('/roles/:id', authMiddleware, checkPermission('manage_roles'), roleController.deleteRole);

// Get all permissions
router.get('/permissions', authMiddleware, checkPermission('view_roles'), roleController.getAllPermissions);

module.exports = router; 