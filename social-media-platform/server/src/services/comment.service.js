const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { toComment } = require('../utils/serializers');
const { toPage } = require('../utils/pagination');
const { getPostOwnerId } = require('./post.service');
const { createNotification } = require('./notification.service');

const COMMENT_SELECT = `
  SELECT c.id, c.post_id, c.content, c.created_at, c.updated_at,
         u.id AS author_id, u.username, u.display_name, u.avatar_url
    FROM comments c
    JOIN users u ON u.id = c.user_id`;

async function countComments(db, postId) {
  const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM comments WHERE post_id = $1', [postId]);
  return rows[0].count;
}

// Oldest first, like a conversation.
async function list(postId, page) {
  await getPostOwnerId(postId); // 404 if the post does not exist
  const { rows } = await query(
    `${COMMENT_SELECT} WHERE c.post_id = $1 ORDER BY c.created_at ASC, c.id ASC LIMIT $2 OFFSET $3`,
    [postId, page.limit + 1, page.offset]
  );
  return toPage(rows, page, toComment);
}

async function create(user, postId, content) {
  const ownerId = await getPostOwnerId(postId);
  return withTransaction(async (client) => {
    const inserted = await client.query(
      'INSERT INTO comments (post_id, user_id, content) VALUES ($1, $2, $3) RETURNING id',
      [postId, user.id, content]
    );
    await createNotification(client, { recipientId: ownerId, actorId: user.id, type: 'comment', postId });
    const { rows } = await client.query(`${COMMENT_SELECT} WHERE c.id = $1`, [inserted.rows[0].id]);
    return { comment: toComment(rows[0]), commentCount: await countComments(client, postId) };
  });
}

async function loadOwned(user, commentId) {
  const { rows } = await query('SELECT user_id, post_id FROM comments WHERE id = $1', [commentId]);
  if (!rows[0]) throw new AppError(404, 'Comment not found.');
  if (rows[0].user_id !== user.id) throw new AppError(403, 'You can only change your own comments.');
  return rows[0];
}

async function update(user, commentId, content) {
  await loadOwned(user, commentId);
  await query('UPDATE comments SET content = $1 WHERE id = $2', [content, commentId]);
  const { rows } = await query(`${COMMENT_SELECT} WHERE c.id = $1`, [commentId]);
  return toComment(rows[0]);
}

async function remove(user, commentId) {
  const existing = await loadOwned(user, commentId);
  await query('DELETE FROM comments WHERE id = $1', [commentId]);
  return { commentCount: await countComments({ query }, existing.post_id) };
}

module.exports = { list, create, update, remove };
