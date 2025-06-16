// server/config/initializeRoles.js

const Role = require('../models/Role');
const Permission = require('../models/Permission');

const defaultPermissions = [
  // Event permissions
  { name: 'create_event', description: 'Can create new events', category: 'event' },
  { name: 'edit_event', description: 'Can edit events', category: 'event' },
  { name: 'delete_event', description: 'Can delete events', category: 'event' },
  { name: 'view_event', description: 'Can view events', category: 'event' },
  
  // User permissions
  { name: 'create_user', description: 'Can create users', category: 'user' },
  { name: 'edit_user', description: 'Can edit users', category: 'user' },
  { name: 'delete_user', description: 'Can delete users', category: 'user' },
  { name: 'view_user', description: 'Can view users', category: 'user' },
  
  // System permissions
  { name: 'manage_roles', description: 'Can manage roles and permissions', category: 'system' },
  { name: 'view_logs', description: 'Can view system logs', category: 'system' },
  
  // Content permissions
  { name: 'create_content', description: 'Can create content', category: 'content' },
  { name: 'edit_content', description: 'Can edit content', category: 'content' },
  { name: 'delete_content', description: 'Can delete content', category: 'content' }
];

const defaultRoles = [
  {
    name: 'admin',
    description: 'Administrator with full access',
    permissions: ['create_event', 'edit_event', 'delete_event', 'view_event',
                 'create_user', 'edit_user', 'delete_user', 'view_user',
                 'manage_roles', 'view_logs',
                 'create_content', 'edit_content', 'delete_content'],
    isDefault: false
  },
  {
    name: 'coordinator',
    description: 'Event coordinator with event management access',
    permissions: ['create_event', 'edit_event', 'view_event',
                 'view_user',
                 'create_content', 'edit_content'],
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
    // Create permissions
    const createdPermissions = await Permission.insertMany(defaultPermissions);
    const permissionMap = createdPermissions.reduce((map, permission) => {
      map[permission.name] = permission._id;
      return map;
    }, {});

    // Create roles with permission references
    const rolesWithPermissions = defaultRoles.map(role => ({
      ...role,
      permissions: role.permissions.map(permName => permissionMap[permName])
    }));

    await Role.insertMany(rolesWithPermissions);
    console.log('Roles and permissions initialized successfully');
  } catch (error) {
    console.error('Error initializing roles and permissions:', error);
  }
}

module.exports = initializeRolesAndPermissions; 