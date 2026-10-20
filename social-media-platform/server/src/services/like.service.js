const { query, withTransaction } = require('../config/db');
const { getPostOwnerId } = require('./post.service');
const { createNotification } = require('./notification.service');

async function likeCount(db, postId) {
  const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM likes WHERE post_id = $1', [postId]);
  return rows[0].count;
}

// Liking twice is harmless: the UNIQUE(post_id, user_id) constraint keeps a single row.
async function like(user, postId) {
  const ownerId = await getPostOwnerId(postId);
  return withTransaction(async (client) => {
    const inserted = await client.query(
      'INSERT INTO likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT (post_id, user_id) DO NOTHING RETURNING id',
      [postId, user.id]
    );
    if (inserted.rows[0]) {
      await createNotification(client, { recipientId: ownerId, actorId: user.id, type: 'like', postId });
    }
    return { likedByMe: true, likeCount: await likeCount(client, postId) };
  });
}

async function unlike(user, postId) {
  await getPostOwnerId(postId);
  return withTransaction(async (client) => {
    await client.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [postId, user.id]);
    // Remove the notification so like/unlike/like does not stack up duplicates.
    await client.query(
      "DELETE FROM notifications WHERE actor_id = $1 AND post_id = $2 AND type = 'like'",
      [user.id, postId]
    );
    return { likedByMe: false, likeCount: await likeCount(client, postId) };
  });
}

module.exports = { like, unlike, likeCount: (postId) => likeCount({ query }, postId) };
