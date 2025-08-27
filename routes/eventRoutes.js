// routes/eventRoutes.js
const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { verifyAccessToken } = require('../helpers/jwtHelper');

// Public: list and view
router.get('/', eventController.getEvents);
router.get('/:id', eventController.getEvent);

// Protected: create/update/delete
router.post('/', verifyAccessToken, eventController.createEvent);
router.patch('/:id', verifyAccessToken, eventController.updateEvent);
router.delete('/:id', verifyAccessToken, eventController.deleteEvent);

module.exports = router;



