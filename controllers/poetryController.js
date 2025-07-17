const Poetry = require('../models/Poetry');

// Submit a poem
exports.submitPoem = async (req, res) => {
  try {
    const { eventId } = req.body;
    const { poetName, title, text, fileUrl } = req.body;
    const user = req.user._id;
    // Prevent duplicate submissions by the same user for the same event
    const existing = await Poetry.findOne({ event: eventId, user });
    if (existing) {
      return res.status(400).json({ message: 'You have already submitted a poem for this event.' });
    }
    const poem = new Poetry({ event: eventId, user, poetName, title, text, fileUrl });
    await poem.save();
    res.status(201).json({ message: 'Poem submitted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Error submitting poem', error: err.message });
  }
};

// Get all submissions for a poetry event
exports.getSubmissions = async (req, res) => {
  try {
    const { eventId } = req.params;
    const poems = await Poetry.find({ event: eventId }).populate('user', 'name');
    res.json({ submissions: poems });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching submissions', error: err.message });
  }
};

// Delete a poem (admin/coordinator only)
exports.deletePoem = async (req, res) => {
  try {
    const { poemId } = req.params;
    const deleted = await Poetry.findByIdAndDelete(poemId);
    if (!deleted) {
      return res.status(404).json({ message: 'Poem not found.' });
    }
    res.json({ message: 'Poem deleted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting poem', error: err.message });
  }
}; 