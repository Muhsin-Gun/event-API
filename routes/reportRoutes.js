const router = require('express').Router();
const { verifyAccessToken } = require('../helpers/jwtHelper');
const reportController = require('../controllers/reportController');

router.get('/sales', verifyAccessToken, reportController.salesReport);

module.exports = router;
