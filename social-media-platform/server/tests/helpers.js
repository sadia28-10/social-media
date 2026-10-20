// Shared test setup. Tests run against a real PostgreSQL database named in TEST_DATABASE_URL.
// The database name must contain "test" because every test file wipes the tables.
const os = require('os');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

process.env.NODE_ENV = 'test';
if (!process.env.TEST_DATABASE_URL) {
  throw new Error('Set TEST_DATABASE_URL in server/.env (a separate, empty database, e.g. social_platform_test).');
}
const dbName = new URL(process.env.TEST_DATABASE_URL).pathname;
if (!/test/i.test(dbName)) {
  throw new Error(`Refusing to run: TEST_DATABASE_URL database "${dbName}" must contain "test" (tests delete all data).`);
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-that-is-at-least-32-characters-long';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'social-platform-test-uploads');

const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/config/db');
const { runMigrations } = require('../src/scripts/migrate');

async function setupDatabase() {
  await runMigrations();
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
}

async function closeDatabase() {
  await pool.end();
}

// A supertest agent keeps cookies between requests, like a browser tab.
async function registerUser(username) {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ username, email: `${username}@example.com`, password: 'password123' });
  if (res.status !== 201) throw new Error(`Could not register ${username}: ${JSON.stringify(res.body)}`);
  agent.csrf = res.body.data.csrfToken;
  agent.user = res.body.data.user;
  return agent;
}

// Sends a state-changing request with the CSRF header attached.
const send = (agent, method, url, body) => {
  const req = agent[method](url).set('X-CSRF-Token', agent.csrf);
  return body === undefined ? req : req.send(body);
};

// 1x1 transparent PNG
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

module.exports = { app, request, pool, setupDatabase, closeDatabase, registerUser, send, TINY_PNG };
