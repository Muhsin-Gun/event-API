const router = require('express').Router();
const { register, login, forgotPassword, resetPassword } = require('../controllers/authController');
const tokenController = require('../controllers/tokenController');

router.post('/refresh-token', tokenController.refreshToken);
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;

