const express = require('express');
const router = express.Router();
const poetryController = require('../controllers/poetryController');
const authMiddleware = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/checkPermission');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/poetry'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Submit a poem (participant only, with file upload)
router.post('/submit', authMiddleware, checkPermission(['participant']), upload.single('poemFile'), poetryController.submitPoem);

// Get all submissions for a poetry event (open to all)
router.get('/:eventId/submissions', poetryController.getSubmissions);

// Delete a poem (admin/coordinator only)
router.delete('/:poemId', authMiddleware, checkPermission(['admin', 'coordinator']), poetryController.deletePoem);

// Like a poem (all authenticated users)
router.post('/:poemId/like', authMiddleware, poetryController.likePoem);
// Unlike a poem (all authenticated users)
router.post('/:poemId/unlike', authMiddleware, poetryController.unlikePoem);

module.exports = router; 