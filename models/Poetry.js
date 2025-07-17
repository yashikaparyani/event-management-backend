const mongoose = require('mongoose');

const poetrySchema = new mongoose.Schema({
  event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  poetName: { type: String, required: true },
  title: { type: String, required: true },
  text: { type: String },
  fileUrl: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Poetry', poetrySchema); 