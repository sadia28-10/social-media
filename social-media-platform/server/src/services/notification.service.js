const { query } = require('../config/db');
const AppError = require('../utils/AppError');
const { toNotification } = require('../utils/serializers');
const { toPage } = require('../utils/pagination');

// `db` is either the pool or a transaction client, so callers can include this in their transaction.
async function createNotification(db, { recipientId, actorId, type, postId = null }) {
  if (recipientId === actorId) return; // never notify people about their own actions
  await db.query(
    'INSERT INTO notifications (recipient_id, actor_id, type, post_id) VALUES ($1, $2, $3, $4)',
    [recipientId, actorId, type, postId]
  );
}

async function list(userId, page) {
  const { rows } = await query(
    `SELECT n.id, n.type, n.is_read, n.created_at, n.post_id, LEFT(p.content, 80) AS post_preview,
            u.id AS author_id, u.username, u.display_name, u.avatar_url
       FROM notifications n
       JOIN users u ON u.id = n.actor_id
       LEFT JOIN posts p ON p.id = n.post_id
      WHERE n.recipient_id = $1
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT $2 OFFSET $3`,
    [userId, page.limit + 1, page.offset]
  );
  return toPage(rows, page, toNotification);
}

async function unreadCount(userId) {
  const { rows } = await query(
    'SELECT COUNT(*)::int AS count FROM notifications WHERE recipient_id = $1 AND NOT is_read',
    [userId]
  );
  return rows[0].count;
}

async function markRead(userId, notificationId) {
  const { rowCount } = await query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND recipient_id = $2',
    [notificationId, userId]
  );
  // Someone else's notification looks exactly like a missing one.
  if (rowCount === 0) throw new AppError(404, 'Notification not found.');
}

async function markAllRead(userId) {
  await query('UPDATE notifications SET is_read = true WHERE recipient_id = $1 AND NOT is_read', [userId]);
}

module.exports = { createNotification, list, unreadCount, markRead, markAllRead };
