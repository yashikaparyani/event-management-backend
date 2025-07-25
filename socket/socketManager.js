const QuizSession = require('../models/QuizSession');
const Quiz = require('../models/Quiz');
const User = require('../models/User');
const Team = require('../models/Team');
const Event = require('../models/Event');

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

            // Quiz events
            socket.on('join-quiz', async (data) => {
                await this.handleJoinQuiz(socket, data);
            });

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
                await this.handleJoinDebate(socket, data);
            });
            socket.on('debate-state-request', async (data) => {
                await this.handleDebateStateRequest(socket, data);
            });
            socket.on('debate-state-update', async (data) => {
                await this.handleDebateStateUpdate(socket, data);
            });

            // Disconnect handler
            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });
        });
    }

    async handleJoinQuiz(socket, data) {
        try {
            const { quizId, userId } = data;
            const user = await User.findById(userId);
            const quiz = await Quiz.findById(quizId);
            
            if (!user || !quiz) {
                socket.emit('error', { message: 'Invalid user or quiz' });
                return;
            }

            // Join socket room
            socket.join(`quiz-${quizId}`);
            
            // Track participant's room
            this.participantRooms.set(socket.id, quizId);
            
            // Get or create quiz session
            let session = await QuizSession.findOne({ 
                quiz: quizId,
                status: { $in: ['waiting', 'active'] }
            });

            if (!session) {
                session = new QuizSession({
                    quiz: quizId,
                    participants: [],
                    status: 'waiting',
                    currentQuestionIndex: -1,
                    answers: []
                });
                await session.save();
            }

            // Add participant if not already added
            if (!session.participants.includes(userId)) {
                session.participants.push(userId);
                await session.save();
            }

            // Store active session
            if (!this.activeSessions.has(quizId)) {
                this.activeSessions.set(quizId, {
                    status: session.status,
                    currentQuestionIndex: session.currentQuestionIndex,
                    participants: new Set(session.participants.map(id => id.toString()))
                });
            }

            // Send current quiz state
            socket.emit('quiz-joined', {
                quizId,
                status: session.status,
                currentQuestionIndex: session.currentQuestionIndex,
                totalQuestions: quiz.questions.length,
                participants: session.participants.length
            });

        } catch (error) {
            console.error('Error joining quiz:', error);
            socket.emit('error', { message: 'Failed to join quiz' });
        }
    }

    async handleSubmitAnswer(socket, data) {
        try {
            const { quizId, userId, questionIndex, selectedOption, timeTaken } = data;
            
            const session = await QuizSession.findOne({ quiz: quizId, status: 'active' });
            const quiz = await Quiz.findById(quizId);
            
            if (!session || !quiz) {
                socket.emit('error', { message: 'Invalid session or quiz' });
                return;
            }

            const question = quiz.questions[questionIndex];
            const isCorrect = selectedOption === question.correctOption;

            // Save answer
            session.answers.push({
                participant: userId,
                questionIndex,
                selectedOption,
                isCorrect,
                timeTaken
            });
            
            await session.save();

            // Acknowledge answer submission
            socket.emit('answer-submitted', {
                questionIndex,
                isCorrect
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
                quizId,
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

            // Move to next question
            const nextQuestionIndex = session.currentQuestionIndex + 1;
            
            if (nextQuestionIndex >= quiz.questions.length) {
                // Quiz finished
                session.status = 'finished';
                session.endedAt = new Date();
                await session.save();

                this.io.to(`quiz-${quizId}`).emit('quiz-finished', { quizId });
                return;
            }

            // Update to next question
            session.currentQuestionIndex = nextQuestionIndex;
            await session.save();

            // Update active session
            const activeSession = this.activeSessions.get(quizId);
            if (activeSession) {
                activeSession.currentQuestionIndex = nextQuestionIndex;
            }

            // Send next question to all participants
            const nextQuestion = quiz.questions[nextQuestionIndex];
            this.io.to(`quiz-${quizId}`).emit('next-question', {
                questionIndex: nextQuestionIndex,
                question: nextQuestion.text,
                options: nextQuestion.options,
                timer: nextQuestion.timer
            });

        } catch (error) {
            console.error('Error moving to next question:', error);
            socket.emit('error', { message: 'Failed to move to next question' });
        }
    }

    /**
     * Debate: Handle user joining a debate room (coordinator, participant, audience)
     * data: { eventId, userId, role }
     */
    async handleJoinDebate(socket, data) {
        try {
            const { eventId, userId, role } = data || {};
            if (!eventId || !userId || !role) {
                socket.emit('debate-error', { message: 'Missing eventId, userId, or role.' });
                return;
            }
            // Join debate room
            socket.join(`debate-${eventId}`);
            // Defensive: fetch event and send current debate state
            const event = await Event.findById(eventId).lean();
            if (!event || event.type !== 'Debate') {
                socket.emit('debate-error', { message: 'Debate event not found.' });
                return;
            }
            // Compose safe state object
            const debateState = this.composeDebateState(event);
            socket.emit('debate-state', debateState);
        } catch (error) {
            console.error('handleJoinDebate error:', error);
            socket.emit('debate-error', { message: 'Failed to join debate.' });
        }
    }

    /**
     * Debate: Handle explicit state re-sync request (e.g., on reconnect)
     * data: { eventId }
     */
    async handleDebateStateRequest(socket, data) {
        try {
            const { eventId } = data || {};
            if (!eventId) {
                socket.emit('debate-error', { message: 'Missing eventId.' });
                return;
            }
            const event = await Event.findById(eventId).lean();
            if (!event || event.type !== 'Debate') {
                socket.emit('debate-error', { message: 'Debate event not found.' });
                return;
            }
            const debateState = this.composeDebateState(event);
            socket.emit('debate-state', debateState);
        } catch (error) {
            console.error('handleDebateStateRequest error:', error);
            socket.emit('debate-error', { message: 'Failed to fetch debate state.' });
        }
    }

    /**
     * Debate: Handle state update from coordinator (scores, likes, turn, etc.)
     * data: { eventId, update }
     */
    async handleDebateStateUpdate(socket, data) {
        try {
            const { eventId, update } = data || {};
            if (!eventId || !update || typeof update !== 'object') {
                socket.emit('debate-error', { message: 'Missing or invalid eventId/update.' });
                return;
            }
            // Defensive: Only allow certain fields to be updated
            const allowedFields = [
                'debateResults', 'currentSpeaker', 'currentTimer', 'likes', 'spoken', 'scoreboard',
                'showLeaderboard', 'forList', 'againstList', 'sideSelections', 'debateStatus', 'notifications'
            ];
            // Only keep allowed fields
            const safeUpdate = {};
            for (const key of allowedFields) {
                if (update.hasOwnProperty(key)) {
                    safeUpdate[key] = update[key];
                }
            }
            // Update event doc
            const event = await Event.findByIdAndUpdate(
                eventId,
                { $set: safeUpdate },
                { new: true, lean: true }
            );
            if (!event) {
                socket.emit('debate-error', { message: 'Debate event not found.' });
                return;
            }
            // Broadcast new state to all in room
            const debateState = this.composeDebateState(event);
            this.io.to(`debate-${eventId}`).emit('debate-state', debateState);
        } catch (error) {
            console.error('handleDebateStateUpdate error:', error);
            socket.emit('debate-error', { message: 'Failed to update debate state.' });
        }
    }

    /**
     * Compose a fully defensive debate state object for frontend
     */
    composeDebateState(event) {
        // Defensive: always return all expected fields, never undefined/null
        return {
            eventId: event._id?.toString() || '',
            topic: event.topic || '',
            rules: event.rules || '',
            timerPerParticipant: event.timerPerParticipant || 120,
            debateResults: event.debateResults || [],
            currentSpeaker: event.currentSpeaker || null,
            currentTimer: typeof event.currentTimer === 'number' ? event.currentTimer : null,
            likes: event.likes || {},
            spoken: event.spoken || {},
            scoreboard: event.scoreboard || {},
            showLeaderboard: !!event.showLeaderboard,
            forList: event.forList || [],
            againstList: event.againstList || [],
            sideSelections: event.sideSelections || {},
            debateStatus: event.debateStatus || 'not_started',
            notifications: event.notifications || [],
        };
    }

    async handleShowLeaderboard(socket, data) {
        try {
            const { quizId } = data;
            
            const session = await QuizSession.findOne({ quiz: quizId })
                .populate('participants', 'name')
                .populate('answers.participant', 'name');
            
            if (!session) {
                socket.emit('error', { message: 'Quiz session not found' });
                return;
            }

            // Calculate scores
            const scores = {};
            session.answers.forEach(answer => {
                const userId = answer.participant._id.toString();
                if (!scores[userId]) {
                    scores[userId] = {
                        name: answer.participant.name,
                        score: 0,
                        correct: 0,
                        total: 0
                    };
                }
                scores[userId].total++;
                if (answer.isCorrect) {
                    scores[userId].score += 10; // 10 points per correct answer
                    scores[userId].correct++;
                }
            });

            // Convert to array and sort by score (descending)
            const leaderboard = Object.values(scores).sort((a, b) => b.score - a.score);

            // Emit leaderboard to all participants
            this.io.to(`quiz-${quizId}`).emit('leaderboard', {
                quizId,
                leaderboard
            });

        } catch (error) {
            console.error('Error showing leaderboard:', error);
            socket.emit('error', { message: 'Failed to load leaderboard' });
        }
    }

    handleDisconnect(socket) {
        console.log('User disconnected:', socket.id);
        
        // Remove from participant rooms
        const quizId = this.participantRooms.get(socket.id);
        if (quizId) {
            this.participantRooms.delete(socket.id);
            
            // Update active sessions count if needed
            const activeSession = this.activeSessions.get(quizId);
            if (activeSession) {
                // In a real app, you might want to track individual participants
                // and update the count more precisely
                console.log(`Participant left quiz ${quizId}`);
            }
        }
    }
}

module.exports = SocketManager;
