const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const poetryController = require('../controllers/poetryController');
const authMiddleware = require('../middleware/authMiddleware');
const checkPermission = require('../middleware/checkPermission');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads', file.fieldname);
        // Ensure the directory exists
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Get all poetry events
router.get('/', authMiddleware, poetryController.getPoetryEvents);

// Get a specific poetry event
router.get('/:id', authMiddleware, poetryController.getPoetryEventById);

// Update a poetry event (coordinator only)
router.put('/:id', 
    authMiddleware, 
    checkPermission('coordinator'),
    poetryController.updatePoetryEvent
);

// Topic management routes
router.get('/:id/topics', 
    authMiddleware, 
    poetryController.getEventTopics
);

router.post('/:id/topics', 
    authMiddleware, 
    checkPermission('manage_events'),
    poetryController.addTopic
);

router.delete('/:id/topics/:topicId', 
    authMiddleware, 
    checkPermission('manage_events'),
    poetryController.deleteTopic
);

// Submission routes
router.get('/:id/submissions', 
    authMiddleware, 
    checkPermission('manage_events'),
    poetryController.getEventSubmissions
);

router.post('/:id/submit',
    authMiddleware,
    upload.fields([
        { name: 'pdf', maxCount: 1 },
        { name: 'audio', maxCount: 1 }
    ]),
    poetryController.submitPoetry
);

module.exports = router;