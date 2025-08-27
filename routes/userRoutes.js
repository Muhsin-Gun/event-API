// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const userController = require("../controllers/usercontroller");
const { verifyAccessToken } = require("../helpers/jwtHelper");
const { verifyRole } = require('../middleware/roleMiddleware'); // optional but recommended

// Admin-only: list users
router.get("/getUsers", verifyAccessToken, verifyRole('admin'), userController.getAllUsers);

// Authenticated: get single user (admin or owner)
router.get("/getUser/:id", verifyAccessToken, userController.getUser);

// Update: authenticated (you can add ownership/role checks in controller)
router.patch("/updateUser/:id", verifyAccessToken, userController.updateUser);

// Delete: admin only
router.delete("/deleteUser/:id", verifyAccessToken, verifyRole('admin'), userController.deleteUser);

module.exports = router;

