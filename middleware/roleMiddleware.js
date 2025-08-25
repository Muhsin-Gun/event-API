// middleware/roleMiddleware.js
const createError = require('http-errors');
const User = require('../models/user');

module.exports.verifyRole = (allowedRoles = []) => {
  // allowedRoles can be a string or array
  if (typeof allowedRoles === 'string') allowedRoles = [allowedRoles];

  return async (req, res, next) => {
    try {
      // jwtHelper.verifyAccessToken attaches payload to req.payload
      if (!req.payload || !req.payload.aud) return next(createError.Unauthorized());

      const userId = req.payload.aud;
      const user = await User.findById(userId).select('role');
      if (!user) return next(createError.Unauthorized());

      if (!allowedRoles.includes(user.role)) {
        return next(createError.Forbidden('Insufficient privileges'));
      }

      // attach user role (optional)
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
};
