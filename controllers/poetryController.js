const Poetry = require('../models/Poetry');

// Submit a poem
exports.submitPoem = async (req, res) => {
  try {
    const { eventId, poetName, title, text } = req.body;
    const user = req.user._id;
    let fileUrl = '', fileName = '', fileType = '';
    if (req.file) {
      fileUrl = `/uploads/poetry/${req.file.filename}`;
      fileName = req.file.originalname;
      fileType = req.file.mimetype;
    }
    // Prevent duplicate submissions by the same user for the same event
    const existing = await Poetry.findOne({ event: eventId, user });
    if (existing) {
      return res.status(400).json({ message: 'You have already submitted a poem for this event.' });
    }
    const poem = new Poetry({ event: eventId, user, poetName, title, text, fileUrl, fileType, fileName });
    await poem.save();
    res.status(201).json({ message: 'Poem submitted successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Error submitting poem', error: err.message });
  }
};

// Like a poem
exports.likePoem = async (req, res) => {
  try {
    const { poemId } = req.params;
    const userId = req.user._id;
    const poem = await Poetry.findById(poemId);
    if (!poem) return res.status(404).json({ message: 'Poem not found.' });
    if (poem.likes.includes(userId)) {
      return res.status(400).json({ message: 'You have already liked this poem.' });
    }
    poem.likes.push(userId);
    await poem.save();
    res.json({ message: 'Poem liked.' });
  } catch (err) {
    res.status(500).json({ message: 'Error liking poem', error: err.message });
  }
};

// Unlike a poem
exports.unlikePoem = async (req, res) => {
  try {
    const { poemId } = req.params;
    const userId = req.user._id;
    const poem = await Poetry.findById(poemId);
    if (!poem) return res.status(404).json({ message: 'Poem not found.' });
    const idx = poem.likes.indexOf(userId);
    if (idx === -1) {
      return res.status(400).json({ message: 'You have not liked this poem.' });
    }
    poem.likes.splice(idx, 1);
    await poem.save();
    res.json({ message: 'Poem unliked.' });
  } catch (err) {
    res.status(500).json({ message: 'Error unliking poem', error: err.message });
  }
};

// Get all submissions for a poetry event
exports.getSubmissions = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.user?._id?.toString();
    const poems = await Poetry.find({ event: eventId }).populate('user', 'name');
    const submissions = poems.map(poem => ({
      _id: poem._id,
      event: poem.event,
      user: poem.user,
      poetName: poem.poetName,
      title: poem.title,
      text: poem.text,
      fileUrl: poem.fileUrl,
      fileType: poem.fileType,
      fileName: poem.fileName,
      createdAt: poem.createdAt,
      likeCount: poem.likes.length,
      likedByCurrentUser: userId ? poem.likes.map(id => id.toString()).includes(userId) : false
    }));
    res.json({ submissions });
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