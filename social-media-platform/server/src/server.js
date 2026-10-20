const config = require('./config/env');
const app = require('./app');
const { pool } = require('./config/db');

async function start() {
  try {
    await pool.query('SELECT 1'); // fail fast with a clear message if PostgreSQL is unreachable
  } catch (err) {
    console.error('Could not connect to PostgreSQL. Check DATABASE_URL in server/.env.\n', err.message);
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port} (${config.nodeEnv})`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
