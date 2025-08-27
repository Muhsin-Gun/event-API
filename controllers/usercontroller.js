// controllers/userController.js
const User = require('../models/user');
const createError = require('http-errors');
const mongoose = require('mongoose');

async function getAllUsers(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
    const skip = (page - 1) * limit;

    // optional search filter
    const filter = {};
    if (req.query.search) {
      const q = req.query.search;
      filter.$or = [
        { username: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ];
    }

    const [items, total] = await Promise.all([
      User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter)
    ]);

    res.json({
      data: items,
      meta: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.log('getAllUsers error:', error.message);
    next(error);
  }
}

async function getUser(req, res, next) {
  const id = req.params.id;
  try {
    if (!mongoose.isValidObjectId(id)) return next(createError.BadRequest('Invalid user id'));
    const user = await User.findById(id).select('-password');
    if (!user) throw createError.NotFound('User does not exist');
    res.send(user);
  } catch (error) {
    console.log('getUser error:', error.message);
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return next(createError.BadRequest('Invalid user id'));

    // Optional: prevent non-admin from changing role or other protected fields
    // If you want: check req.payload.aud (user id) and req.user.role (if you attached user via role middleware)
    // Example:
    // if (req.payload.aud !== id && req.user.role !== 'admin') return next(createError.Forbidden('Not allowed'));

    const update = { ...req.body };
    // Do not allow password changes here — use dedicated password reset/change endpoint
    delete update.password;

    const options = { new: true };
    const result = await User.findByIdAndUpdate(id, update, options).select('-password');
    if (!result) throw createError.NotFound('User not found');
    res.send(result);
  } catch (error) {
    console.log('updateUser error:', error.message);
    next(error);
  }
}

async function deleteUser(req, res, next) {
  const id = req.params.id;
  try {
    if (!mongoose.isValidObjectId(id)) return next(createError.BadRequest('Invalid user id'));

    const user = await User.findByIdAndDelete(id);
    if (!user) throw createError.NotFound('User does not exist');

    res.json({ message: 'User deleted', user: { id: user._id, email: user.email, username: user.username } });
  } catch (error) {
    console.log('deleteUser error:', error.message);
    next(error);
  }
}

module.exports = {
  getAllUsers,
  getUser,
  updateUser,
  deleteUser
};
