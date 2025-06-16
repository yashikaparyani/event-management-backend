// routes/userRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/checkPermission');

// GET /api/users - Get all users (admin only)
router.get('/users', authMiddleware, checkPermission('admin_panel'), async (req, res) => {
  try {
    const users = await User.find({}, '-password').populate('role');// exclude password field
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/users/:id/approve - Approve coordinator (admin only)
router.post('/users/:id/approve', authMiddleware, checkPermission('approve'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role !== 'coordinator') {
      return res.status(400).json({ message: 'Only coordinators can be approved' });
    }

    user.status = 'approved';
    await user.save();
    res.json({ message: 'Coordinator approved' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/users/:id/reject - Reject coordinator (admin only)
router.post('/users/:id/reject', authMiddleware, checkPermission('approve'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.role !== 'coordinator') {
      return res.status(400).json({ message: 'Only coordinators can be rejected' });
    }

    user.status = 'rejected';
    await user.save();
    res.json({ message: 'Coordinator rejected' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/users/:id - Delete a user (admin only)
router.delete('/users/:id', authMiddleware, checkPermission('delete'), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
