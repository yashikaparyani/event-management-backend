const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    date: {
        type: Date,
        required: true
    },
    time: {
        type: String // e.g., "14:30"
    },
    location: {
        type: String,
        required: true,
        trim: true
    },
    capacity: {
        type: Number,
        default: 0,
        min: 0
    },
    organizer: {
        type: String,
        trim: true
    },
    coordinator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    price: {
        type: Number,
        default: 0,
        min: 0
    },
    imageUrl: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        enum: ['Quiz', 'Debate', 'Poetry', 'CodecRaze'],
        required: true
    },
    assignedCoordinators: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    registeredParticipants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    registeredUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    qrCode: {
        type: String,
        trim: true
    },
    // Debate-specific fields
    topic: {
        type: String,
        trim: true
    },
    rules: {
        type: String,
        trim: true
    },
    timerPerParticipant: {
        type: Number,
        min: 30,
        max: 600
    }
});

// Update the updatedAt timestamp before saving
eventSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Event', eventSchema);