const Event = require('../models/Event');
const QRCode = require('qrcode');

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
        let events;
        if (
            req.user.role === 'admin' ||
            req.user.role === 'audience' ||
            req.user.role?.name === 'admin' ||
            req.user.role?.name === 'audience'
        ) {
            events = await Event.find();
        } else if (req.user.role === 'coordinator') {
            events = await Event.find();
        } else if (req.user.role === 'volunteer') {
            events = await Event.find();
        } else if (req.user.role === 'participant') {
            events = await Event.find();
        } else {
            events = await Event.find();
        }
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

// Get participants for an event (for debate, returns registered users)
exports.getParticipants = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id).populate('registeredUsers');
        if (!event) return res.status(404).json({ message: 'Event not found' });
        // For debate: include side info if present
        let participants = [];
        if (event.type === 'Debate' && Array.isArray(event.participants)) {
            participants = event.participants.map(p => ({
                _id: p._id,
                name: p.name,
                side: p.side || null
            }));
        } else if (Array.isArray(event.registeredUsers)) {
            participants = event.registeredUsers.map(u => ({
                _id: u._id,
                name: u.name || '',
                side: null
            }));
        }
        res.status(200).json(participants);
    } catch (error) {
        console.error('Error fetching participants:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Register a user for an event (from QR registration)
exports.registerForEvent = async (req, res) => {
// ... (existing code)
};

// Get debate leaderboard for a debate event (all roles)
exports.getDebateLeaderboard = async (req, res) => {
    try {
        const eventId = req.params.id;
        const event = await Event.findById(eventId).lean();
        if (!event || event.type !== 'Debate') {
            return res.status(404).json({ message: 'Debate event not found.' });
        }
        // Defensive: aggregate leaderboard from debateResults or fallback
        const results = Array.isArray(event.debateResults) ? event.debateResults : [];
        // Simple aggregation: sum scores/likes per participant, group by side
        const leaderboard = { for: [], against: [] };
        for (const p of results) {
            if (!p || !p.participantId) continue;
            const side = (p.side === 'for' || p.side === 'against') ? p.side : 'for';
            leaderboard[side].push({
                participantId: p.participantId,
                name: p.name || '',
                score: typeof p.score === 'number' ? p.score : 0,
                likes: typeof p.likes === 'number' ? p.likes : 0,
                criteria: p.criteria || {},
            });
        }
        // Sort by score descending, then likes
        leaderboard.for.sort((a, b) => b.score - a.score || b.likes - a.likes);
        leaderboard.against.sort((a, b) => b.score - a.score || b.likes - a.likes);
        res.status(200).json({ leaderboard });
    } catch (error) {
        console.error('Error fetching debate leaderboard:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Setup debate event (coordinator only)
exports.debateSetup = async (req, res) => {
    try {
        const eventId = req.params.id;
        const { topic, rules, timerPerParticipant } = req.body;
        const event = await Event.findById(eventId);
        if (!event || event.type !== 'Debate') {
            return res.status(404).json({ message: 'Debate event not found.' });
        }
        if (typeof topic === 'string') event.topic = topic;
        if (typeof rules === 'string') event.rules = rules;
        if (typeof timerPerParticipant === 'number') event.timerPerParticipant = timerPerParticipant;
        await event.save();
        res.status(200).json({ message: 'Debate setup updated successfully!', event });
    } catch (error) {
        console.error('Error updating debate setup:', error);
        res.status(500).json({ message: 'Server error' });
    }
};