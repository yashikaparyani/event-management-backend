const mongoose = require('mongoose');

const participantAnswerSchema = new mongoose.Schema({
    participant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    questionIndex: {
        type: Number,
        required: true
    },
    selectedOption: {
        type: Number,
        required: true
    },
    isCorrect: {
        type: Boolean,
        required: true
    },
    timeTaken: {
        type: Number, // seconds
        required: true
    },
    answeredAt: {
        type: Date,
        default: Date.now
    }
});

const quizSessionSchema = new mongoose.Schema({
    quiz: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz',
        required: true
    },
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    status: {
        type: String,
        enum: ['waiting', 'active', 'finished'],
        default: 'waiting'
    },
    currentQuestionIndex: {
        type: Number,
        default: 0
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    answers: [participantAnswerSchema],
    startedAt: {
        type: Date,
        default: null
    },
    endedAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Calculate participant scores
quizSessionSchema.methods.getParticipantScores = function() {
    const scores = {};
    
    this.answers.forEach(answer => {
        const participantId = answer.participant.toString();
        if (!scores[participantId]) {
            scores[participantId] = {
                correctAnswers: 0,
                totalAnswered: 0,
                totalTime: 0
            };
        }
        
        scores[participantId].totalAnswered++;
        scores[participantId].totalTime += answer.timeTaken;
        
        if (answer.isCorrect) {
            scores[participantId].correctAnswers++;
        }
    });
    
    return scores;
};

module.exports = mongoose.model('QuizSession', quizSessionSchema); 