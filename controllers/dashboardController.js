const User = require('../models/User');
const Event = require('../models/Event');
const Config = require('../models/Config');

exports.getDashboardStats = async (req, res) => {
    try {
        // Get total users count
        const totalUsers = await User.countDocuments();
        // Get pending approvals count (coordinator, volunteer)
        const pendingUsers = await User.find({ status: 'pending' })
            .populate('role')
            .where('role.name').in(['coordinator', 'volunteer']);
        const pendingApprovals = pendingUsers.length;
        // Get total events count
        const totalEvents = await Event.countDocuments();
        // Get total registrations
        const events = await Event.find({}, 'registeredUsers');
        const totalRegistrations = events.reduce((sum, event) => sum + (event.registeredUsers?.length || 0), 0);
        res.json({
            totalUsers,
            pendingApprovals,
            totalEvents,
            totalRegistrations
        });
    } catch (error) {
        res.status(500).json({ 
            message: 'Error fetching dashboard statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getAllowedPublicRoles = async (req, res) => {
    try {
        let config = await Config.findOne({ key: 'allowedPublicRoles' });
        if (!config) {
            config = { value: ['participant', 'audience'] };
        }
        res.json(config.value);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching allowed public roles', error: error.message });
    }
};

exports.updateAllowedPublicRoles = async (req, res) => {
    try {
        const { roles } = req.body;
        if (!Array.isArray(roles)) {
            return res.status(400).json({ message: 'Roles must be an array' });
        }
        let config = await Config.findOneAndUpdate(
            { key: 'allowedPublicRoles' },
            { value: roles },
            { new: true, upsert: true }
        );
        res.json(config.value);
    } catch (error) {
        res.status(500).json({ message: 'Error updating allowed public roles', error: error.message });
    }
}; 