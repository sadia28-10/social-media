const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

const COOKIE_NAME = 'access_token';

const cookieBase = {
  httpOnly: true, // JavaScript cannot read the cookie, which limits the damage of an XSS bug
  secure: config.cookie.secure,
  sameSite: config.cookie.sameSite,
  path: '/',
};

// The JWT carries the user id and a random CSRF token. The CSRF token is also returned in the
// JSON body, and the client must echo it back in an X-CSRF-Token header on state-changing requests.
function issueToken(userId) {
  const csrf = crypto.randomBytes(24).toString('hex');
  const token = jwt.sign({ sub: String(userId), csrf }, config.jwt.secret, {
    algorithm: 'HS256',
    expiresIn: config.jwt.expiresInSeconds,
  });
  return { token, csrf };
}

function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { ...cookieBase, maxAge: config.jwt.expiresInSeconds * 1000 });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieBase);
}

module.exports = { COOKIE_NAME, issueToken, verifyToken, setAuthCookie, clearAuthCookie };
