const { Pool } = require('pg');
const config = require('./env');

const pool = new Pool({
  connectionString: config.databaseUrl,
  // Managed databases usually require SSL. rejectUnauthorized=false accepts their certificates without extra setup.
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

// Always use parameterized queries: query('SELECT * FROM users WHERE id = $1', [id])
const query = (text, params) => pool.query(text, params);

// Runs several queries as one atomic unit. Rolls back if the callback throws.
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
