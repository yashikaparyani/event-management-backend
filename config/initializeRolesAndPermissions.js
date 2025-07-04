const Role = require('../models/Role');
const Permission = require('../models/Permission');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

const defaultPermissions = [
  { name: 'manage_events', description: 'Can create, edit, and delete events', category: 'event' },
  { name: 'manage_users', description: 'Can create, edit, and delete users', category: 'user' },
  { name: 'assign_volunteers', description: 'Can assign volunteers to events', category: 'event' },
  { name: 'register_event', description: 'Can register for events', category: 'event' },
  { name: 'view_reports', description: 'Can view reports', category: 'system' },
  { name: 'view_content', description: 'Can view event content', category: 'content' },
  { name: 'view_roles', description: 'Can view roles and permissions', category: 'system' },
  { name: 'manage_roles', description: 'Can manage roles and permissions', category: 'system' },
  { name: 'edit_user', description: 'Can edit users', category: 'user' },
  { name: 'delete_user', description: 'Can delete users', category: 'user' },
  { name: 'create_user', description: 'Can create users', category: 'user' },
];

const defaultRoles = [
  {
    name: 'admin',
    description: 'Administrator with full access',
    permissions: ['manage_events', 'manage_users', 'assign_volunteers', 'register_event', 'view_reports', 'view_content', 'view_roles', 'manage_roles', 'edit_user', 'delete_user', 'create_user'],
    isDefault: false
  },
  {
    name: 'coordinator',
    description: 'Event coordinator with event management access',
    permissions: ['manage_events', 'assign_volunteers', 'register_event', 'view_reports', 'view_content'],
    isDefault: false
  },
  {
    name: 'participant',
    description: 'Event participant',
    permissions: ['register_event', 'view_content'],
    isDefault: false
  },
  {
    name: 'volunteer',
    description: 'Event volunteer',
    permissions: ['register_event', 'view_content'],
    isDefault: false
  },
  {
    name: 'audience',
    description: 'General audience',
    permissions: ['register_event', 'view_content'],
    isDefault: true
  }
];

async function initializeRolesAndPermissions() {
  try {
    // Create all permissions first
    for (const permission of defaultPermissions) {
      await Permission.findOneAndUpdate(
        { name: permission.name },
        permission,
        { upsert: true, new: true }
      );
    }
    console.log('All permissions created/updated');

    // Get all permissions
    const allPermissions = await Permission.find({});
    const permissionMap = allPermissions.reduce((map, permission) => {
      map[permission.name] = permission._id;
      return map;
    }, {});

    // Create/update all roles
    for (const role of defaultRoles) {
      const roleData = {
        name: role.name,
        description: role.description,
        permissions: role.permissions.map(permName => permissionMap[permName]),
        isDefault: role.isDefault
      };

      await Role.findOneAndUpdate(
        { name: role.name },
        roleData,
        { upsert: true, new: true }
      );
    }
    console.log('All roles created/updated');

    // Create default admin user if not exists
    const adminEmail = 'admin@example.com';
    const adminPassword = 'Admin123';
    const adminName = 'Admin';
    const adminRole = await Role.findOne({ name: 'admin' });
    if (!adminRole) {
      throw new Error('Admin role not found');
    }
    let adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      adminUser = new User({
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: adminRole._id,
        status: 'approved'
      });
      await adminUser.save();
      console.log('Default admin user created:', adminEmail);
    } else {
      console.log('Default admin user already exists:', adminEmail);
    }

    console.log('Roles and permissions initialization completed');
  } catch (error) {
    console.error('Error initializing roles and permissions:', error);
    throw error;
  }
}

module.exports = initializeRolesAndPermissions; 