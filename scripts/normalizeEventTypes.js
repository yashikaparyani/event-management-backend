const mongoose = require('mongoose');
const Event = require('../models/Event');
require('dotenv').config();

async function normalizeEventTypes() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('Connected to MongoDB');

        // Find all events with type 'CodecRaze' or case variations
        const events = await Event.find({
            $or: [
                { type: 'CodecRaze' },
                { type: /^codecraze$/i } // Case-insensitive match
            ]
        });

        console.log(`Found ${events.length} events to update`);

        // Update each event to use 'codecRaze'
        const updates = events.map(event => {
            console.log(`Updating event: ${event._id} from '${event.type}' to 'codecRaze'`);
            return Event.updateOne(
                { _id: event._id },
                { $set: { type: 'codecRaze' }}
            );
        });

        await Promise.all(updates);
        console.log('Successfully updated all events');

    } catch (error) {
        console.error('Error normalizing event types:', error);
    } finally {
        await mongoose.connection.close();
        console.log('MongoDB connection closed');
    }
}

// Run the script
normalizeEventTypes();
