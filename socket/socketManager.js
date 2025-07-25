const QuizSession = require('../models/QuizSession');
const Quiz = require('../models/Quiz');
const User = require('../models/User');
const Debate = require('../models/Debate');
const DebateSession = require('../models/DebateSession');
const Team = require('../models/Team');

class SocketManager {
    constructor(io) {
        this.io = io;
        this.activeSessions = new Map(); // quizId -> session data
        this.participantRooms = new Map(); // userId -> quizId
        this.setupSocketHandlers();
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('User connected:', socket.id);

            // Join quiz session
            socket.on('join-quiz', async (data) => {
                await this.handleJoinQuiz(socket, data);
            });

            // Submit answer
            socket.on('submit-answer', async (data) => {
                await this.handleSubmitAnswer(socket, data);
            });

            // Coordinator actions
            socket.on('start-quiz', async (data) => {
                await this.handleStartQuiz(socket, data);
            });

            socket.on('next-question', async (data) => {
                await this.handleNextQuestion(socket, data);
            });

            socket.on('show-leaderboard', async (data) => {
                await this.handleShowLeaderboard(socket, data);
            });

            // Debate events
            socket.on('join-debate', async (data) => {
                try {
                    const { eventId, userId } = data;
                    if (!eventId || !userId) {
                        throw new Error('Missing required fields');
                    }
                    
                    // Join the debate room
                    const roomName = `debate_${eventId}`;
                    await socket.join(roomName);
                    
                    console.log(`User ${userId} joined debate room ${eventId}`);
                    
                    // Send current state if available
                    const debate = await Debate.findOne({ event: eventId })
                        .populate('currentSession')
                        .populate('teams');
                        
                    if (debate && debate.currentSession) {
                        socket.emit('debate-state-update', {
                            status: 'active',
                            motion: debate.currentSession.motion,
                            rules: debate.currentSession.rules,
                            currentSpeaker: debate.currentSession.currentSpeaker,
                            timer: debate.currentSession.timerPerParticipant
                        });
                    }
                    
                } catch (error) {
                    console.error('Error joining debate:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            
            socket.on('start-debate', async (data) => {
                await this.handleStartDebate(socket, data);
            });
            
            socket.on('end-debate', async (data) => {
                try {
                    const { eventId, userId } = data;
                    if (!eventId || !userId) {
                        throw new Error('Missing required fields');
                    }
                    
                    // Verify user is coordinator
                    const debate = await Debate.findOne({ event: eventId });
                    if (!debate) {
                        throw new Error('Debate not found');
                    }
                    
                    if (debate.coordinator.toString() !== userId) {
                        throw new Error('Only the coordinator can end the debate');
                    }
                    
                    // Update debate status
                    debate.status = 'completed';
                    await debate.save();
                    
                    // Notify all participants
                    this.io.to(`debate_${eventId}`).emit('debate-ended', {
                        success: true,
                        message: 'The debate has ended',
                        endedAt: new Date()
                    });
                    
                } catch (error) {
                    console.error('Error ending debate:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            
            socket.on('next-speaker', async (data) => {
                try {
                    const { eventId, userId, nextSpeakerId } = data;
                    if (!eventId || !userId || !nextSpeakerId) {
                        throw new Error('Missing required fields');
                    }
                    
                    // Verify user is coordinator
                    const debate = await Debate.findOne({ event: eventId });
                    if (!debate || debate.coordinator.toString() !== userId) {
                        throw new Error('Only the coordinator can change speakers');
                    }
                    
                    // Update current speaker in session
                    const session = await DebateSession.findOneAndUpdate(
                        { debate: debate._id, status: 'active' },
                        { $set: { currentSpeaker: nextSpeakerId } },
                        { new: true }
                    );
                    
                    if (!session) {
                        throw new Error('No active session found');
                    }
                    
                    // Notify all participants
                    this.io.to(`debate_${eventId}`).emit('speaker-changed', {
                        speakerId: nextSpeakerId,
                        timeAllocated: session.timerPerParticipant || 120
                    });
                    
                    // Notify the next speaker directly
                    this.io.to(`user_${nextSpeakerId}`).emit('your-turn', {
                        timeLeft: session.timerPerParticipant || 120,
                        message: 'It\'s your turn to speak!'
                    });
                    
                } catch (error) {
                    console.error('Error changing speaker:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            
            socket.on('timer-update', async (data) => {
                try {
                    const { eventId, timeLeft } = data;
                    if (!eventId || timeLeft === undefined) {
                        throw new Error('Missing required fields');
                    }
                    
                    // Broadcast timer update to all participants
                    this.io.to(`debate_${eventId}`).emit('timer-updated', {
                        timeLeft: parseInt(timeLeft),
                        updatedAt: new Date()
                    });
                    
                } catch (error) {
                    console.error('Error updating timer:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            
            socket.on('audience-reaction', async (data) => {
                try {
                    const { eventId, userId, reaction } = data;
                    if (!eventId || !userId || !reaction) {
                        throw new Error('Missing required fields');
                    }
                    
                    // Get current speaker
                    const debate = await Debate.findOne({ event: eventId })
                        .populate('currentSession');
                        
                    if (!debate || !debate.currentSession) {
                        throw new Error('No active debate session');
                    }
                    
                    // Update reaction count
                    const updateField = reaction === 'like' ? 
                        'reactions.likes' : 'reactions.dislikes';
                        
                    await DebateSession.findByIdAndUpdate(
                        debate.currentSession._id,
                        { $addToSet: { [updateField]: userId } }
                    );
                    
                    // Broadcast updated reactions
                    const updatedSession = await DebateSession.findById(debate.currentSession._id);
                    this.io.to(`debate_${eventId}`).emit('reactions-updated', {
                        likes: updatedSession.reactions?.likes?.length || 0,
                        dislikes: updatedSession.reactions?.dislikes?.length || 0
                    });
                    
                } catch (error) {
                    console.error('Error processing reaction:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            
            socket.on('show-leaderboard', async (data) => {
                try {
                    const { eventId, userId } = data;
                    if (!eventId || !userId) {
                        throw new Error('Missing required fields');
                    }
                    
                    // Verify user is coordinator
                    const debate = await Debate.findOne({ event: eventId });
                    if (!debate || debate.coordinator.toString() !== userId) {
                        throw new Error('Only the coordinator can show the leaderboard');
                    }
                    
                    // Get scores
                    const session = await DebateSession.findOne({ debate: debate._id })
                        .populate('scores.team', 'name')
                        .sort({ 'scores.total': -1 });
                    
                    if (!session) {
                        throw new Error('No session data found');
                    }
                    
                    // Broadcast leaderboard to all participants
                    this.io.to(`debate_${eventId}`).emit('leaderboard-updated', {
                        scores: session.scores,
                        updatedAt: new Date()
                    });
                    
                } catch (error) {
                    console.error('Error showing leaderboard:', error);
                    socket.emit('error', { message: error.message });
                }
            });

            // Disconnect
            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
        });
    }

    async handleJoinQuiz(socket, data) {
        try {
            const { quizId, userId, eventId } = data;
            
            // Validate user and quiz
            const user = await User.findById(userId);
            const quiz = await Quiz.findById(quizId);
            
            if (!user || !quiz) {
                socket.emit('error', { message: 'Invalid user or quiz' });
                return;
            }

            // Get or create quiz session
            let session = await QuizSession.findOne({ 
                quiz: quizId, 
                event: eventId,
                status: { $in: ['waiting', 'active'] }
            });

            if (!session) {
                session = new QuizSession({
                    quiz: quizId,
                    event: eventId,
                    status: 'waiting'
                });
                await session.save();
            }

            // Add participant to session if not already present
            if (!session.participants.includes(userId)) {
                session.participants.push(userId);
                await session.save();
            }

            // Join socket room
            socket.join(`quiz-${quizId}`);
            this.participantRooms.set(socket.id, quizId);

            // Store session data
            this.activeSessions.set(quizId, {
                sessionId: session._id,
                currentQuestionIndex: session.currentQuestionIndex,
                status: session.status,
                participants: session.participants
            });

            // Send current quiz state to participant
            socket.emit('quiz-joined', {
                quizId: quizId,
                status: session.status,
                currentQuestion: session.currentQuestionIndex,
                totalQuestions: quiz.questions.length
            });

            // If quiz is active, send current question
            if (session.status === 'active' && session.currentQuestionIndex < quiz.questions.length) {
                const currentQuestion = quiz.questions[session.currentQuestionIndex];
                socket.emit('current-question', {
                    questionIndex: session.currentQuestionIndex,
                    question: currentQuestion.text,
                    options: currentQuestion.options,
                    timer: currentQuestion.timer
                });
            }

        } catch (error) {
            console.error('Error joining quiz:', error);
            socket.emit('error', { message: 'Failed to join quiz' });
        }
    }

    async handleSubmitAnswer(socket, data) {
        try {
            const { quizId, userId, questionIndex, selectedOption, timeTaken } = data;
            
            const session = await QuizSession.findOne({ quiz: quizId });
            if (!session) {
                socket.emit('error', { message: 'Quiz session not found' });
                return;
            }

            const quiz = await Quiz.findById(quizId);
            if (!quiz || questionIndex >= quiz.questions.length) {
                socket.emit('error', { message: 'Invalid question' });
                return;
            }

            const question = quiz.questions[questionIndex];
            const isCorrect = selectedOption === question.correctOption;

            // Save answer
            session.answers.push({
                participant: userId,
                questionIndex: questionIndex,
                selectedOption: selectedOption,
                isCorrect: isCorrect,
                timeTaken: timeTaken
            });
            await session.save();

            // Acknowledge answer submission
            socket.emit('answer-submitted', {
                questionIndex: questionIndex,
                isCorrect: isCorrect
            });

        } catch (error) {
            console.error('Error submitting answer:', error);
            socket.emit('error', { message: 'Failed to submit answer' });
        }
    }

    async handleStartQuiz(socket, data) {
        try {
            const { quizId, userId } = data;
            
            // Validate coordinator permissions
            const user = await User.findById(userId).populate('role');
            const quiz = await Quiz.findById(quizId);
            
            if (!user || !quiz || user.role.name !== 'coordinator') {
                socket.emit('error', { message: 'Unauthorized' });
                return;
            }

            const session = await QuizSession.findOne({ quiz: quizId });
            if (!session) {
                socket.emit('error', { message: 'Quiz session not found' });
                return;
            }

            // Update session status
            session.status = 'active';
            session.startedAt = new Date();
            session.currentQuestionIndex = 0;
            await session.save();

            // Update active sessions
            const activeSession = this.activeSessions.get(quizId);
            if (activeSession) {
                activeSession.status = 'active';
                activeSession.currentQuestionIndex = 0;
            }

            // Emit to all participants
            this.io.to(`quiz-${quizId}`).emit('quiz-started', {
                quizId: quizId,
                totalQuestions: quiz.questions.length
            });

            // Send first question
            if (quiz.questions.length > 0) {
                const firstQuestion = quiz.questions[0];
                this.io.to(`quiz-${quizId}`).emit('current-question', {
                    questionIndex: 0,
                    question: firstQuestion.text,
                    options: firstQuestion.options,
                    timer: firstQuestion.timer
                });
            }

        } catch (error) {
            console.error('Error starting quiz:', error);
            socket.emit('error', { message: 'Failed to start quiz' });
        }
    }

    async handleNextQuestion(socket, data) {
        try {
            const { quizId, userId } = data;
            
            const session = await QuizSession.findOne({ quiz: quizId });
            const quiz = await Quiz.findById(quizId);
            
            if (!session || !quiz) {
                socket.emit('error', { message: 'Quiz session not found' });
                return;
            }

            session.currentQuestionIndex++;
            
            if (session.currentQuestionIndex >= quiz.questions.length) {
                // Quiz finished
                session.status = 'finished';
                session.endedAt = new Date();
                await session.save();

                this.io.to(`quiz-${quizId}`).emit('quiz-finished', {
                    quizId: quizId
                });
            } else {
                // Next question
                await session.save();
                
                const nextQuestion = quiz.questions[session.currentQuestionIndex];
                this.io.to(`quiz-${quizId}`).emit('current-question', {
                    questionIndex: session.currentQuestionIndex,
                    question: nextQuestion.text,
                    options: nextQuestion.options,
                    timer: nextQuestion.timer
                });
            }

            // Update active sessions
            const activeSession = this.activeSessions.get(quizId);
            if (activeSession) {
                activeSession.currentQuestionIndex = session.currentQuestionIndex;
                activeSession.status = session.status;
            }

        } catch (error) {
            console.error('Error advancing question:', error);
            socket.emit('error', { message: 'Failed to advance question' });
        }
    }

    async handleShowLeaderboard(socket, data) {
        try {
            const { quizId } = data;
            
            const session = await QuizSession.findOne({ quiz: quizId }).populate('participants', 'name');
            if (!session) {
                socket.emit('error', { message: 'Quiz session not found' });
                return;
            }

            const scores = session.getParticipantScores();
            const leaderboard = [];

            for (const [participantId, score] of Object.entries(scores)) {
                const participant = session.participants.find(p => p._id.toString() === participantId);
                if (participant) {
                    leaderboard.push({
                        name: participant.name,
                        correctAnswers: score.correctAnswers,
                        totalAnswered: score.totalAnswered,
                        totalTime: score.totalTime,
                        accuracy: score.totalAnswered > 0 ? (score.correctAnswers / score.totalAnswered * 100).toFixed(1) : 0
                    });
                }
            }

            // Sort by correct answers, then by time
            leaderboard.sort((a, b) => {
                if (b.correctAnswers !== a.correctAnswers) {
                    return b.correctAnswers - a.correctAnswers;
                }
                return a.totalTime - b.totalTime;
            });

            this.io.to(`quiz-${quizId}`).emit('leaderboard', {
                quizId: quizId,
                leaderboard: leaderboard
            });

        } catch (error) {
            console.error('Error showing leaderboard:', error);
            socket.emit('error', { message: 'Failed to load leaderboard' });
        }
    }

    async handleJoinDebate(socket, data) {
        try {
            const { debateId, userId } = data;
            const user = await User.findById(userId);
            const debate = await Debate.findById(debateId);
            if (!user || !debate) {
                socket.emit('error', { message: 'Invalid user or debate' });
                return;
            }
            // Join socket room
            socket.join(`debate-${debateId}`);
            // Send current debate and session state
            const session = await DebateSession.findOne({ debate: debateId }).populate('currentSpeaker', 'name').populate({ path: 'scores.team', select: 'name' });
            socket.emit('debate-joined', {
                debateId,
                debate,
                session
            });
        } catch (error) {
            socket.emit('error', { message: 'Failed to join debate' });
        }
    }

    async handleStartDebate(socket, data) {
        try {
            const { debateId, userId } = data;
            const debate = await Debate.findById(debateId);
            const user = await User.findById(userId);
            if (!debate || !user) {
                socket.emit('error', { message: 'Invalid debate or user' });
                return;
            }
            if (user.role.name !== 'coordinator' || user._id.toString() !== debate.coordinator.toString()) {
                socket.emit('error', { message: 'Only coordinator can start the debate' });
                return;
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
            // Broadcast session state
            this.io.to(`debate-${debateId}`).emit('debate-started', { session });
        } catch (error) {
            socket.emit('error', { message: 'Failed to start debate' });
        }
    }

    async handleEndDebate(socket, data) {
        try {
            const { debateId, userId } = data;
            const debate = await Debate.findById(debateId);
            const user = await User.findById(userId);
            if (!debate || !user) {
                socket.emit('error', { message: 'Invalid debate or user' });
                return;
            }
            if (user.role.name !== 'coordinator' || user._id.toString() !== debate.coordinator.toString()) {
                socket.emit('error', { message: 'Only coordinator can end the debate' });
                return;
            }
            const session = await DebateSession.findOne({ debate: debateId, status: 'active' });
            if (!session) {
                socket.emit('error', { message: 'No active session' });
                return;
            }
            session.status = 'finished';
            session.endedAt = new Date();
            await session.save();
            debate.status = 'finished';
            await debate.save();
            this.io.to(`debate-${debateId}`).emit('debate-ended', { session });
        } catch (error) {
            socket.emit('error', { message: 'Failed to end debate' });
        }
    }

    async handleNextSpeaker(socket, data) {
        try {
            const { debateId, userId, nextSpeakerId } = data;
            const debate = await Debate.findById(debateId);
            const user = await User.findById(userId);
            if (!debate || !user) {
                socket.emit('error', { message: 'Invalid debate or user' });
                return;
            }
            if (user.role.name !== 'coordinator' || user._id.toString() !== debate.coordinator.toString()) {
                socket.emit('error', { message: 'Only coordinator can change speaker' });
                return;
            }
            const session = await DebateSession.findOne({ debate: debateId, status: 'active' });
            if (!session) {
                socket.emit('error', { message: 'No active session' });
                return;
            }
            session.currentSpeaker = nextSpeakerId;
            await session.save();
            this.io.to(`debate-${debateId}`).emit('speaker-changed', { currentSpeaker: nextSpeakerId });
        } catch (error) {
            socket.emit('error', { message: 'Failed to change speaker' });
        }
    }

    async handleSpeakerChanged(socket, data) {
        try {
            const { debateId, currentSpeaker, userId } = data;
            const debate = await Debate.findById(debateId);
            const user = await User.findById(userId);
            if (!debate || !user) {
                socket.emit('error', { message: 'Invalid debate or user' });
                return;
            }
            if (user.role.name !== 'coordinator') {
                socket.emit('error', { message: 'Only coordinator can change speaker' });
                return;
            }
            // Broadcast to all participants and audience
            this.io.to(`debate-${debateId}`).emit('speaker-changed', { currentSpeaker });
        } catch (error) {
            socket.emit('error', { message: 'Failed to change speaker' });
        }
    }

    async handleYourTurn(socket, data) {
        try {
            const { debateId, participantId, userId } = data;
            const debate = await Debate.findById(debateId);
            const user = await User.findById(userId);
            if (!debate || !user) {
                socket.emit('error', { message: 'Invalid debate or user' });
                return;
            }
            if (user.role.name !== 'coordinator') {
                socket.emit('error', { message: 'Only coordinator can notify turns' });
                return;
            }
            // Send notification to specific participant
            this.io.to(`debate-${debateId}`).emit('your-turn', { participantId });
        } catch (error) {
            socket.emit('error', { message: 'Failed to send turn notification' });
        }
    }

    async handleTimerUpdate(socket, data) {
        try {
            const { debateId, timeLeft, userId } = data;
            const debate = await Debate.findById(debateId);
            const user = await User.findById(userId);
            if (!debate || !user) {
                socket.emit('error', { message: 'Invalid debate or user' });
                return;
            }
            if (user.role.name !== 'coordinator') {
                socket.emit('error', { message: 'Only coordinator can update timer' });
                return;
            }
            // Broadcast timer update to all participants and audience
            this.io.to(`debate-${debateId}`).emit('timer-updated', { timeLeft });
        } catch (error) {
            socket.emit('error', { message: 'Failed to update timer' });
        }
    }

    async handleAudienceReaction(socket, data) {
        try {
            const { debateId, speakerId, reaction, userId } = data;
            const debate = await Debate.findById(debateId);
            const user = await User.findById(userId);
            if (!debate || !user) {
                socket.emit('error', { message: 'Invalid debate or user' });
                return;
            }
            if (user.role.name !== 'audience') {
                socket.emit('error', { message: 'Only audience can react' });
                return;
            }
            // Send reaction to coordinator for tracking
            this.io.to(`debate-${debateId}`).emit('audience-reaction', { speakerId, reaction, userId });
        } catch (error) {
            socket.emit('error', { message: 'Failed to process reaction' });
        }
    }

    async handleShowLeaderboardBroadcast(socket, data) {
        try {
            const { debateId, userId } = data;
            const debate = await Debate.findById(debateId);
            const user = await User.findById(userId);
            if (!debate || !user) {
                socket.emit('error', { message: 'Invalid debate or user' });
                return;
            }
            if (user.role.name !== 'coordinator') {
                socket.emit('error', { message: 'Only coordinator can show leaderboard' });
                return;
            }
            // Broadcast leaderboard show to all participants and audience
            this.io.to(`debate-${debateId}`).emit('show-leaderboard', { debateId });
        } catch (error) {
            socket.emit('error', { message: 'Failed to show leaderboard' });
        }
    }

    async handleAssignScore(socket, data) {
        try {
            const { debateId, userId, teamId, points } = data;
            const debate = await Debate.findById(debateId);
            const user = await User.findById(userId);
            if (!debate || !user) {
                socket.emit('error', { message: 'Invalid debate or user' });
                return;
            }
            if (user.role.name !== 'coordinator' || user._id.toString() !== debate.coordinator.toString()) {
                socket.emit('error', { message: 'Only coordinator can assign score' });
                return;
            }
            const session = await DebateSession.findOne({ debate: debateId, status: 'active' });
            if (!session) {
                socket.emit('error', { message: 'No active session' });
                return;
            }
            let score = session.scores.find(s => s.team.toString() === teamId);
            if (!score) {
                session.scores.push({ team: teamId, points });
            } else {
                score.points += points;
            }
            await session.save();
            this.io.to(`debate-${debateId}`).emit('score-updated', { scores: session.scores });
        } catch (error) {
            socket.emit('error', { message: 'Failed to assign score' });
        }
    }

    handleDisconnect(socket) {
        const quizId = this.participantRooms.get(socket.id);
        if (quizId) {
            this.participantRooms.delete(socket.id);
        }
        console.log('User disconnected:', socket.id);
    }
}

module.exports = SocketManager; 