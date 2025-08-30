// controllers/usercontroller.js
const User = require('../models/user');
const createError = require('http-errors');
const mongoose = require('mongoose');

async function getAllUsers(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '10', 10), 1), 100);
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.search) {
      const q = req.query.search;
      filter.$or = [
        { username: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    res.json({ data: items, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
}

async function getUser(req, res, next) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return next(createError.BadRequest('Invalid user id'));
    const user = await User.findById(id).select('-password');
    if (!user) throw createError.NotFound('User does not exist');
    res.send(user);
  } catch (error) {
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return next(createError.BadRequest('Invalid user id'));

    const requesterId = req.payload?.aud;
    if (!requesterId) return next(createError.Unauthorized());

    const requester = await User.findById(requesterId).select('role');
    if (!requester) return next(createError.Unauthorized());

    const update = { ...req.body };
    delete update.password; // never here

    // only admin may change role
    if (update.role && requester.role !== 'admin') delete update.role;

    // only admin or owner may update profile
    if (String(requesterId) !== String(id) && requester.role !== 'admin') {
      return next(createError.Forbidden('Not allowed'));
    }

    const options = { new: true };
    const result = await User.findByIdAndUpdate(id, update, options).select('-password');
    if (!result) throw createError.NotFound('User not found');
    res.send(result);
  } catch (error) {
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const id = req.params.id;
    if (!mongoose.isValidObjectId(id)) return next(createError.BadRequest('Invalid user id'));
    const user = await User.findByIdAndDelete(id);
    if (!user) throw createError.NotFound('User does not exist');
    res.json({ message: 'User deleted', user: { id: user._id, email: user.email, username: user.username } });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAllUsers, getUser, updateUser, deleteUser };


