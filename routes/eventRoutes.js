const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const { verifyAccessToken } = require('../helpers/jwtHelper');

router.get('/getEvents', eventController.getAllEvents);
router.get('/getEvent/:id', eventController.getEvent);
router.post('/createEvent', verifyAccessToken, eventController.createEvent);
router.patch('/updateEvent/:id', verifyAccessToken, eventController.updateEvent);
router.delete('/deleteEvent/:id', verifyAccessToken, eventController.deleteEvent);

module.exports = router;
