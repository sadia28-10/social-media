const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { pool, setupDatabase, closeDatabase, registerUser, send } = require('./helpers');

before(setupDatabase);
after(closeDatabase);

async function makePost(agent, content = 'a post') {
  const res = await send(agent, 'post', '/api/posts', { content });
  return res.body.data.post;
}

test('comments: create, validate, and only the author can edit or delete', async () => {
  const author = await registerUser('c_author');
  const commenter = await registerUser('c_commenter');
  const post = await makePost(author);

  assert.equal((await send(commenter, 'post', `/api/posts/${post.id}/comments`, { content: '   ' })).status, 422);
  assert.equal((await send(commenter, 'post', `/api/posts/${post.id}/comments`, { content: 'x'.repeat(301) })).status, 422);
  assert.equal((await send(commenter, 'post', '/api/posts/999999/comments', { content: 'hi' })).status, 404);

  const created = await send(commenter, 'post', `/api/posts/${post.id}/comments`, { content: 'Nice post' });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.commentCount, 1);
  const commentId = created.body.data.comment.id;

  // The post author is not the comment author, so they cannot change it either.
  assert.equal((await send(author, 'patch', `/api/comments/${commentId}`, { content: 'changed' })).status, 403);
  assert.equal((await send(author, 'delete', `/api/comments/${commentId}`)).status, 403);

  const edited = await send(commenter, 'patch', `/api/comments/${commentId}`, { content: 'Edited' });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.data.comment.content, 'Edited');

  const list = await author.get(`/api/posts/${post.id}/comments`);
  assert.equal(list.body.data.items.length, 1);
  assert.equal(list.body.data.items[0].author.username, 'c_commenter');

  const removed = await send(commenter, 'delete', `/api/comments/${commentId}`);
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.commentCount, 0);
});

test('likes are unique per user and can be removed', async () => {
  const author = await registerUser('l_author');
  const fan = await registerUser('l_fan');
  const post = await makePost(author);

  const first = await send(fan, 'post', `/api/posts/${post.id}/like`);
  const second = await send(fan, 'post', `/api/posts/${post.id}/like`);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.body.data.likeCount, 1);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM likes WHERE post_id = $1', [post.id]);
  assert.equal(rows[0].n, 1);

  const seen = await fan.get(`/api/posts/${post.id}`);
  assert.equal(seen.body.data.post.likedByMe, true);

  const unliked = await send(fan, 'delete', `/api/posts/${post.id}/like`);
  assert.equal(unliked.body.data.likeCount, 0);
  assert.equal(unliked.body.data.likedByMe, false);
});

test('follows are unique, self-follow is blocked, and counts are correct', async () => {
  const a = await registerUser('f_a');
  const b = await registerUser('f_b');

  const self = await send(a, 'post', `/api/users/${a.user.id}/follow`);
  assert.equal(self.status, 400);

  await send(a, 'post', `/api/users/${b.user.id}/follow`);
  const again = await send(a, 'post', `/api/users/${b.user.id}/follow`);
  assert.equal(again.status, 200);
  assert.equal(again.body.data.followerCount, 1);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM follows WHERE follower_id = $1 AND following_id = $2', [a.user.id, b.user.id]);
  assert.equal(rows[0].n, 1);

  // The database itself also refuses a self-follow, even if the API check were bypassed.
  await assert.rejects(pool.query('INSERT INTO follows (follower_id, following_id) VALUES ($1, $1)', [a.user.id]));

  const profile = await a.get('/api/users/f_b');
  assert.equal(profile.body.data.user.followerCount, 1);
  assert.equal(profile.body.data.user.isFollowing, true);
  assert.equal(profile.body.data.user.email, undefined); // other people's emails stay private

  const followers = await a.get('/api/users/f_b/followers');
  assert.equal(followers.body.data.items[0].username, 'f_a');
  const following = await a.get('/api/users/f_a/following');
  assert.equal(following.body.data.items[0].username, 'f_b');

  const unfollowed = await send(a, 'delete', `/api/users/${b.user.id}/follow`);
  assert.equal(unfollowed.body.data.followerCount, 0);
  assert.equal((await send(a, 'post', '/api/users/999999/follow')).status, 404);
});

test('users can only edit their own profile, with validation', async () => {
  const a = await registerUser('p_a');
  await registerUser('p_b');

  const bad = await send(a, 'patch', '/api/users/me', { bio: 'x'.repeat(161), website: 'javascript:alert(1)' });
  assert.equal(bad.status, 422);
  assert.ok(bad.body.error.details.bio);
  assert.ok(bad.body.error.details.website);

  const good = await send(a, 'patch', '/api/users/me', { displayName: 'Alice A', bio: 'Hello', website: 'example.com', location: 'Lahore' });
  assert.equal(good.status, 200);
  assert.equal(good.body.data.user.displayName, 'Alice A');
  assert.equal(good.body.data.user.website, 'https://example.com');

  // There is no endpoint to modify another user's profile: /users/:username only supports GET.
  const other = await send(a, 'patch', '/api/users/p_b', { displayName: 'Hacked' });
  assert.equal(other.status, 404);
  const check = await a.get('/api/users/p_b');
  assert.notEqual(check.body.data.user.displayName, 'Hacked');
});

test('user search and suggestions', async () => {
  const me = await registerUser('s_me');
  await registerUser('s_findable');
  const found = await me.get('/api/users/search?q=findab');
  assert.equal(found.body.data.items.length, 1);
  assert.equal(found.body.data.items[0].username, 's_findable');

  assert.equal((await me.get('/api/users/search?q=zzzzzzzz')).body.data.items.length, 0);
  assert.equal((await me.get('/api/users/search?q=')).status, 400);

  const suggestions = await me.get('/api/users/suggestions');
  assert.equal(suggestions.status, 200);
  assert.equal(suggestions.body.data.items.some((u) => u.username === 's_me'), false);
});

test('notifications: created for follow, like and comment, unread count, mark as read', async () => {
  const owner = await registerUser('n_owner');
  const actor = await registerUser('n_actor');
  const post = await makePost(owner, 'notify me #testing');

  await send(actor, 'post', `/api/users/${owner.user.id}/follow`);
  await send(actor, 'post', `/api/posts/${post.id}/like`);
  await send(actor, 'post', `/api/posts/${post.id}/comments`, { content: 'hey' });
  await send(owner, 'post', `/api/posts/${post.id}/like`); // liking your own post notifies nobody

  const list = await owner.get('/api/notifications');
  assert.equal(list.status, 200);
  assert.equal(list.body.data.unreadCount, 3);
  assert.deepEqual(list.body.data.items.map((n) => n.type).sort(), ['comment', 'follow', 'like']);

  // Another user cannot mark my notification as read.
  const id = list.body.data.items[0].id;
  assert.equal((await send(actor, 'patch', `/api/notifications/${id}/read`)).status, 404);

  const read = await send(owner, 'patch', `/api/notifications/${id}/read`);
  assert.equal(read.body.data.unreadCount, 2);

  const all = await send(owner, 'patch', '/api/notifications/read-all');
  assert.equal(all.body.data.unreadCount, 0);

  const topics = await owner.get('/api/posts/topics');
  assert.equal(topics.body.data.items[0].tag, 'testing');
});
