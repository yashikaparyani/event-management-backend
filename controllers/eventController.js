const Event = require('../models/Event');
const QRCode = require('qrcode');
const mongoose = require('mongoose');

// Create a new event
exports.createEvent = async (req, res) => {
    try {
        const { title, description, date, time, location, capacity, organizer, price, imageUrl, type } = req.body;
        const createdBy = req.user.id;
        const newEvent = new Event({
            title,
            description,
            date,
            time,
            location,
            capacity: capacity !== undefined ? Number(capacity) : undefined,
            organizer,
            price: price !== undefined ? Number(price) : undefined,
            imageUrl,
            type,
            createdBy
        });
        await newEvent.save();
        // Generate registration URL for QR code
        const registrationUrl = `https://evnify.netlify.app/register?eventId=${newEvent._id}`;
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
        console.log('Fetching events for user:', req.user);
        let events;
        if (
            req.user.role === 'admin' ||
            req.user.role === 'audience' ||
            req.user.role?.name === 'admin' ||
            req.user.role?.name === 'audience'
        ) {
            events = await Event.find();
        } else if (req.user.role === 'coordinator') {
            // Ensure _id is ObjectId for query
            const userId = mongoose.Types.ObjectId(req.user._id || req.user.id);
            events = await Event.find({
                $or: [
                    { type: { $ne: 'Remix' } },
                    { type: 'Remix', assignedCoordinators: userId }
                ]
            });
        } else if (req.user.role === 'volunteer') {
            const userId = mongoose.Types.ObjectId(req.user._id || req.user.id);
            events = await Event.find({
                $or: [
                    { type: { $ne: 'Remix' } },
                    { type: 'Remix', assignedVolunteers: userId }
                ]
            });
        } else if (req.user.role === 'participant') {
            const userId = mongoose.Types.ObjectId(req.user._id || req.user.id);
            events = await Event.find({
                $or: [
                    { type: { $ne: 'Remix' } },
                    { type: 'Remix', registeredParticipants: userId }
                ]
            });
        } else {
            events = await Event.find({ type: { $ne: 'Remix' } });
        }
        console.log('Events found:', events.map(e => ({id: e._id, title: e.title, assignedCoordinators: e.assignedCoordinators})));
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
        // Ensure assignedCoordinators is updated for Remix events
        if (event.type === 'Remix' && event.coordinator) {
            if (!event.assignedCoordinators) event.assignedCoordinators = [];
            const coordId = typeof event.coordinator === 'string' ? mongoose.Types.ObjectId(event.coordinator) : event.coordinator;
            if (!event.assignedCoordinators.map(id => String(id)).includes(String(coordId))) {
                event.assignedCoordinators.push(coordId);
                await event.save();
            }
            console.log('Updated assignedCoordinators for Remix event:', event._id, 'assignedCoordinators:', event.assignedCoordinators);
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

// Register a user for an event (from QR registration)
exports.registerForEvent = async (req, res) => {
    try {
        const eventId = req.params.id;
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required to register for event.' });
        }
        const user = await require('../models/User').findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found.' });
        }
        if (!event.registeredUsers.includes(user._id)) {
            event.registeredUsers.push(user._id);
            await event.save();
        }
        return res.status(200).json({ message: 'User registered for event successfully.' });
    } catch (error) {
        console.error('Error registering user for event:', error);
        res.status(500).json({ message: 'Server error' });
    }
};