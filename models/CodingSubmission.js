const mongoose = require('mongoose');

const codingSubmissionSchema = new mongoose.Schema({
  problemId: { type: mongoose.Schema.Types.ObjectId, ref: 'CodingProblem', required: true },
  participantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  code: { type: String, required: true },
  language: { type: String, required: true }, // e.g., 'python', 'cpp'
  result: { type: String, enum: ['Pending', 'Passed', 'Failed'], default: 'Pending' },
  score: { type: Number, default: 0 },
  feedback: String,
  testCaseResults: [{
    input: String,
    expectedOutput: String,
    actualOutput: String,
    passed: Boolean
  }],
  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CodingSubmission', codingSubmissionSchema);