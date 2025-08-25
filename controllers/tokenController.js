// controllers/tokenController.js
const createError = require('http-errors');
const { signAccessToken, verifyRefreshToken, signRefreshToken } = require('../helpers/jwtHelper');

module.exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw createError.BadRequest('refreshToken required');

    // verifyRefreshToken returns userId (aud)
    const userId = await verifyRefreshToken(refreshToken);
    if (!userId) throw createError.Unauthorized();

    const accessToken = await signAccessToken(userId);
    // optionally issue a new refresh token
    const newRefreshToken = await signRefreshToken(userId);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
};
