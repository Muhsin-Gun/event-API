// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/usercontroller'); // keep filename casing consistent with your project
const { verifyAccessToken } = require('../helpers/jwtHelper');
const { verifyRole } = require('../middleware/roleMiddleware');

router.get('/getUsers', verifyAccessToken, verifyRole('admin'), userController.getAllUsers);
router.get('/getUser/:id', verifyAccessToken, userController.getUser);
router.patch('/updateUser/:id', verifyAccessToken, userController.updateUser);
router.delete('/deleteUser/:id', verifyAccessToken, verifyRole('admin'), userController.deleteUser);

module.exports = router;


