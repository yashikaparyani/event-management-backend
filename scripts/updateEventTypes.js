// backend/scripts/updateEventTypes.js

require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('../models/Event');

// 1. Update these mappings as needed for your events
const typeMappings = [
    { filter: { title: /quiz/i }, type: 'Quiz' },
    { filter: { title: /debate/i }, type: 'Debate' }
];

async function updateEventTypes() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/event_management';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  for (const mapping of typeMappings) {
    const result = await Event.updateMany(
      { ...mapping.filter, type: { $exists: false } }, // Only update if type is missing
      { $set: { type: mapping.type } }
    );
    console.log(`Updated ${result.modifiedCount} events to type "${mapping.type}"`);
  }

  await mongoose.disconnect();
  console.log('Done!');
}

updateEventTypes().catch(err => {
  console.error('Error updating event types:', err);
  process.exit(1);
});