const mongoose = require('mongoose');
const Role = require('../models/Role');
const Permission = require('../models/Permission');

// MongoDB Atlas connection string
const MONGODB_URI = 'mongodb+srv://yashikaparyani29:ILoveCoffee%40123@cluster0.qiegjte.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const defaultPermissions = [
  { name: 'create_event', description: 'Can create new events', category: 'event' },
  { name: 'edit_event', description: 'Can edit events', category: 'event' },
  { name: 'delete_event', description: 'Can delete events', category: 'event' },
  { name: 'view_event', description: 'Can view events', category: 'event' },
  { name: 'create_user', description: 'Can create users', category: 'user' },
  { name: 'edit_user', description: 'Can edit users', category: 'user' },
  { name: 'delete_user', description: 'Can delete users', category: 'user' },
  { name: 'view_user', description: 'Can view users', category: 'user' },
  { name: 'manage_roles', description: 'Can manage roles and permissions', category: 'system' },
  { name: 'view_logs', description: 'Can view system logs', category: 'system' },
  { name: 'create_content', description: 'Can create content', category: 'content' },
  { name: 'edit_content', description: 'Can edit content', category: 'content' },
  { name: 'delete_content', description: 'Can delete content', category: 'content' },
  { name: 'view_content', description: 'Can view content', category: 'content' }
];

const defaultRoles = [
  {
    name: 'admin',
    description: 'Administrator with full access',
    permissions: ['create_event', 'edit_event', 'delete_event', 'view_event',
                 'create_user', 'edit_user', 'delete_user', 'view_user',
                 'manage_roles', 'view_logs',
                 'create_content', 'edit_content', 'delete_content', 'view_content'],
    isDefault: false
  },
  {
    name: 'coordinator',
    description: 'Event coordinator with event management access',
    permissions: ['create_event', 'edit_event', 'view_event',
                 'view_user',
                 'create_content', 'edit_content', 'view_content'],
    isDefault: false
  },
  {
    name: 'participant',
    description: 'Event participant',
    permissions: ['view_event', 'view_content'],
    isDefault: false
  },
  {
    name: 'volunteer',
    description: 'Event volunteer',
    permissions: ['view_event', 'view_content'],
    isDefault: false
  },
  {
    name: 'audience',
    description: 'General audience',
    permissions: ['view_event', 'view_content'],
    isDefault: true
  }
];

async function initializeRolesAndPermissions() {
  try {
    // Connect to MongoDB Atlas
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB Atlas');

    // Clear existing roles and permissions (optional - remove if you want to keep existing)
    await Role.deleteMany({});
    await Permission.deleteMany({});
    console.log('Cleared existing roles and permissions');

    // Create permissions
    const createdPermissions = await Permission.insertMany(defaultPermissions);
    console.log('Created permissions:', createdPermissions.length);

    const permissionMap = createdPermissions.reduce((map, permission) => {
      map[permission.name] = permission._id;
      return map;
    }, {});

    // Create roles with permission references
    const rolesWithPermissions = defaultRoles.map(role => ({
      ...role,
      permissions: role.permissions.map(permName => permissionMap[permName])
    }));

    const createdRoles = await Role.insertMany(rolesWithPermissions);
    console.log('Created roles:', createdRoles.length);

    // Display created roles
    console.log('\nCreated Roles:');
    createdRoles.forEach(role => {
      console.log(`- ${role.name}: ${role.description}`);
    });

    console.log('\nRoles and permissions initialized successfully!');
  } catch (error) {
    console.error('Error initializing roles and permissions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the initialization
initializeRolesAndPermissions(); 