const Debate = require('../models/Debate');
const Team = require('../models/Team');
const DebateSession = require('../models/DebateSession');
const Event = require('../models/Event');
const User = require('../models/User');

// Create a new debate event (admin/coordinator)
exports.createDebate = async (req, res) => {
  try {
    const { eventId, topics, rules, timerPerParticipant } = req.body;
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    // Only allow debate type events
    if (event.type !== 'Debate') return res.status(400).json({ message: 'Not a debate event' });
    // Coordinator is the event's coordinator
    const debate = new Debate({
      event: eventId,
      topics,
      rules,
      coordinator: event.coordinator,
      timerPerParticipant
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

// Get debate by event ID
exports.getDebateByEvent = async (req, res) => {
  try {
    const debate = await Debate.findOne({ event: req.params.eventId })
      .populate('event')
      .populate('coordinator', 'name email')
      .populate({ path: 'teams', populate: { path: 'members', select: 'name email' } })
      .populate('audience', 'name email');
      
    if (!debate) {
      return res.status(404).json({ 
        success: false,
        message: 'No debate found for this event' 
      });
    }
    
    res.status(200).json({
      success: true,
      data: debate
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error.message 
    });
  }
};

// Get session by event ID
exports.getSessionByEvent = async (req, res) => {
  try {
    const debate = await Debate.findOne({ event: req.params.eventId });
    
    if (!debate) {
      return res.status(404).json({
        success: false,
        message: 'No debate found for this event'
      });
    }
    
    const session = await DebateSession.findOne({ 
      debate: debate._id,
      status: 'active'
    }).populate('currentSpeaker', 'name email');
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'No active session found for this debate'
      });
    }
    
    res.status(200).json({
      success: true,
      data: session
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Get leaderboard for a debate
exports.getLeaderboard = async (req, res) => {
  try {
    const { debateId } = req.params;
    
    const session = await DebateSession.findOne({ debate: debateId })
      .populate({
        path: 'scores.team',
        select: 'name side',
        populate: {
          path: 'members',
          select: 'name email'
        }
      })
      .sort({ 'scores.total': -1 });
      
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'No session found for this debate'
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        scores: session.scores,
        updatedAt: session.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Update debate status
exports.updateDebateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { debateId } = req.params;
    
    if (!['upcoming', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: upcoming, in_progress, completed, cancelled'
      });
    }
    
    const debate = await Debate.findByIdAndUpdate(
      debateId,
      { status },
      { new: true, runValidators: true }
    );
    
    if (!debate) {
      return res.status(404).json({
        success: false,
        message: 'Debate not found'
      });
    }
    
    // Emit status update event
    if (req.io) {
      req.io.to(`debate_${debateId}`).emit('debate-status-updated', {
        status,
        updatedAt: new Date()
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Debate status updated successfully',
      data: debate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

// Register participant for debate
exports.registerParticipant = async (req, res) => {
  try {
    const { debateId } = req.params;
    const { userId, side } = req.body;

    // Input validation
    if (!['for', 'against'].includes(side)) {
      return res.status(400).json({ message: 'Invalid side. Must be "for" or "against"' });
    }

    // Find debate and user
    const debate = await Debate.findById(debateId);
    const user = await User.findById(userId);
    
    if (!debate || !user) {
      return res.status(404).json({ message: 'Debate or user not found' });
    }

    // Check if debate is active
    if (debate.status !== 'active') {
      return res.status(400).json({ message: 'Debate is not active' });
    }

    // Find or create team
    let team = await Team.findOne({ 
      debate: debateId, 
      side: side 
    });

    if (!team) {
      team = new Team({
        name: `${side.charAt(0).toUpperCase() + side.slice(1)} Team`,
        debate: debateId,
        side: side,
        members: [userId]
      });
    } else if (!team.members.includes(userId)) {
      team.members.push(userId);
    }

    await team.save();

    // Add team to debate if not already added
    if (!debate.teams.includes(team._id)) {
      debate.teams.push(team._id);
      await debate.save();
    }

    // Add user to audience if not already added
    if (!debate.audience.includes(userId)) {
      debate.audience.push(userId);
      await debate.save();
    }

    // Find or create session
    let session = await DebateSession.findOne({ debate: debateId });
    if (!session) {
      session = new DebateSession({
        debate: debateId,
        status: 'waiting'
      });
      await session.save();
    }

    res.status(200).json({ 
      message: 'Successfully registered for debate',
      team: team._id,
      side: side,
      debateStatus: debate.status
    });

  } catch (error) {
    console.error('Error registering participant:', error);
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
    const { motion, rules, timerPerParticipant } = req.body;
    
    // Validate input
    if (!motion || !rules) {
      return res.status(400).json({ 
        success: false,
        message: 'Motion and rules are required' 
      });
    }

    // Find the debate
    const debate = await Debate.findById(debateId)
      .populate('teams')
      .populate('participants', 'name email');
    
    if (!debate) {
      return res.status(404).json({ 
        success: false,
        message: 'Debate not found' 
      });
    }

    // Check if there's an active session
    const activeSession = await DebateSession.findOne({
      debate: debateId,
      status: 'active'
    });

    if (activeSession) {
      return res.status(400).json({ 
        success: false,
        message: 'A session is already active for this debate' 
      });
    }

    // Get all participants
    const participants = [];
    for (const team of debate.teams) {
      const teamWithMembers = await Team.findById(team._id).populate('members');
      participants.push(...teamWithMembers.members);
    }

    // Create new session with initial data
    const session = new DebateSession({
      debate: debateId,
      status: 'active',
      motion: motion,
      rules: rules,
      timerPerParticipant: timerPerParticipant || 120, // Default 2 minutes
      currentSpeaker: null,
      startTime: new Date(),
      speakingOrder: [],
      scores: []
    });

    await session.save();

    // Update debate with session reference
    debate.currentSession = session._id;
    debate.status = 'in_progress';
    await debate.save();

    // Emit event to all connected clients
    if (req.io) {
      req.io.to(`debate_${debateId}`).emit('debate-started', {
        success: true,
        eventId: debate.event,
        debateId: debate._id,
        sessionId: session._id,
        motion: session.motion,
        rules: session.rules,
        startTime: session.startTime,
        participants: participants.map(p => ({
          id: p._id,
          name: p.name,
          email: p.email
        }))
      });
    }

    res.status(201).json({
      success: true,
      message: 'Debate session started successfully',
      session: {
        id: session._id,
        motion: session.motion,
        rules: session.rules,
        startTime: session.startTime,
        timerPerParticipant: session.timerPerParticipant
      }
    });

  } catch (error) {
    console.error('Error starting debate session:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to start debate session',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
    const { teamId, clarity, facts, arguments, presentation, knowledge } = req.body;
    const session = await DebateSession.findOne({ debate: debateId, status: 'active' });
    if (!session) return res.status(404).json({ message: 'No active session' });
    
    const totalScore = clarity + facts + arguments + presentation + knowledge;
    
    let score = session.scores.find(s => s.team.toString() === teamId);
    if (!score) {
      session.scores.push({
        team: teamId,
        points: totalScore,
        criteria: {
          clarity,
          facts,
          arguments,
          presentation,
          knowledge
        }
      });
    } else {
      score.points += totalScore;
      score.criteria = {
        clarity: (score.criteria?.clarity || 0) + clarity,
        facts: (score.criteria?.facts || 0) + facts,
        arguments: (score.criteria?.arguments || 0) + arguments,
        presentation: (score.criteria?.presentation || 0) + presentation,
        knowledge: (score.criteria?.knowledge || 0) + knowledge
      };
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
    const session = await DebateSession.findOne({ debate: debateId })
      .populate('currentSpeaker', 'name')
      .populate({ 
        path: 'scores.team', 
        select: 'name',
        populate: { path: 'members', select: 'name email' }
      });
    if (!session) return res.status(404).json({ message: 'No session found' });
    res.status(200).json(session);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Participant flow - Get debate details for participant
exports.getParticipantDebate = async (req, res) => {
  try {
    const { debateId } = req.params;
    const debate = await Debate.findById(debateId)
      .populate('event')
      .populate('coordinator', 'name email')
      .populate({ 
        path: 'teams', 
        populate: { path: 'members', select: 'name email' }
      });
    
    if (!debate) return res.status(404).json({ message: 'Debate not found' });
    
    const session = await DebateSession.findOne({ debate: debateId })
      .populate('currentSpeaker', 'name')
      .populate({ path: 'scores.team', select: 'name' });
    
    res.status(200).json({ debate, session });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Audience flow - Get debate details for audience
exports.getAudienceDebate = async (req, res) => {
  try {
    const { debateId } = req.params;
    const debate = await Debate.findById(debateId)
      .populate('event')
      .populate('coordinator', 'name email')
      .populate({ 
        path: 'teams', 
        populate: { path: 'members', select: 'name email' }
      });
    
    if (!debate) return res.status(404).json({ message: 'Debate not found' });
    
    const session = await DebateSession.findOne({ debate: debateId })
      .populate('currentSpeaker', 'name')
      .populate({ path: 'scores.team', select: 'name' });
    
    res.status(200).json({ debate, session });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};