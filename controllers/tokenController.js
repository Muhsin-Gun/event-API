// controllers/tokenController.js
const createError = require('http-errors');
const { signAccessToken, verifyRefreshToken, signRefreshToken } = require('../helpers/jwtHelper');
const User = require('../models/user');

module.exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw createError.BadRequest('refreshToken required');

    // verifyRefreshToken returns userId (aud)
    const userId = await verifyRefreshToken(refreshToken);
    if (!userId) throw createError.Unauthorized();

    // fetch user role so access token includes the right role
    const user = await User.findById(userId).select('role');
    if (!user) throw createError.Unauthorized();

    const accessToken = await signAccessToken(userId, user.role);
    const newRefreshToken = await signRefreshToken(userId);

    res.json({ success: true, accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
};

