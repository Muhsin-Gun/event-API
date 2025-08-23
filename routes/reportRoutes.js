const router = require('express').Router();
const { verifyAccessToken } = require('../helpers/jwtHelper');
const reportController = require('../controllers/reportController');

// admin-only in a real app; keep simple here:
router.get('/sales', verifyAccessToken, reportController.salesReport);

module.exports = router;
