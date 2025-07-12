const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    options: [{ type: String, required: true }], // 4 options
    correctOption: { type: Number, required: true }, // index (0-3)
    timer: { type: Number, required: true } // seconds
});

const quizSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    questions: [questionSchema],
    quizId: { type: String, required: true, unique: true }, // auto-generated
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Quiz', quizSchema); 