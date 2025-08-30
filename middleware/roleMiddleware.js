// middleware/roleMiddleware.js
const createError = require('http-errors');
const User = require('../models/user');

module.exports.verifyRole = (allowed = []) => {
  const allowedRoles = Array.isArray(allowed) ? allowed : [allowed];
  return async (req, res, next) => {
    try {
      if (!req.payload || !req.payload.aud) return next(createError.Unauthorized());
      // Prefer role from access token payload to reduce DB hits; fall back to DB if not present.
      let role = req.payload.role;
      if (!role) {
        const u = await User.findById(req.payload.aud).select('role');
        if (!u) return next(createError.Unauthorized());
        role = u.role;
      }
      if (!allowedRoles.includes(role)) return next(createError.Forbidden('Insufficient privileges'));
      req.user = { id: req.payload.aud, role };
      next();
    } catch (err) {
      next(err);
    }
  };
};

