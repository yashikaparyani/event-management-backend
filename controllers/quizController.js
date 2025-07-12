const Quiz = require('../models/Quiz');
const Event = require('../models/Event');

// Create a new quiz
exports.createQuiz = async (req, res) => {
    try {
        const { title, description, eventId, questions } = req.body;
        const createdBy = req.user.id;

        // Validate event exists and user is coordinator for this event
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        if (event.coordinator.toString() !== createdBy) {
            return res.status(403).json({ message: 'You can only create quizzes for events you manage' });
        }

        // Validate questions
        if (!questions || questions.length === 0) {
            return res.status(400).json({ message: 'At least one question is required' });
        }

        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            if (!question.text || !question.options || question.options.length !== 4 || 
                question.correctOption < 0 || question.correctOption > 3 || !question.timer) {
                return res.status(400).json({ 
                    message: `Question ${i + 1} is invalid. Each question must have text, exactly 4 options, correct option (0-3), and timer.` 
                });
            }
        }

        // Generate unique quiz ID
        const quizId = 'QUIZ_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        const quiz = new Quiz({
            title,
            description,
            event: eventId,
            questions,
            quizId,
            createdBy
        });

        await quiz.save();
        res.status(201).json({ 
            message: 'Quiz created successfully!', 
            quiz: { 
                id: quiz._id, 
                quizId: quiz.quizId, 
                title: quiz.title 
            } 
        });
    } catch (error) {
        console.error('Error creating quiz:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get quiz by ID
exports.getQuizById = async (req, res) => {
    try {
        const quiz = await Quiz.findById(req.params.id).populate('event');
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }
        res.status(200).json(quiz);
    } catch (error) {
        console.error('Error fetching quiz:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update quiz
exports.updateQuiz = async (req, res) => {
    try {
        const { title, description, questions } = req.body;
        const quizId = req.params.id;
        const userId = req.user.id;

        const quiz = await Quiz.findById(quizId);
        if (!quiz) {
            return res.status(404).json({ message: 'Quiz not found' });
        }

        // Check if user is the creator
        if (quiz.createdBy.toString() !== userId) {
            return res.status(403).json({ message: 'You can only edit quizzes you created' });
        }

        // Validate questions if provided
        if (questions) {
            if (questions.length === 0) {
                return res.status(400).json({ message: 'At least one question is required' });
            }

            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                if (!question.text || !question.options || question.options.length !== 4 || 
                    question.correctOption < 0 || question.correctOption > 3 || !question.timer) {
                    return res.status(400).json({ 
                        message: `Question ${i + 1} is invalid. Each question must have text, exactly 4 options, correct option (0-3), and timer.` 
                    });
                }
            }
        }

        const updatedQuiz = await Quiz.findByIdAndUpdate(
            quizId,
            { title, description, questions },
            { new: true, runValidators: true }
        );

        res.status(200).json({ 
            message: 'Quiz updated successfully!', 
            quiz: updatedQuiz 
        });
    } catch (error) {
        console.error('Error updating quiz:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get quizzes for an event
exports.getQuizzesByEvent = async (req, res) => {
    try {
        const { eventId } = req.params;
        const quizzes = await Quiz.find({ event: eventId }).populate('createdBy', 'name');
        res.status(200).json(quizzes);
    } catch (error) {
        console.error('Error fetching quizzes:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get quizzes created by a coordinator
exports.getQuizzesByCoordinator = async (req, res) => {
    try {
        const userId = req.user.id;
        const quizzes = await Quiz.find({ createdBy: userId }).populate('event', 'title');
        res.status(200).json(quizzes);
    } catch (error) {
        console.error('Error fetching coordinator quizzes:', error);
        res.status(500).json({ message: 'Server error' });
    }
}; 