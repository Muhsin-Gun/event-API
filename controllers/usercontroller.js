const User = require('../models/user');
const createError = require('http-errors');
const mongoose = require('mongoose');

module.exports = {
  getAllUsers: async (req, res, next) => {
    try {
      const page = Math.max(parseInt(req.query.page || '1', 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);

      const [items, total] = await Promise.all([
        User.find({}).select('-password').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
        User.countDocuments({})
      ]);

      res.json({ data: items, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
      console.log(error.message);
      next(error);
    }
  },

  getUser: async (req, res, next) => {
    const id = req.params.id;
    try {
      if (!mongoose.isValidObjectId(id)) return next(createError.BadRequest('Invalid user id'));
      const user = await User.findById(id).select('-password');
      if (!user) throw createError(404, 'User does not exist');
      res.send(user);
    } catch (error) {
      console.log(error.message);
      next(error);
    }
  },

  updateUser: async (req, res, next) => {
    try {
      const id = req.params.id;
      const update = req.body;
      const options = { new: true };
      const result = await User.findByIdAndUpdate(id, update, options).select('-password');
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
      if (!user) throw createError(404, 'User does not exist');
      res.send(user);
    } catch (error) {
      console.log(error.message);
      next(error);
    }
  }
};
