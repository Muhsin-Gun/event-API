// routes/reportRoutes.js
const router = require('express').Router();
const { verifyAccessToken } = require('../helpers/jwtHelper');
const { verifyRole } = require('../middleware/roleMiddleware');
const reportController = require('../controllers/reportController');

router.get('/sales', verifyAccessToken, verifyRole('admin'), reportController.salesReport);

module.exports = router;

