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
    console.log('Login attempt for:', email);

    // Find user by email and populate role
    const user = await User.findOne({ email }).populate('role');
    if (!user) {
      console.log('User not found:', email);
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    console.log('User found:', {
      id: user._id,
      role: user.role ? user.role.name : 'no role',
      status: user.status
    });

    // Compare password with bcrypt
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Password mismatch for:', email);
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Check if user is approved (only for coordinator role)
    if (user.role.name === 'coordinator' && user.status !== 'approved') {
      console.log('Coordinator not approved:', {
        email,
        role: user.role.name,
        status: user.status
      });
      return res.status(403).json({ 
        message: 'Your account is pending approval',
        status: 'pending',
        role: user.role.name
      });
    }

    // Create JWT payload
    const payload = {
      id: user._id,
      role: user.role.name,
      name: user.name,
      email: user.email,
    };

    // Sign token with secret and expiration
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'default_secret_key', {
      expiresIn: '1h',
    });

    console.log('Login successful for:', email);

    // Send token & user info as response
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
      eventInterest,
      coordinationArea,
      experience,
      availability,
      skills
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Find role by name
    const roleDoc = await Role.findOne({ name: role });
    if (!roleDoc) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user object - Auto-approve audience, participant, and volunteer
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role: roleDoc._id,
      status: ['audience', 'participant', 'volunteer'].includes(role) ? 'approved' : 'pending' // Auto-approve audience, participant, volunteer
    });

    // Add role-specific data
    if (role === 'participant') {
      newUser.eventInterest = eventInterest;
    } else if (role === 'coordinator') {
      newUser.coordinationArea = coordinationArea;
      newUser.experience = experience;
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
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Route: GET /pending-users
router.get('/pending-users', authMiddleware, checkPermission('approve'), async (req, res) => {
  try {
    // Filter pending users to only include coordinators and volunteers
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
    const { status } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const user = await User.findById(userId).populate('role');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Only allow approval/rejection for coordinator role
    if (user.role.name !== 'coordinator') {
      return res.status(400).json({ message: 'This user type does not require approval' });
    }

    user.status = status;
    await user.save();

    res.json({ message: `User ${status} successfully`, user });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
