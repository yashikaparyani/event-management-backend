const User = require('../models/User');
const Event = require('../models/Event'); // Assuming you have an Event model
// const Registration = require('../models/Registration'); // Assuming you have a Registration model

exports.getDashboardStats = async (req, res) => {
    try {
        console.log('Fetching dashboard stats...');

        // Get total users count
        const totalUsers = await User.countDocuments();
        console.log('Total users:', totalUsers);
        
        // Get pending approvals count with proper role population
        const pendingUsers = await User.find({ status: 'pending' })
            .populate('role')
            .where('role.name').in(['coordinator', 'volunteer']);
        const pendingApprovals = pendingUsers.length;
        console.log('Pending approvals:', pendingApprovals);
        
        // Get total events count
        const totalEvents = await Event.countDocuments();
        console.log('Total events:', totalEvents);
        
        // Get total registrations
        const events = await Event.find({}, 'registeredUsers');
        const totalRegistrations = events.reduce((sum, event) => sum + (event.registeredUsers?.length || 0), 0);
        console.log('Total registrations:', totalRegistrations);

        const stats = {
            totalUsers,
            pendingApprovals,
            totalEvents,
            totalRegistrations
        };

        console.log('Dashboard stats:', stats);
        res.json(stats);
    } catch (error) {
        console.error('Error fetching dashboard stats:', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            message: 'Error fetching dashboard statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}; 