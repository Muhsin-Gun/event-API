const express = require("express");
const router = express.Router();
const userController = require("../controllers/usercontroller");
const { verifyAccessToken } = require("../helpers/jwtHelper");

router.get("/getUsers", verifyAccessToken, userController.getAllUsers);
router.get("/getUser/:id", verifyAccessToken, userController.getUser);
router.patch("/updateUser/:id", verifyAccessToken, userController.updateUser);
router.delete("/deleteUser/:id", verifyAccessToken, userController.deleteUser);

module.exports = router;
