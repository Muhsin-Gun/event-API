const router = require('express').Router();
const eventController = require('../controllers/eventController');
const { verifyAccessToken } = require('../helpers/jwtHelper');

// CRUD routes
router.post('/', verifyAccessToken, eventController.createEvent);
router.get('/', eventController.getEvents);
router.get('/:id', eventController.getEvent);
router.patch('/:id', verifyAccessToken, eventController.updateEvent);
router.delete('/:id', verifyAccessToken, eventController.deleteEvent);

module.exports = router;

