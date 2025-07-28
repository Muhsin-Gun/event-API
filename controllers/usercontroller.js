// controllers/userController.js
const User = require('../models/user');
const createError = require('http-errors');
const mongoose = require('mongoose');

module.exports = {
  getAllUsers: async (req, res, next) => {
    try {
      const users = await User.find({});
      res.send(users);
    } catch (error) {
      console.log(error.message);
      next(error);
    }
  },

  getUser: async (req, res, next) => {
    const id = req.params.id;
    try {
      const user = await User.findById(id);
      if (!user) {
        throw createError(404, 'User does not exist');
      }
      res.send(user);
    } catch (error) {
      console.log(error.message);
      if (error instanceof mongoose.CastError) {
        next(createError(400, 'Invalid user id'));
        return;
      }
      next(error);
    }
  },

  updateUser: async (req, res, next) => {
    try {
      const id = req.params.id;
      const update = req.body;
      const options = { new: true };
      const result = await User.findByIdAndUpdate(id, update, options);
      res.send(result);
    } catch (error) {
      console.log(error.message);
      next(error);
    }
  },

  deleteUser: async (req, res, next) => {
    const id = req.params.id;
    try {
      const user = await User.findByIdAndDelete(id);
      if (!user) {
        throw createError(404, 'User does not exist');
      }
      res.send(user);
    } catch (error) {
      console.log(error.message);
      if (error instanceof mongoose.CastError) {
        next(createError(400, 'Invalid user id'));
        return;
      }
      next(error);
    }
  }
};
