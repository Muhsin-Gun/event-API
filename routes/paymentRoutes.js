const router = require('express').Router();
const { verifyAccessToken } = require('../helpers/jwtHelper');
const mpesa = require('../controllers/mpesaController');

router.post('/mpesa/stkpush', verifyAccessToken, mpesa.initiateStkPush);
router.post('/mpesa/callback', mpesa.mpesaCallback); // Safaricom will call this publicly

module.exports = router;
