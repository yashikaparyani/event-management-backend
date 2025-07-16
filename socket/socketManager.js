const QuizSession = require('../models/QuizSession');
const Quiz = require('../models/Quiz');
const User = require('../models/User');
const DebateSession = require('../models/DebateSession');

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

            // --- Debate Events ---
            socket.on('start-debate', async (data) => {
                await this.handleStartDebate(socket, data);
            });
            socket.on('join-debate', async (data) => {
                await this.handleJoinDebate(socket, data);
            });
            socket.on('assign-speaker', async (data) => {
                await this.handleAssignSpeaker(socket, data);
            });
            socket.on('end-turn', async (data) => {
                await this.handleEndTurn(socket, data);
            });
            socket.on('send-debate-message', async (data) => {
                await this.handleSendDebateMessage(socket, data);
            });
            socket.on('send-vote', async (data) => {
                await this.handleSendVote(socket, data);
            });
            socket.on('end-debate', async (data) => {
                await this.handleEndDebate(socket, data);
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

    // --- Debate Handlers ---
    async handleStartDebate(socket, data) {
        try {
            const { eventId, userId } = data;
            const user = await User.findById(userId).populate('role');
            console.log('[handleStartDebate]', {
                eventId,
                userId,
                userFound: !!user,
                userRole: user && user.role ? user.role.name : null
            });
            if (!user || user.role.name !== 'coordinator') {
                socket.emit('error', { message: 'Unauthorized' });
                return;
            }
            let session = await DebateSession.findOne({ event: eventId });
            if (!session) {
                session = new DebateSession({ event: eventId, status: 'active', participants: [], audience: [] });
            } else {
                session.status = 'active';
            }
            await session.save();
            this.io.to(`debate-${eventId}`).emit('debate-state-update', { status: 'active' });
        } catch (error) {
            console.error('Error in handleStartDebate:', error);
            socket.emit('error', { message: 'Failed to start debate' });
        }
    }

    async handleJoinDebate(socket, data) {
        try {
            const { eventId, userId, role } = data;
            const user = await User.findById(userId).populate('role');
            let session = await DebateSession.findOne({ event: eventId });
            console.log('[handleJoinDebate]', {
                eventId,
                userId,
                role,
                userFound: !!user,
                userRole: user && user.role ? user.role.name : null,
                sessionFound: !!session,
                sessionStatus: session ? session.status : null
            });
            if (!user) {
                socket.emit('error', { message: 'User not found' });
                return;
            }
            if (!user.role || user.role.name !== role) {
                socket.emit('error', { message: `Role mismatch: user role is ${user.role ? user.role.name : 'none'}, expected ${role}` });
                return;
            }
            if (!session || session.status !== 'active') {
                socket.emit('error', { message: 'Debate not active' });
                return;
            }
            // Add user to participants or audience
            if (role === 'participant' && !session.participants.includes(userId)) {
                session.participants.push(userId);
            } else if (role === 'audience' && !session.audience.includes(userId)) {
                session.audience.push(userId);
            }
            await session.save();
            socket.join(`debate-${eventId}`);
            socket.emit('debate-joined', { eventId, role, status: session.status, currentSpeaker: session.currentSpeaker, timer: session.speakerTimer, messages: session.messages, votes: session.votes });
            this.io.to(`debate-${eventId}`).emit('debate-state-update', { participants: session.participants, audience: session.audience, currentSpeaker: session.currentSpeaker, timer: session.speakerTimer });
        } catch (error) {
            console.error('Error in handleJoinDebate:', error);
            socket.emit('error', { message: 'Failed to join debate' });
        }
    }

    async handleAssignSpeaker(socket, data) {
        try {
            const { eventId, userId, speakerId, timer } = data;
            const user = await User.findById(userId).populate('role');
            if (!user || user.role.name !== 'coordinator') {
                socket.emit('error', { message: 'Unauthorized' });
                return;
            }
            let session = await DebateSession.findOne({ event: eventId });
            if (!session || session.status !== 'active') {
                socket.emit('error', { message: 'Debate not active' });
                return;
            }
            session.currentSpeaker = speakerId;
            session.speakerTimer = timer;
            await session.save();
            this.io.to(`debate-${eventId}`).emit('debate-state-update', { currentSpeaker: speakerId, timer });
        } catch (error) {
            socket.emit('error', { message: 'Failed to assign speaker' });
        }
    }

    async handleEndTurn(socket, data) {
        try {
            const { eventId, userId } = data;
            const user = await User.findById(userId).populate('role');
            if (!user || user.role.name !== 'coordinator') {
                socket.emit('error', { message: 'Unauthorized' });
                return;
            }
            let session = await DebateSession.findOne({ event: eventId });
            if (!session || session.status !== 'active') {
                socket.emit('error', { message: 'Debate not active' });
                return;
            }
            session.currentSpeaker = null;
            session.speakerTimer = 0;
            await session.save();
            this.io.to(`debate-${eventId}`).emit('debate-state-update', { currentSpeaker: null, timer: 0 });
        } catch (error) {
            socket.emit('error', { message: 'Failed to end turn' });
        }
    }

    async handleSendDebateMessage(socket, data) {
        try {
            const { eventId, userId, role, content } = data;
            const user = await User.findById(userId).populate('role');
            if (!user || user.role.name !== role) {
                socket.emit('error', { message: 'Unauthorized' });
                return;
            }
            let session = await DebateSession.findOne({ event: eventId });
            if (!session || session.status !== 'active') {
                socket.emit('error', { message: 'Debate not active' });
                return;
            }
            session.messages.push({ sender: userId, role, content });
            await session.save();
            this.io.to(`debate-${eventId}`).emit('debate-message', { sender: userId, role, content, timestamp: new Date() });
        } catch (error) {
            socket.emit('error', { message: 'Failed to send message' });
        }
    }

    async handleSendVote(socket, data) {
        try {
            const { eventId, userId, voteType } = data;
            const user = await User.findById(userId);
            let session = await DebateSession.findOne({ event: eventId });
            if (!session || session.status !== 'active') {
                socket.emit('error', { message: 'Debate not active' });
                return;
            }
            session.votes.push({ voter: userId, voteType });
            await session.save();
            this.io.to(`debate-${eventId}`).emit('debate-vote', { voter: userId, voteType });
        } catch (error) {
            socket.emit('error', { message: 'Failed to send vote' });
        }
    }

    async handleEndDebate(socket, data) {
        try {
            const { eventId, userId } = data;
            const user = await User.findById(userId).populate('role');
            if (!user || user.role.name !== 'coordinator') {
                socket.emit('error', { message: 'Unauthorized' });
                return;
            }
            let session = await DebateSession.findOne({ event: eventId });
            if (!session) {
                socket.emit('error', { message: 'Debate session not found' });
                return;
            }
            session.status = 'finished';
            session.currentSpeaker = null;
            session.speakerTimer = 0;
            await session.save();
            this.io.to(`debate-${eventId}`).emit('debate-state-update', { status: 'finished' });
        } catch (error) {
            socket.emit('error', { message: 'Failed to end debate' });
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