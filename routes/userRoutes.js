// routes/userRoutes.js

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/checkPermission');
const mongoose = require('mongoose');

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
router.delete('/users/:id', authMiddleware, checkPermission('delete_user'), async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/users/:id - Update a user (admin only)
router.put('/users/:id', authMiddleware, checkPermission('update_user'), async (req, res) => {
  try {
    const { name, email, role } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ message: 'Please provide name, email, and role' });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.name = name;
    user.email = email;
    user.role = role; 
    await user.save();
    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/users - Admin creates a new user
router.post('/users', authMiddleware, checkPermission('create_user'), async (req, res) => {
  try {
    const { name, email, password, role, eventInterest, coordinationArea, availability, skills, phone, assignedEventId } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Please provide name, email, password, and role' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const roleDoc = await require('../models/Role').findOne({ name: role });
    if (!roleDoc) {
      console.error('Role not found for name:', role);
      return res.status(400).json({ message: 'Invalid role' });
    }
    const hashedPassword = await require('bcryptjs').hash(password, 10);
    let status = 'approved';
    // if (['coordinator', 'volunteer'].includes(role)) {
    //   status = 'pending';
    // }
    // Phone validation based on role
    if (["participant", "audience"].includes(role)) {
      if (!phone || phone.trim() === "") {
        return res.status(400).json({ message: "Phone number is required for participants and audience." });
      }
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({ message: "Phone number already registered." });
      }
    }
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: roleDoc._id,
      status
    });
    if (phone && phone.trim() !== "") {
      newUser.phone = phone;
    }
    if (role === 'participant') {
      newUser.eventInterest = eventInterest;
    } else if (role === 'coordinator') {
      newUser.coordinationArea = coordinationArea;
    } else if (role === 'volunteer') {
      newUser.availability = availability;
      newUser.skills = skills;
    }
    await newUser.save();
    // Assign event to coordinator if provided
    if (role === 'coordinator' && assignedEventId) {
      const Event = require('../models/Event');
      const event = await Event.findById(assignedEventId);
      if (!event) {
        // Rollback user creation
        await User.findByIdAndDelete(newUser._id);
        return res.status(400).json({ message: 'Selected event not found.' });
      }
      if (event.coordinator) {
        // Rollback user creation
        await User.findByIdAndDelete(newUser._id);
        return res.status(400).json({ message: 'This event already has a coordinator assigned.' });
      }
      event.coordinator = newUser._id;
      // Add to assignedCoordinators if Remix
      if (event.type === 'Remix') {
        if (!event.assignedCoordinators) event.assignedCoordinators = [];
        const coordId = typeof newUser._id === 'string' ? mongoose.Types.ObjectId(newUser._id) : newUser._id;
        if (!event.assignedCoordinators.map(id => String(id)).includes(String(coordId))) {
          event.assignedCoordinators.push(coordId);
        }
        console.log('Assigned coordinator to Remix event:', event._id, 'assignedCoordinators:', event.assignedCoordinators);
      }
      await event.save();
    }
    res.status(201).json({ message: 'User created successfully', user: { id: newUser._id, name: newUser.name, email: newUser.email, role: roleDoc.name, status: newUser.status } });
  } catch (error) {
    console.error('Error in POST /api/users:', {
      body: req.body,
      error: error.message,
      stack: error.stack
    });
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
