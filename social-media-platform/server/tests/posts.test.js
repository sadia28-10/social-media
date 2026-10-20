const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { setupDatabase, closeDatabase, registerUser, send, TINY_PNG } = require('./helpers');

before(setupDatabase);
after(closeDatabase);

test('users can create text posts, and invalid posts are rejected', async () => {
  const alice = await registerUser('alice');
  const created = await send(alice, 'post', '/api/posts', { content: '  Hello world  ' });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.post.content, 'Hello world');
  assert.equal(created.body.data.post.author.username, 'alice');
  assert.equal(created.body.data.post.likeCount, 0);

  assert.equal((await send(alice, 'post', '/api/posts', { content: '   ' })).status, 422);
  assert.equal((await send(alice, 'post', '/api/posts', { content: 'x'.repeat(501) })).status, 422);
});

test('only the author can edit or delete a post', async () => {
  const owner = await registerUser('owner');
  const other = await registerUser('other');
  const { body } = await send(owner, 'post', '/api/posts', { content: 'mine' });
  const id = body.data.post.id;

  assert.equal((await send(other, 'patch', `/api/posts/${id}`, { content: 'hacked' })).status, 403);
  assert.equal((await send(other, 'delete', `/api/posts/${id}`)).status, 403);

  const edited = await send(owner, 'patch', `/api/posts/${id}`, { content: 'edited' });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.data.post.content, 'edited');

  assert.equal((await send(owner, 'delete', `/api/posts/${id}`)).status, 200);
  assert.equal((await owner.get(`/api/posts/${id}`)).status, 404);
  assert.equal((await send(owner, 'delete', `/api/posts/${id}`)).status, 404);
});

test('image uploads validate the file type and are cleaned up on delete', async () => {
  const user = await registerUser('uploader');

  const fake = await user
    .post('/api/posts')
    .set('X-CSRF-Token', user.csrf)
    .field('content', 'fake image')
    .attach('image', Buffer.from('this is not an image at all'), { filename: 'evil.png', contentType: 'image/png' });
  assert.equal(fake.status, 415);

  const wrongMime = await user
    .post('/api/posts')
    .set('X-CSRF-Token', user.csrf)
    .field('content', 'text file')
    .attach('image', Buffer.from('hello world, plain text'), { filename: 'a.txt', contentType: 'text/plain' });
  assert.equal(wrongMime.status, 415);

  const real = await user
    .post('/api/posts')
    .set('X-CSRF-Token', user.csrf)
    .field('content', 'real image')
    .attach('image', TINY_PNG, { filename: 'pixel.png', contentType: 'image/png' });
  assert.equal(real.status, 201);
  const { imageUrl, id } = real.body.data.post;
  assert.match(imageUrl, /^\/uploads\/[a-f0-9]{32}\.png$/);

  const onDisk = path.join(process.env.UPLOAD_DIR, path.basename(imageUrl));
  assert.equal(fs.existsSync(onDisk), true);
  assert.equal((await user.get(imageUrl)).status, 200);

  await send(user, 'delete', `/api/posts/${id}`);
  assert.equal(fs.existsSync(onDisk), false);
});

test('the personalised feed shows followed users and my own posts, newest first, with pagination', async () => {
  const me = await registerUser('feed_me');
  const friend = await registerUser('feed_friend');
  const stranger = await registerUser('feed_stranger');

  await send(me, 'post', `/api/users/${friend.user.id}/follow`);

  await send(friend, 'post', '/api/posts', { content: 'friend 1' });
  await send(stranger, 'post', '/api/posts', { content: 'stranger 1' });
  await send(friend, 'post', '/api/posts', { content: 'friend 2' });
  await send(me, 'post', '/api/posts', { content: 'me 1' });
  await send(friend, 'post', '/api/posts', { content: 'friend 3' });

  const page1 = await me.get('/api/feed?limit=2&page=1');
  assert.equal(page1.status, 200);
  assert.deepEqual(page1.body.data.items.map((p) => p.content), ['friend 3', 'me 1']);
  assert.equal(page1.body.data.pagination.hasMore, true);

  const page2 = await me.get('/api/feed?limit=2&page=2');
  assert.deepEqual(page2.body.data.items.map((p) => p.content), ['friend 2', 'friend 1']);
  assert.equal(page2.body.data.pagination.hasMore, false);

  const all = await me.get('/api/feed?limit=50');
  assert.equal(all.body.data.items.some((p) => p.content === 'stranger 1'), false);
});

test('search finds posts by text and popular sorting uses engagement', async () => {
  const a = await registerUser('searcher');
  const b = await registerUser('searchee');
  const quiet = await send(a, 'post', '/api/posts', { content: 'quiet zebra post' });
  const loud = await send(b, 'post', '/api/posts', { content: 'loud zebra post' });
  await send(a, 'post', `/api/posts/${loud.body.data.post.id}/like`);
  await send(a, 'post', `/api/posts/${loud.body.data.post.id}/comments`, { content: 'nice' });

  const found = await a.get('/api/posts?q=zebra');
  assert.equal(found.body.data.items.length, 2);
  const none = await a.get('/api/posts?q=nonexistentword');
  assert.equal(none.body.data.items.length, 0);

  const popular = await a.get('/api/posts?q=zebra&sort=popular');
  assert.equal(popular.body.data.items[0].id, loud.body.data.post.id);
  assert.equal(popular.body.data.items[1].id, quiet.body.data.post.id);
});
