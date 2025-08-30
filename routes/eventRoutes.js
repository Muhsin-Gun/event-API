// routes/eventRoutes.js
const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { verifyAccessToken } = require('../helpers/jwtHelper');
// We’ll enforce role in controller for ownership-sensitive ops; creation is restricted to employee/admin.

router.get('/', eventController.getEvents);
router.get('/:id', eventController.getEvent);

router.post('/', verifyAccessToken, eventController.createEvent);
router.patch('/:id', verifyAccessToken, eventController.updateEvent);
router.delete('/:id', verifyAccessToken, eventController.deleteEvent);

module.exports = router;




