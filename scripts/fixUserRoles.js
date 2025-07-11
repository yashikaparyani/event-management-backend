// server/scripts/fixUserRoles.js

const mongoose = require('mongoose');
const User = require('../models/User');
const Role = require('../models/Role');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/event_management';

async function fixUserRoles() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  // Find users whose role is a string
  const usersWithStringRole = await User.find({ role: { $type: 'string' } });
  // Find users whose role is null
  const usersWithNullRole = await User.find({ role: null });

  let fixedCount = 0;

  if (usersWithStringRole.length === 0 && usersWithNullRole.length === 0) {
    console.log('No users with string or null role found.');
    await mongoose.disconnect();
    return;
  }

  for (const user of usersWithStringRole) {
    const roleName = user.role;
    const roleDoc = await Role.findOne({ name: roleName });
    if (roleDoc) {
      user.role = roleDoc._id;
      await user.save();
      console.log(`Fixed user ${user.email}: set role to ObjectId for '${roleName}'`);
      fixedCount++;
    } else {
      console.warn(`Role '${roleName}' not found for user ${user.email}`);
    }
  }

  // Assign default role (audience) to users with null role
  const defaultRole = await Role.findOne({ isDefault: true }) || await Role.findOne({ name: 'audience' });
  for (const user of usersWithNullRole) {
    if (defaultRole) {
      user.role = defaultRole._id;
      await user.save();
      console.log(`Fixed user ${user.email}: set role to default 'audience'`);
      fixedCount++;
    } else {
      console.warn(`Default role not found for user ${user.email}`);
    }
  }

  await mongoose.disconnect();
  console.log(`Done. Fixed ${fixedCount} users.`);
}

fixUserRoles().catch(err => {
  console.error('Error fixing user roles:', err);
  mongoose.disconnect();
}); 