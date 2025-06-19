const Event = require('../models/Event');
const QRCode = require('qrcode');

// Create a new event
exports.createEvent = async (req, res) => {
    try {
        const { title, description, date, time, location, capacity, organizer, price, imageUrl } = req.body;

        // The user ID should be available from req.user set by authMiddleware
        const createdBy = req.user.id;

        const newEvent = new Event({
            title,
            description,
            date,
            time,
            location,
            capacity,
            organizer,
            price,
            imageUrl,
            createdBy
        });

        await newEvent.save();

        // Generate registration URL for QR code
        const registrationUrl = `https://event-management-backend-z0ty.onrender.com/api/events/${newEvent._id}/register`;
        // Generate QR code as base64 PNG
        newEvent.qrCode = await QRCode.toDataURL(registrationUrl, { type: 'image/png' });
        await newEvent.save();

        res.status(201).json({ message: 'Event created successfully!', event: newEvent });
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get all events
exports.getEvents = async (req, res) => {
    try {
        const events = await Event.find();
        res.status(200).json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get a single event by ID
exports.getEventById = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.status(200).json(event);
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Update an event by ID
exports.updateEvent = async (req, res) => {
    try {
        const event = await Event.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.status(200).json({ message: 'Event updated successfully!', event });
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete an event by ID
exports.deleteEvent = async (req, res) => {
    try {
        const event = await Event.findByIdAndDelete(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        res.status(200).json({ message: 'Event deleted successfully!' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get upcoming events
exports.getUpcomingEvents = async (req, res) => {
    try {
        const now = new Date();
        const events = await Event.find({ date: { $gte: now } }).sort({ date: 1 });
        res.status(200).json(events);
    } catch (error) {
        console.error('Error fetching upcoming events:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get registered events for the current user
exports.getRegisteredEvents = async (req, res) => {
    try {
        const userId = req.user.id;
        const events = await Event.find({ registeredUsers: userId });
        res.status(200).json(events);
    } catch (error) {
        console.error('Error fetching registered events:', error);
        res.status(500).json({ message: 'Server error' });
    }
};