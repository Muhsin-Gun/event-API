// helpers/jwtHelper.js
const JWT = require('jsonwebtoken');
const createError = require('http-errors');

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
const JWT_RESET_SECRET = process.env.JWT_RESET_SECRET;
const RESET_TTL_MINUTES = process.env.RESET_TOKEN_TTL_MINUTES || '30m';

// quick sanity checks (helpful during dev)
if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET || !JWT_RESET_SECRET) {
  console.warn(
    '⚠️  JWT secrets are not fully configured. Make sure ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET and JWT_RESET_SECRET are set in your .env'
  );
}

// ---- Sign access token (includes role in payload; audience is userId) ----
module.exports.signAccessToken = (userId, role = 'client') => {
  return new Promise((resolve, reject) => {
    if (!ACCESS_TOKEN_SECRET) return reject(createError.InternalServerError('Missing ACCESS_TOKEN_SECRET'));
    const payload = { role };
    const options = {
      expiresIn: process.env.ACCESS_TOKEN_TTL || '1d', // ✅ changed to 1 day
      issuer: process.env.TOKEN_ISSUER || 'event-api',
      audience: String(userId),
    };
    JWT.sign(payload, ACCESS_TOKEN_SECRET, options, (err, token) => {
      if (err) return reject(createError.InternalServerError('Could not sign access token'));
      resolve(token);
    });
  });
};

// ---- Verify access token middleware (for protected routes) ----
module.exports.verifyAccessToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader) return next(createError.Unauthorized('Authorization header missing'));

    const parts = String(authHeader).split(' ');
    if (parts.length !== 2 || !/^Bearer$/i.test(parts[0])) return next(createError.Unauthorized('Invalid Authorization header'));

    const token = parts[1];
    JWT.verify(token, ACCESS_TOKEN_SECRET, (err, payload) => {
      if (err) {
        const message = err.name === 'JsonWebTokenError' ? 'Unauthorized' : err.message;
        return next(createError.Unauthorized(message));
      }
      req.payload = {
        aud: payload.aud || payload.audience || payload.sub,
        role: payload.role || null,
        iat: payload.iat,
        exp: payload.exp,
      };
      next();
    });
  } catch (err) {
    next(createError.InternalServerError());
  }
};

// ---- Refresh tokens ----
module.exports.signRefreshToken = (userId) => {
  return new Promise((resolve, reject) => {
    if (!REFRESH_TOKEN_SECRET) return reject(createError.InternalServerError('Missing REFRESH_TOKEN_SECRET'));
    const options = {
      expiresIn: process.env.REFRESH_TOKEN_TTL || '1d', // ✅ changed to 1 day
      issuer: process.env.TOKEN_ISSUER || 'event-api',
      audience: String(userId),
    };
    JWT.sign({}, REFRESH_TOKEN_SECRET, options, (err, token) => {
      if (err) return reject(createError.InternalServerError('Could not sign refresh token'));
      resolve(token);
    });
  });
};

module.exports.verifyRefreshToken = (refreshToken) => {
  return new Promise((resolve, reject) => {
    if (!REFRESH_TOKEN_SECRET) return reject(createError.InternalServerError('Missing REFRESH_TOKEN_SECRET'));
    JWT.verify(refreshToken, REFRESH_TOKEN_SECRET, (err, payload) => {
      if (err) return reject(createError.Unauthorized('Invalid refresh token'));
      const userId = payload.aud || payload.audience || payload.sub;
      if (!userId) return reject(createError.Unauthorized('Invalid refresh token payload'));
      resolve(userId);
    });
  });
};

// ---- Password reset tokens (one-time use, in-memory) ----
const resetTokenStore = new Set();

module.exports.generatePasswordResetToken = (userId) => {
  if (!JWT_RESET_SECRET) throw new Error('Missing JWT_RESET_SECRET');
  const token = JWT.sign({}, JWT_RESET_SECRET, {
    expiresIn: `${RESET_TTL_MINUTES}m`.includes('m') ? `${RESET_TTL_MINUTES}m` : `${RESET_TTL_MINUTES}m`,
    issuer: process.env.TOKEN_ISSUER || 'event-api',
    audience: String(userId),
  });
  resetTokenStore.add(token);
  return token;
};

module.exports.verifyPasswordResetToken = (token) => {
  return new Promise((resolve, reject) => {
    if (!JWT_RESET_SECRET) return reject(createError.InternalServerError('Missing JWT_RESET_SECRET'));
    JWT.verify(token, JWT_RESET_SECRET, (err, payload) => {
      if (err) return reject(createError.BadRequest('Invalid or expired token'));
      if (!resetTokenStore.has(token)) return reject(createError.BadRequest('Token already used or invalid'));
      resetTokenStore.delete(token);
      const userId = payload.aud || payload.audience || payload.sub;
      if (!userId) return reject(createError.BadRequest('Invalid token payload'));
      resolve({ userId });
    });
  });
};
