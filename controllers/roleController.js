const Role = require('../models/Role');
const Permission = require('../models/Permission');

// Get all roles
exports.getAllRoles = async (req, res) => {
  try {
    const roles = await Role.find().populate('permissions');
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching roles', error: error.message });
  }
};

// Get role by ID
exports.getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id).populate('permissions');
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    res.json(role);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching role', error: error.message });
  }
};

// Create new role
exports.createRole = async (req, res) => {
  try {
    const { name, description, permissions, isDefault } = req.body;
    
    // Check if role already exists
    const existingRole = await Role.findOne({ name });
    if (existingRole) {
      return res.status(400).json({ message: 'Role already exists' });
    }

    const role = new Role({
      name,
      description,
      permissions,
      isDefault
    });

    await role.save();
    res.status(201).json(role);
  } catch (error) {
    res.status(500).json({ message: 'Error creating role', error: error.message });
  }
};

// Update role
exports.updateRole = async (req, res) => {
  try {
    const { name, description, permissions, isDefault } = req.body;
    
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Update role fields
    if (name !== undefined) role.name = name;
    if (description !== undefined) role.description = description;
    
    // Ensure permissions is an array if provided
    if (permissions !== undefined) {
        if (!Array.isArray(permissions)) {
            return res.status(400).json({ message: 'Permissions must be an array' });
        }
        role.permissions = permissions; // Directly assign the array of IDs
    }
    
    if (isDefault !== undefined) role.isDefault = isDefault;

    await role.save();
    await role.populate('permissions');
    res.json(role);
  } catch (error) {
    res.status(500).json({ message: 'Error updating role', error: error.message });
  }
};

// Delete role
exports.deleteRole = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }

    // Check if role is default
    if (role.isDefault) {
      return res.status(400).json({ message: 'Cannot delete default role' });
    }

    await role.remove();
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting role', error: error.message });
  }
};

// Get all permissions
exports.getAllPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find();
    res.json(permissions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching permissions', error: error.message });
  }
}; 