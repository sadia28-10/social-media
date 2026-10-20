const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, setupDatabase, closeDatabase, registerUser, send } = require('./helpers');

before(setupDatabase);
after(closeDatabase);

const valid = { username: 'newuser', email: 'newuser@example.com', password: 'password123' };

test('registration creates a user, sets an HttpOnly cookie and never exposes the password hash', async () => {
  const res = await request(app).post('/api/auth/register').send(valid);
  assert.equal(res.status, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.user.username, 'newuser');
  assert.ok(res.body.data.csrfToken);
  assert.equal(JSON.stringify(res.body).includes('password'), false);
  const cookie = res.headers['set-cookie'].join(';');
  assert.match(cookie, /access_token=/);
  assert.match(cookie, /HttpOnly/i);
});

test('registration rejects duplicate username and duplicate email', async () => {
  const dupUsername = await request(app).post('/api/auth/register').send({ ...valid, email: 'other@example.com' });
  assert.equal(dupUsername.status, 409);
  assert.ok(dupUsername.body.error.details.username);

  const dupEmail = await request(app).post('/api/auth/register').send({ ...valid, username: 'someone_else' });
  assert.equal(dupEmail.status, 409);
  assert.ok(dupEmail.body.error.details.email);
});

test('registration validates username, email and password', async () => {
  const res = await request(app).post('/api/auth/register').send({ username: 'a', email: 'nope', password: 'short' });
  assert.equal(res.status, 422);
  assert.ok(res.body.error.details.username);
  assert.ok(res.body.error.details.email);
  assert.ok(res.body.error.details.password);
});

test('login works with username or email (case-insensitive) and rejects bad credentials', async () => {
  const byUsername = await request(app).post('/api/auth/login').send({ identifier: 'newuser', password: 'password123' });
  assert.equal(byUsername.status, 200);
  const byEmail = await request(app).post('/api/auth/login').send({ identifier: 'NewUser@Example.com', password: 'password123' });
  assert.equal(byEmail.status, 200);

  const wrongPassword = await request(app).post('/api/auth/login').send({ identifier: 'newuser', password: 'wrongpass1' });
  const unknownUser = await request(app).post('/api/auth/login').send({ identifier: 'ghost_user', password: 'password123' });
  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownUser.status, 401);
  assert.equal(wrongPassword.body.error.message, unknownUser.body.error.message); // no account enumeration
});

test('protected endpoints reject requests without a session', async () => {
  assert.equal((await request(app).get('/api/auth/me')).status, 401);
  assert.equal((await request(app).get('/api/feed')).status, 401);
  assert.equal((await request(app).get('/api/posts')).status, 401);
});

test('a logged-in user can read /me and log out', async () => {
  const agent = await registerUser('session_user');
  const me = await agent.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.data.user.username, 'session_user');
  assert.ok(me.body.data.csrfToken);

  const logout = await agent.post('/api/auth/logout');
  assert.equal(logout.status, 200);
  assert.equal((await agent.get('/api/auth/me')).status, 401);
});

test('state-changing requests without a valid CSRF token are rejected', async () => {
  const agent = await registerUser('csrf_user');
  const missing = await agent.post('/api/posts').send({ content: 'hello' });
  assert.equal(missing.status, 403);
  const wrong = await agent.post('/api/posts').set('X-CSRF-Token', 'not-the-token').send({ content: 'hello' });
  assert.equal(wrong.status, 403);
  const good = await send(agent, 'post', '/api/posts', { content: 'hello' });
  assert.equal(good.status, 201);
});
