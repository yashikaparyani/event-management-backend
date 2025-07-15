const mongoose = require('mongoose');

const debateSessionSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    status: {
        type: String,
        enum: ['waiting', 'active', 'finished'],
        default: 'waiting'
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    audience: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    messages: [{
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { type: String, enum: ['coordinator', 'participant', 'audience'] },
        content: String,
        timestamp: { type: Date, default: Date.now }
    }],
    currentSpeaker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    speakerTimer: {
        type: Number, // seconds remaining
        default: 0
    },
    votes: [{
        voter: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        voteType: { type: String, enum: ['upvote', 'downvote', 'like', 'dislike', 'other'] },
        timestamp: { type: Date, default: Date.now }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

debateSessionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('DebateSession', debateSessionSchema); 