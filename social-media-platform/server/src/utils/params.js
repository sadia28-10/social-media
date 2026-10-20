const AppError = require('./AppError');

function parseId(value) {
  if (!/^\d{1,9}$/.test(String(value)) || Number(value) < 1) {
    throw new AppError(400, 'Invalid id.');
  }
  return Number(value);
}

function parseUsername(value) {
  const username = String(value).toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(username)) throw new AppError(404, 'User not found.');
  return username;
}

// Escapes % _ \ so user text is matched literally inside ILIKE patterns.
const escapeLike = (text) => text.replace(/[\\%_]/g, '\\$&');

module.exports = { parseId, parseUsername, escapeLike };
