// controllers/authController.js
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const createError = require('http-errors');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
} = require('../helpers/jwtHelper');

module.exports.register = async (req, res, next) => {
  try {
    const { username, email, password /* role ignored for security */ } = req.body;
    if (!username || !email || !password) throw createError.BadRequest('username, email, password required');

    const existing = await User.findOne({ email });
    if (existing) throw createError.Conflict('Email already in use');

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hash, role: 'client' }); // default to client

    res.status(201).json({
      message: 'User registered',
      user: { id: user._id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
};

module.exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw createError.BadRequest('email and password required');

    const user = await User.findOne({ email });
    // generic error to avoid user enumeration
    if (!user) throw createError.Unauthorized('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw createError.Unauthorized('Invalid credentials');

    // include role in access token payload
    const accessToken = await signAccessToken(user._id, user.role);
    const refreshToken = await signRefreshToken(user._id);

    res.json({
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: { id: user._id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
};

module.exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw createError.BadRequest('refreshToken required');

    const userId = await verifyRefreshToken(refreshToken);
    // fetch role so we can re-issue access token with role claim
    const user = await User.findById(userId).select('role');
    if (!user) throw createError.Unauthorized();

    const accessToken = await signAccessToken(userId, user.role);
    const newRefreshToken = await signRefreshToken(userId);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
};

// Do not reveal whether email exists
module.exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw createError.BadRequest('email required');

    const user = await User.findOne({ email });
    let resetLink;
    if (user) {
      const token = generatePasswordResetToken(user._id);
      resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
      // TODO: send email with resetLink
    }

    res.json({
      message: 'If that account exists, a reset link has been sent',
      // dev convenience (omit in prod):
      link: resetLink,
    });
  } catch (err) {
    next(err);
  }
};

module.exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) throw createError.BadRequest('token and newPassword required');

    const { userId } = await verifyPasswordResetToken(token);

    const user = await User.findById(userId);
    if (!user) throw createError.NotFound('User not found');

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
};





