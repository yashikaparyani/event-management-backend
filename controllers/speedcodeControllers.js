const CodingProblem = require('../models/CodingProblem');
const CodingSubmission = require('../models/CodingSubmission');
const { Parser } = require('json2csv'); // Top of file, add this import

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
// Get a single coding problem by its ID
exports.getProblemById = async (req, res) => {
  try {
    const problem = await CodingProblem.findById(req.params.problemId);
    if (!problem) return res.status(404).json({ error: 'Problem not found' });
    res.json(problem);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
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
// Get event controls
exports.getEventControls = async (req, res) => {
  const Event = require('../models/Event'); // adjust path if needed
  const event = await Event.findById(req.params.eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  res.json({
      isActive: event.isActive,
      submissionsLocked: event.submissionsLocked,
      leaderboardVisible: event.leaderboardVisible
  });
};

// Update event controls
exports.updateEventControls = async (req, res) => {
  const Event = require('../models/Event'); // adjust path if needed
  const event = await Event.findById(req.params.eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (typeof req.body.isActive === 'boolean') event.isActive = req.body.isActive;
  if (typeof req.body.submissionsLocked === 'boolean') event.submissionsLocked = req.body.submissionsLocked;
  if (typeof req.body.leaderboardVisible === 'boolean') event.leaderboardVisible = req.body.leaderboardVisible;
  await event.save();
  res.json({
      isActive: event.isActive,
      submissionsLocked: event.submissionsLocked,
      leaderboardVisible: event.leaderboardVisible
  });
};


// Export submissions as CSV or JSON
exports.exportSubmissions = async (req, res) => {
    const CodingSubmission = require('../models/CodingSubmission');
    const eventId = req.query.eventId;
    const format = req.query.format || 'json'; // 'csv' or 'json'
    if (!eventId) return res.status(400).json({ error: 'eventId required' });

    const submissions = await CodingSubmission.find({ eventId })
        .populate('participantId', 'name email')
        .populate('problemId', 'title')
        .lean();

    if (format === 'csv') {
        const fields = [
            { label: 'Participant Name', value: 'participantId.name' },
            { label: 'Participant Email', value: 'participantId.email' },
            { label: 'Problem Title', value: 'problemId.title' },
            { label: 'Result', value: 'result' },
            { label: 'Score', value: 'score' },
            { label: 'Submitted At', value: row => new Date(row.submittedAt).toLocaleString() }
        ];
        const parser = new Parser({ fields });
        const csv = parser.parse(submissions);
        res.header('Content-Type', 'text/csv');
        res.attachment('submissions.csv');
        return res.send(csv);
    } else {
        return res.json(submissions);
    }
};
// Analytics for SpeedCode event
exports.getAnalytics = async (req, res) => {
  const CodingSubmission = require('../models/CodingSubmission');
  const CodingProblem = require('../models/CodingProblem');
  const eventId = req.query.eventId;
  if (!eventId) return res.status(400).json({ error: 'eventId required' });

  // Number of participants
  const participants = await CodingSubmission.distinct('participantId', { eventId });

  // Problems and attempts
  const problems = await CodingProblem.find({ eventId }).lean();
  const submissions = await CodingSubmission.find({ eventId }).lean();

  const problemStats = problems.map(problem => {
      const attempts = submissions.filter(s => String(s.problemId) === String(problem._id));
      const correct = attempts.filter(s => s.result === 'Accepted');
      const fastest = correct.length
          ? correct.reduce((a, b) => (a.submittedAt < b.submittedAt ? a : b))
          : null;
      return {
          title: problem.title,
          problemId: problem._id,
          attempts: attempts.length,
          solved: correct.length,
          fastest: fastest
              ? { participantId: fastest.participantId, submittedAt: fastest.submittedAt }
              : null
      };
  });

  // Most/least solved
  const mostSolved = problemStats.reduce((a, b) => (a.solved > b.solved ? a : b), problemStats[0]);
  const leastSolved = problemStats.reduce((a, b) => (a.solved < b.solved ? a : b), problemStats[0]);

  res.json({
      participantCount: participants.length,
      problemStats,
      mostSolved: mostSolved ? mostSolved.title : null,
      leastSolved: leastSolved ? leastSolved.title : null
  });
};
// Manual override of a submission's result/score
exports.overrideSubmission = async (req, res) => {
  const { submissionId } = req.params;
  const { result, score } = req.body;
  const CodingSubmission = require('../models/CodingSubmission');
  const sub = await CodingSubmission.findById(submissionId);
  if (!sub) return res.status(404).json({ error: 'Submission not found' });
  if (result) sub.result = result;
  if (typeof score === 'number') sub.score = score;
  await sub.save();
  res.json({ success: true, submission: sub });
};

// Rejudge all submissions for a problem (dummy implementation)
exports.rejudgeProblem = async (req, res) => {
  const { problemId } = req.params;
  const CodingSubmission = require('../models/CodingSubmission');
  // In a real system, you'd re-run the judge for each submission.
  // Here, we'll just set result to "Pending" for all.
  await CodingSubmission.updateMany({ problemId }, { $set: { result: 'Pending', score: 0 } });
  res.json({ success: true });
};