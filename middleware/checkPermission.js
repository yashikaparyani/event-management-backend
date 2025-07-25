const User = require('../models/User');
const Role = require('../models/Role');

const checkPermission = (requiredAction) => {
  return async (req, res, next) => {
    try {
      // User should already be populated with role and permissions from authMiddleware
      const user = req.user;

      if (!user || !user.role) {
        return res.status(403).json({ message: 'User role not found' });
      }

      const roleName = user.role.name;
      const status = user.status;

      // Permission matrix logic
      switch (requiredAction) {
        case 'view':
          // All roles can view
          return next();
        case 'register':
        case 'comment':
          if (roleName === 'volunteer') {
            return res.status(403).json({ message: 'Volunteers cannot register or comment.' });
          }
          return next();
        case 'create_event':
        case 'edit_event':
          if (roleName === 'admin') return next();
          if (roleName === 'coordinator' && status === 'approved') return next();
          return res.status(403).json({ message: 'Only approved coordinators or admins can create/edit events.' });
        case 'approve':
        case 'delete':
        case 'admin_panel':
          if (roleName === 'admin') return next();
          return res.status(403).json({ message: 'Only admin can perform this action.' });
        default:
          // Fallback: check custom/role permissions for extensibility
          let hasPermission = false;
          if (user.customPermissions && Array.isArray(user.customPermissions)) {
            hasPermission = user.customPermissions.some(p => p.name === requiredAction);
          }
          if (!hasPermission && user.role.permissions && Array.isArray(user.role.permissions)) {
            // If permissions are objects with a name property
            hasPermission = user.role.permissions.some(p => p.name === requiredAction);
            // If permissions are ObjectIDs but user is coordinator and requiredAction is 'coordinator', allow
            if (!hasPermission && typeof user.role.permissions[0] === 'string' && requiredAction === 'coordinator' && roleName === 'coordinator') {
              hasPermission = true;
            }
          }
          if (!hasPermission) {
            return res.status(403).json({ message: 'Permission denied.' });
          }
          return next();
      }
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  };
};

module.exports = checkPermission; 