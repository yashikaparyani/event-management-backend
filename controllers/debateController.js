const Debate = require('../models/Debate');
const Team = require('../models/Team');
const DebateSession = require('../models/DebateSession');
const Event = require('../models/Event');
const User = require('../models/User');

// Create a new debate event (admin/coordinator)
exports.createDebate = async (req, res) => {
  try {
    const { eventId, topics, rules } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    // Only allow debate type events
    if (event.type !== 'Debate') return res.status(400).json({ message: 'Not a debate event' });
    // Coordinator is the event's coordinator
    const debate = new Debate({
      event: eventId,
      topics,
      rules,
      coordinator: event.coordinator
    });
    await debate.save();
    res.status(201).json({ message: 'Debate created', debate });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get debate details
exports.getDebate = async (req, res) => {
  try {
    const debate = await Debate.findById(req.params.id)
      .populate('event')
      .populate('coordinator', 'name email')
      .populate({ path: 'teams', populate: { path: 'members', select: 'name email' } })
      .populate('audience', 'name email');
    if (!debate) return res.status(404).json({ message: 'Debate not found' });
    res.status(200).json(debate);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Register a team (participant)
exports.registerTeam = async (req, res) => {
  try {
    const { debateId } = req.params;
    const { name, memberIds } = req.body;
    const debate = await Debate.findById(debateId);
    if (!debate) return res.status(404).json({ message: 'Debate not found' });
    // Create team
    const team = new Team({ debate: debateId, name, members: memberIds });
    await team.save();
    debate.teams.push(team._id);
    await debate.save();
    res.status(201).json({ message: 'Team registered', team });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Register as audience
exports.registerAudience = async (req, res) => {
  try {
    const { debateId } = req.params;
    const userId = req.user.id;
    const debate = await Debate.findById(debateId);
    if (!debate) return res.status(404).json({ message: 'Debate not found' });
    if (!debate.audience.includes(userId)) {
      debate.audience.push(userId);
      await debate.save();
    }
    res.status(200).json({ message: 'Registered as audience' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Start debate session (coordinator)
exports.startSession = async (req, res) => {
  try {
    const { debateId } = req.params;
    const debate = await Debate.findById(debateId);
    if (!debate) return res.status(404).json({ message: 'Debate not found' });
    // Only coordinator can start
    if (req.user.role.name !== 'coordinator' || req.user._id.toString() !== debate.coordinator.toString()) {
      return res.status(403).json({ message: 'Only coordinator can start the debate' });
    }
    let session = await DebateSession.findOne({ debate: debateId, status: { $in: ['waiting', 'active'] } });
    if (!session) {
      session = new DebateSession({ debate: debateId, status: 'active', startedAt: new Date() });
      await session.save();
    } else {
      session.status = 'active';
      session.startedAt = new Date();
      await session.save();
    }
    debate.status = 'active';
    await debate.save();
    res.status(200).json({ message: 'Debate session started', session });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// End debate session (coordinator)
exports.endSession = async (req, res) => {
  try {
    const { debateId } = req.params;
    const debate = await Debate.findById(debateId);
    if (!debate) return res.status(404).json({ message: 'Debate not found' });
    if (req.user.role.name !== 'coordinator' || req.user._id.toString() !== debate.coordinator.toString()) {
      return res.status(403).json({ message: 'Only coordinator can end the debate' });
    }
    const session = await DebateSession.findOne({ debate: debateId, status: 'active' });
    if (!session) return res.status(404).json({ message: 'No active session' });
    session.status = 'finished';
    session.endedAt = new Date();
    await session.save();
    debate.status = 'finished';
    await debate.save();
    res.status(200).json({ message: 'Debate session ended', session });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Move to next speaker (coordinator)
exports.nextSpeaker = async (req, res) => {
  try {
    const { debateId } = req.params;
    const { nextSpeakerId } = req.body;
    const session = await DebateSession.findOne({ debate: debateId, status: 'active' });
    if (!session) return res.status(404).json({ message: 'No active session' });
    session.currentSpeaker = nextSpeakerId;
    await session.save();
    res.status(200).json({ message: 'Speaker updated', session });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Assign score to team (coordinator)
exports.assignScore = async (req, res) => {
  try {
    const { debateId } = req.params;
    const { teamId, points } = req.body;
    const session = await DebateSession.findOne({ debate: debateId, status: 'active' });
    if (!session) return res.status(404).json({ message: 'No active session' });
    let score = session.scores.find(s => s.team.toString() === teamId);
    if (!score) {
      session.scores.push({ team: teamId, points });
    } else {
      score.points += points;
    }
    await session.save();
    res.status(200).json({ message: 'Score updated', session });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get current session state
exports.getSession = async (req, res) => {
  try {
    const { debateId } = req.params;
    const session = await DebateSession.findOne({ debate: debateId }).populate('currentSpeaker', 'name').populate({ path: 'scores.team', select: 'name' });
    if (!session) return res.status(404).json({ message: 'No session found' });
    res.status(200).json(session);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
}; 