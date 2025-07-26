const CodingProblem = require('../models/CodingProblem');
const CodingSubmission = require('../models/CodingSubmission');

// Create a new coding problem (Coordinator)
exports.createProblem = async (req, res) => {
  try {
    const problem = new CodingProblem({ ...req.body, createdBy: req.user.id });
    await problem.save();
    res.status(201).json(problem);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all problems for an event (Coordinator/Participant)
exports.getProblemsByEvent = async (req, res) => {
  try {
    const problems = await CodingProblem.find({ eventId: req.params.eventId });
    res.json(problems);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Submit code for a problem (Participant)
exports.submitCode = async (req, res) => {
  try {
    const submission = new CodingSubmission({
      ...req.body,
      participantId: req.user.id,
      submittedAt: new Date()
    });
    await submission.save();
    res.status(201).json(submission);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Update a coding problem
exports.updateProblem = async (req, res) => {
  try {
    const updated = await CodingProblem.findByIdAndUpdate(
      req.params.problemId,
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: 'Problem not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete a coding problem
exports.deleteProblem = async (req, res) => {
  try {
    const deleted = await CodingProblem.findByIdAndDelete(req.params.problemId);
    if (!deleted) return res.status(404).json({ error: 'Problem not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all submissions for an event (or for a problem)
exports.getSubmissionsByEvent = async (req, res) => {
  try {
    const { eventId, problemId } = req.query;
    const filter = {};
    if (eventId) filter.eventId = eventId;
    if (problemId) filter.problemId = problemId;
    // Join with user and problem for display
    const submissions = await CodingSubmission.find(filter)
      .populate('participantId', 'name email')
      .populate('problemId', 'title');
    res.json(submissions);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};