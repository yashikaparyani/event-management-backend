const mongoose = require('mongoose');

const testCaseSchema = new mongoose.Schema({
  input: { type: String, required: true },
  output: { type: String, required: true },
  isSample: { type: Boolean, default: false }
});

const codecRazeProblemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
  points: { type: Number, required: true },
  allowedLanguages: [{ type: String }], // e.g., ['python', 'cpp', 'javascript']
  testCases: [testCaseSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

codecRazeProblemSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('CodecRazeProblem', codecRazeProblemSchema); 