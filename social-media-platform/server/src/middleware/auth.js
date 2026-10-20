const crypto = require('crypto');
const { query } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { COOKIE_NAME, verifyToken, clearAuthCookie } = require('../utils/tokens');
const { USER_COLUMNS } = require('../utils/serializers');

// Reads the JWT from the HttpOnly cookie and loads the current user from the database.
const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies[COOKIE_NAME];
  if (!token) throw new AppError(401, 'Please log in to continue.');

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    clearAuthCookie(res);
    throw new AppError(401, 'Your session has expired. Please log in again.');
  }

  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [payload.sub]);
  if (!rows[0]) {
    clearAuthCookie(res);
    throw new AppError(401, 'This account no longer exists.');
  }

  req.user = rows[0];
  req.csrfToken = payload.csrf;
  next();
});

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

// Must run after requireAuth. Rejects POST/PATCH/DELETE requests without the matching CSRF token.
function requireCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const header = req.get('X-CSRF-Token');
  if (!header || !req.csrfToken || !safeEqual(header, req.csrfToken)) {
    throw new AppError(403, 'Invalid or missing CSRF token.');
  }
  next();
}

// Use as: router.post('/posts', protect, handler)
const protect = [requireAuth, requireCsrf];

module.exports = { requireAuth, requireCsrf, protect };
