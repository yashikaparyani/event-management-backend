// server/routes/authRoutes.js

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');
const checkPermission = require('../middleware/checkPermission');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Route: POST /login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).populate('role');
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    // Defensive: check if user.role exists and has a name
    if (!user.role || !user.role.name) {
      return res.status(400).json({ message: 'User role is missing or invalid. Please contact admin.' });
    }
    if (user.role.name === 'coordinator' && user.status !== 'approved') {
      return res.status(403).json({ 
        message: 'Your account is pending approval',
        status: 'pending',
        role: user.role.name
      });
    }
    const payload = {
      id: user._id,
      role: user.role ? user.role.name : null,
      name: user.name,
      email: user.email,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'default_secret_key', {
      expiresIn: '1h',
    });
    res.json({ 
      token, 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route: POST /register
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      eventInterest,
      coordinationArea,
      availability,
      skills,
      createdByAdmin
    } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    if (!createdByAdmin) {
      if (!phone) {
        return res.status(400).json({ message: 'Phone number is required' });
      }
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        return res.status(400).json({ message: 'Phone number already registered' });
      }
    }
    const roleDoc = await Role.findOne({ name: role });
    if (!roleDoc) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    let status = 'approved';
    // if (['coordinator', 'volunteer'].includes(role)) {
    //   status = createdByAdmin ? 'approved' : 'pending';
    // }
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: roleDoc._id,
      status
    });
    if (phone && phone.trim() !== '') {
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
    res.status(201).json({ 
      message: 'User registered successfully',
      status: newUser.status
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Route: GET /pending-users
router.get('/pending-users', authMiddleware, checkPermission('approve'), async (req, res) => {
  try {
    const pendingUsers = await User.find({ status: 'pending' })
      .populate('role')
      .where('role.name').in(['coordinator', 'volunteer'])
      .select('-password');
    res.json(pendingUsers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending users', error: error.message });
  }
});

// Route: PUT /approve-user/:userId
router.put('/approve-user/:userId', authMiddleware, checkPermission('approve'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }
    const user = await User.findById(userId).populate('role');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (!user.role || !user.role.name) {
      return res.status(400).json({ message: 'User role is missing or invalid. Please contact admin.' });
    }
    if (user.role.name !== 'coordinator') {
      return res.status(400).json({ message: 'This user type does not require approval' });
    }
    user.status = status;
    await user.save();
    res.json({ message: `User ${status} successfully`, user });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
