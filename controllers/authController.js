const createError = require('http-errors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const { signAccessToken } = require('../helpers/jwtHelper');

module.exports.register = async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password) throw createError.BadRequest('username, email, password required');
    const exists = await User.findOne({ email });
    if (exists) throw createError.Conflict('Email already registered');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const user = await User.create({ username, email, password: hash, role });
    res.status(201).json({ message: 'User registered', user: { id: user._id, username, email, role } });
  } catch (err) {
    next(err);
  }
};

module.exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw createError.BadRequest('email and password required');
    const user = await User.findOne({ email });
    if (!user) throw createError.NotFound('User not found');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw createError.Unauthorized('Invalid password');
    const token = await signAccessToken(user._id);
    res.json({ message: 'Login successful', token, user: { id: user._id, username: user.username, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
};

module.exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) throw createError.NotFound('User not found');

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetJwt = jwt.sign(
      { id: user._id, token: resetToken },
      process.env.JWT_RESET_SECRET,
      { expiresIn: `${process.env.RESET_TOKEN_TTL_MINUTES || 30}m` }
    );

    // For production: email the link. For dev/testing, return link.
    const link = `${process.env.FRONTEND_URL}/reset-password?token=${resetJwt}`;
    return res.json({ message: 'Reset link generated', link });
  } catch (err) {
    next(err);
  }
};

module.exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    const payload = jwt.verify(token, process.env.JWT_RESET_SECRET);
    const user = await User.findById(payload.id);
    if (!user) throw createError.NotFound('User not found');

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
};



