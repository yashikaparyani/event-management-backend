const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Role = require('../models/Role');

async function createInitialAdmin() {
  try {
    console.log('Starting admin user creation...');

    // Check if admin role exists
    let adminRole = await Role.findOne({ name: 'admin' });
    console.log('Admin role check:', adminRole ? 'Found' : 'Not found');
    
    // If admin role doesn't exist, create it
    if (!adminRole) {
      console.log('Creating admin role...');
      adminRole = new Role({
        name: 'admin',
        description: 'Administrator with full access',
        permissions: [], // Will be populated by initializeRolesAndPermissions
        isDefault: false
      });
      await adminRole.save();
      console.log('Admin role created successfully');
    }

    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: 'admin@example.com' });
    console.log('Existing admin check:', existingAdmin ? 'Found' : 'Not found');

    if (existingAdmin) {
      console.log('Admin user already exists, updating if needed...');
      // Update admin user if needed
      existingAdmin.role = adminRole._id;
      existingAdmin.status = 'approved';
      await existingAdmin.save();
      console.log('Admin user updated successfully');
      return;
    }

    console.log('Creating new admin user...');
    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminUser = new User({
      name: 'System Admin',
      email: 'admin@example.com',
      password: hashedPassword,
      role: adminRole._id,
      status: 'approved' // Set status to approved for admin
    });

    await adminUser.save();
    console.log('Initial admin user created successfully');
  } catch (error) {
    console.error('Error creating admin user:', {
      message: error.message,
      stack: error.stack
    });
    throw error; // Re-throw to handle in the main server file
  }
}

module.exports = createInitialAdmin; 