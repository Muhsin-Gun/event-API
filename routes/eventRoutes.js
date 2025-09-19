const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { verifyAccessToken } = require('../helpers/jwtHelper');

// List events
router.get('/', eventController.getEvents);
// Single event
router.get('/:id', eventController.getEvent);

// Create (employee/admin only)
router.post('/', verifyAccessToken, eventController.createEvent);

// Update (owner/admin)
router.patch('/:id', verifyAccessToken, eventController.updateEvent);

// Delete (owner/admin)
router.delete('/:id', verifyAccessToken, eventController.deleteEvent);

module.exports = router;



