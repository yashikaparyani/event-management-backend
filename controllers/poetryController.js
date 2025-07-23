const Event = require('../models/Event');
const mongoose = require('mongoose');

// Poetry Topic Schema
const poetryTopicSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    title: { type: String, required: true },
    description: String,
    createdAt: { type: Date, default: Date.now }
});

// Poetry Submission Schema
const poetrySubmissionSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    participant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    content: String,
    pdfUrl: String,
    audioUrl: String,
    createdAt: { type: Date, default: Date.now }
});

const PoetryTopic = mongoose.model('PoetryTopic', poetryTopicSchema);
const PoetrySubmission = mongoose.model('PoetrySubmission', poetrySubmissionSchema);

// Get all poetry events
exports.getPoetryEvents = async (req, res) => {
    try {
        const poetryEvents = await Event.find({ type: 'Poetry' });
        res.status(200).json(poetryEvents);
    } catch (error) {
        console.error('Error fetching poetry events:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get a single poetry event
exports.getPoetryEventById = async (req, res) => {
    try {
        const event = await Event.findOne({ _id: req.params.id, type: 'Poetry' });
        if (!event) {
            return res.status(404).json({ message: 'Poetry event not found' });
        }
        res.status(200).json(event);
    } catch (error) {
        console.error('Error fetching poetry event:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update poetry event details
exports.updatePoetryEvent = async (req, res) => {
    try {
        const event = await Event.findOneAndUpdate(
            { _id: req.params.id, type: 'Poetry' },
            req.body,
            { new: true, runValidators: true }
        );
        if (!event) {
            return res.status(404).json({ message: 'Poetry event not found' });
        }
        res.status(200).json({ message: 'Poetry event updated successfully!', event });
    } catch (error) {
        console.error('Error updating poetry event:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get topics for a poetry event
exports.getEventTopics = async (req, res) => {
    try {
        const topics = await PoetryTopic.find({ eventId: req.params.id });
        res.status(200).json(topics);
    } catch (error) {
        console.error('Error fetching topics:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Add a new topic
exports.addTopic = async (req, res) => {
    try {
        const { title, description } = req.body;
        const topic = new PoetryTopic({
            eventId: req.params.id,
            title,
            description
        });
        await topic.save();
        res.status(201).json({ message: 'Topic added successfully', topic });
    } catch (error) {
        console.error('Error adding topic:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete a topic
exports.deleteTopic = async (req, res) => {
    try {
        const topic = await PoetryTopic.findOneAndDelete({
            _id: req.params.topicId,
            eventId: req.params.id
        });
        if (!topic) {
            return res.status(404).json({ message: 'Topic not found' });
        }
        res.status(200).json({ message: 'Topic deleted successfully' });
    } catch (error) {
        console.error('Error deleting topic:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get submissions for a poetry event
exports.getEventSubmissions = async (req, res) => {
    try {
        const submissions = await PoetrySubmission.find({ eventId: req.params.id })
            .populate('participant', 'name');
        res.status(200).json(submissions);
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Submit poetry
exports.submitPoetry = async (req, res) => {
    try {
        const { title, content } = req.body;
        const submission = new PoetrySubmission({
            eventId: req.params.id,
            participant: req.user.id,
            title,
            content,
            pdfUrl: req.files?.pdf?.[0]?.path,
            audioUrl: req.files?.audio?.[0]?.path
        });
        await submission.save();
        res.status(201).json({ message: 'Poetry submitted successfully', submission });
    } catch (error) {
        console.error('Error submitting poetry:', error);
        res.status(500).json({ message: 'Server error' });
    }
};