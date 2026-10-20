const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/auth.service');
const { toAuthUser } = require('../utils/serializers');
const { issueToken, setAuthCookie, clearAuthCookie } = require('../utils/tokens');

function startSession(res, user, status) {
  const { token, csrf } = issueToken(user.id);
  setAuthCookie(res, token);
  res.status(status).json({ success: true, data: { user: toAuthUser(user), csrfToken: csrf } });
}

exports.register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  startSession(res, user, 201);
});

exports.login = asyncHandler(async (req, res) => {
  const user = await authService.login(req.body);
  startSession(res, user, 200);
});

exports.logout = (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, data: { message: 'Logged out.' } });
};

// Called by the frontend on every page load to restore the session and get a fresh copy of the CSRF token.
exports.me = (req, res) => {
  res.json({ success: true, data: { user: toAuthUser(req.user), csrfToken: req.csrfToken } });
};
