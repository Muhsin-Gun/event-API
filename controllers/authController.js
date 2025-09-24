// controllers/authController.js
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  generatePasswordResetToken,
  verifyPasswordResetToken,
} = require('../helpers/jwtHelper');

// ------------------- REGISTER -------------------
module.exports.register = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password required',
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: 'Email already in use' });
    }

    const hash = await bcrypt.hash(password, 10);

    // allow explicit role, default to client
    const userRole =
      role && ['admin', 'employee', 'client'].includes(role)
        ? role
        : 'client';

    const user = await User.create({
      username,
      email,
      password: hash,
      role: userRole,
    });

    const accessToken = await signAccessToken(user._id, user.role);
    const refreshToken = await signRefreshToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      token: accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ------------------- LOGIN -------------------
module.exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(401)
        .json({ success: false, message: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res
        .status(401)
        .json({ success: false, message: 'Invalid credentials' });

    const accessToken = await signAccessToken(user._id, user.role);
    const refreshToken = await signRefreshToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      token: accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ------------------- REFRESH TOKEN -------------------
module.exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res
        .status(400)
        .json({ success: false, message: 'refreshToken required' });
    }

    const userId = await verifyRefreshToken(refreshToken);
    const user = await User.findById(userId).select('role');
    if (!user)
      return res.status(401).json({ success: false, message: 'Unauthorized' });

    const accessToken = await signAccessToken(userId, user.role);
    const newRefreshToken = await signRefreshToken(userId);

    res.json({ success: true, accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ------------------- FORGOT PASSWORD -------------------
module.exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: 'Email required' });

    const user = await User.findOne({ email });
    let resetLink;
    if (user) {
      const token = generatePasswordResetToken(user._id);
      resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
      // TODO: send email in production
    }

    res.json({
      success: true,
      message: 'If that account exists, a reset link has been sent',
      link: resetLink, // optional for dev
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ------------------- RESET PASSWORD -------------------
module.exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Token and newPassword required',
      });
    }

    const { userId } = await verifyPasswordResetToken(token);

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
