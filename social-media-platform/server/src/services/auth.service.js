const bcrypt = require('bcrypt');
const { query } = require('../config/db');
const AppError = require('../utils/AppError');
const { USER_COLUMNS } = require('../utils/serializers');

const BCRYPT_COST = process.env.NODE_ENV === 'test' ? 4 : 12; // low cost only in tests, for speed
// Compared against when the account does not exist, so response time does not reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

async function register({ username, email, password, displayName }) {
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  try {
    const { rows } = await query(
      `INSERT INTO users (username, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING ${USER_COLUMNS}`,
      [username, email, passwordHash, displayName]
    );
    return rows[0];
  } catch (err) {
    // 23505 = unique_violation. The database is the final guard against race conditions.
    if (err.code === '23505') {
      const field = (err.constraint || '').includes('email') ? 'email' : 'username';
      throw new AppError(409, `That ${field} is already in use.`, { [field]: `That ${field} is already in use.` });
    }
    throw err;
  }
}

async function login({ identifier, password }) {
  // Usernames cannot contain "@", so an identifier can only match one kind of account.
  const { rows } = await query(
    `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = $1 OR username = $1`,
    [identifier]
  );
  const row = rows[0];
  const passwordMatches = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
  if (!row || !passwordMatches) {
    throw new AppError(401, 'Invalid email/username or password.');
  }
  return row;
}

module.exports = { register, login };
