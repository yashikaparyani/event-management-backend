const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['event', 'user', 'system', 'content'],
    required: true
  }
});

module.exports = mongoose.model('Permission', permissionSchema); 