const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema({
  team: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  points: {
    type: Number,
    default: 0
  }
});

const debateSessionSchema = new mongoose.Schema({
  debate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Debate',
    required: true
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'finished'],
    default: 'waiting'
  },
  currentRound: {
    type: Number,
    default: 1
  },
  currentSpeaker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  speakerQueue: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  scores: [scoreSchema],
  startedAt: {
    type: Date,
    default: null
  },
  endedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('DebateSession', debateSessionSchema); 