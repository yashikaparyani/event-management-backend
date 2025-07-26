const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema({
  input: String,
  output: String,
  isHidden: { type: Boolean, default: false }
});

const codingProblemSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  sampleInput: String,
  sampleOutput: String,
  testCases: [testCaseSchema],
  timeLimit: { type: Number, default: 1 }, // in seconds
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Easy' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('CodingProblem', codingProblemSchema);