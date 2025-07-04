const mongoose = require('mongoose');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const initializeRolesAndPermissions = require('../config/initializeRolesAndPermissions');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/event_management', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(async () => {
    console.log('Connected to MongoDB');
    
    try {
        // Drop existing users, roles and permissions
        await require('../models/User').deleteMany({});
        await Role.deleteMany({});
        await Permission.deleteMany({});
        console.log('Dropped existing users, roles and permissions');
        
        // Initialize new roles and permissions
        await initializeRolesAndPermissions();
        console.log('Successfully reinitialized roles and permissions');
        
        process.exit(0);
    } catch (error) {
        console.error('Error reinitializing roles and permissions:', error);
        process.exit(1);
    }
})
.catch(error => {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
}); 