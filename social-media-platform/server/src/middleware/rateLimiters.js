const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');

const build = (options) =>
  rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test',
    handler: (req, res, next) => next(new AppError(429, 'Too many requests. Please try again later.')),
    ...options,
  });

// Whole API, per IP: generous, protects against basic abuse.
const apiLimiter = build({ windowMs: 15 * 60 * 1000, limit: 600 });
// Login: only failed attempts count, so normal users are not locked out.
const loginLimiter = build({ windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true });
// Registration: stops mass account creation from one IP.
const registerLimiter = build({ windowMs: 60 * 60 * 1000, limit: 5 });
// Writes (posts, comments, likes, follows, uploads), per logged-in user. Must run after authentication.
const writeLimiter = build({
  windowMs: 60 * 1000,
  limit: 60,
  skip: (req) => process.env.NODE_ENV === 'test' || ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  keyGenerator: (req) => `user:${req.user.id}`,
});

module.exports = { apiLimiter, loginLimiter, registerLimiter, writeLimiter };
