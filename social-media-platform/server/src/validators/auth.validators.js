// Each validator returns { value, errors }. `value` is the cleaned input; `errors` maps field -> message.
const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Names that would clash with routes or look official.
const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'api', 'me', 'search', 'login', 'logout', 'register',
  'settings', 'notifications', 'explore', 'home', 'support', 'help', 'root',
  'suggestions', 'topics', 'feed', 'posts', 'users', 'comments',
]);

const text = (v) => (typeof v === 'string' ? v.trim() : '');

function validateRegister(body) {
  const errors = {};
  const username = text(body.username).toLowerCase();
  const email = text(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  const displayName = text(body.displayName) || username;

  if (!USERNAME_RE.test(username)) {
    errors.username = 'Use 3-30 characters: lowercase letters, numbers and underscores.';
  } else if (RESERVED_USERNAMES.has(username)) {
    errors.username = 'That username is reserved.';
  }

  if (email.length > 254 || !EMAIL_RE.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  // bcrypt only uses the first 72 bytes, so longer passwords are rejected instead of silently truncated.
  if (password.length < 8 || Buffer.byteLength(password) > 72) {
    errors.password = 'Password must be 8-72 characters.';
  } else if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = 'Password must include at least one letter and one number.';
  }

  if (displayName.length > 50) {
    errors.displayName = 'Display name can be at most 50 characters.';
  }

  return { value: { username, email, password, displayName }, errors };
}

function validateLogin(body) {
  const errors = {};
  const identifier = text(body.identifier).toLowerCase(); // email or username
  const password = typeof body.password === 'string' ? body.password : '';

  if (!identifier || identifier.length > 254) errors.identifier = 'Enter your email or username.';
  if (!password || Buffer.byteLength(password) > 72) errors.password = 'Enter your password.';

  return { value: { identifier, password }, errors };
}

module.exports = { validateRegister, validateLogin };
