// helpers/jwtHelper.js
const JWT = require('jsonwebtoken');
const createError = require('http-errors');

// ------ Access / Refresh Tokens ------

module.exports.signAccessToken = (userId, role) => {
  return new Promise((resolve, reject) => {
    const payload = { role };
    const secret = process.env.ACCESS_TOKEN_SECRET;
    const options = {
      expiresIn: '1h',
      issuer: 'event-api',
      audience: userId.toString(),
    };
    JWT.sign(payload, secret, options, (err, token) => {
      if (err) return reject(createError.InternalServerError());
      resolve(token);
    });
  });
};

module.exports.verifyAccessToken = (req, res, next) => {
  if (!req.headers['authorization']) return next(createError.Unauthorized());
  const authHeader = req.headers['authorization'];
  const parts = authHeader.split(' ');
  if (parts.length !== 2) return next(createError.Unauthorized());
  const token = parts[1];

  JWT.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, payload) => {
    if (err) {
      const message = err.name === 'JsonWebTokenError' ? 'Unauthorized' : err.message;
      return next(createError.Unauthorized(message));
    }
    req.payload = payload; // { aud: userId, role }
    next();
  });
};

module.exports.signRefreshToken = (userId) => {
  return new Promise((resolve, reject) => {
    const secret = process.env.REFRESH_TOKEN_SECRET;
    const options = { expiresIn: '7d', issuer: 'event-api', audience: userId.toString() };
    JWT.sign({}, secret, options, (err, token) => {
      if (err) return reject(createError.InternalServerError());
      resolve(token);
    });
  });
};

module.exports.verifyRefreshToken = (refreshToken) => {
  return new Promise((resolve, reject) => {
    JWT.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, payload) => {
      if (err) return reject(createError.Unauthorized());
      resolve(payload.aud); // userId
    });
  });
};

// ------ Password Reset (one-time) ------
// Lightweight one-time store (memory). For production, back this with a DB or cache.
const resetTokenStore = new Set();

module.exports.generatePasswordResetToken = (userId) => {
  const token = JWT.sign({}, process.env.JWT_RESET_SECRET, {
    expiresIn: `${process.env.RESET_TOKEN_TTL_MINUTES || 30}m`,
    issuer: 'event-api',
    audience: userId.toString(),
  });
  resetTokenStore.add(token);
  return token;
};

module.exports.verifyPasswordResetToken = (token) => {
  return new Promise((resolve, reject) => {
    JWT.verify(token, process.env.JWT_RESET_SECRET, (err, payload) => {
      if (err) return reject(createError.BadRequest('Invalid or expired token'));
      if (!resetTokenStore.has(token)) return reject(createError.BadRequest('Token already used or invalid'));
      resetTokenStore.delete(token); // one-time use
      resolve({ userId: payload.aud });
    });
  });
};


