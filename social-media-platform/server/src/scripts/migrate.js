// Applies every .sql file in database/migrations that has not run yet, in filename order.
const fs = require('fs');
const path = require('path');
const { pool, withTransaction } = require('../config/db');

const migrationsDir = path.join(__dirname, '../../../database/migrations');

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((row) => row.name));
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });
    console.log(`Applied ${file}`);
    count += 1;
  }
  return count;
}

module.exports = { runMigrations };

if (require.main === module) {
  runMigrations()
    .then((count) => console.log(count === 0 ? 'Database already up to date.' : `Done. ${count} migration(s) applied.`))
    .catch((err) => {
      console.error('Migration failed:', err.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
