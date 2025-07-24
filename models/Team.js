const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  debate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Debate',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  side: {
    type: String,
    enum: ['for', 'against'],
    required: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Team', teamSchema); 