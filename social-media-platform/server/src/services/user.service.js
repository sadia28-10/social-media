const { query, withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { PUBLIC_USER_SQL, toProfile, toUserListItem, toAuthUser, USER_COLUMNS } = require('../utils/serializers');
const { toPage } = require('../utils/pagination');
const { escapeLike } = require('../utils/params');
const { saveImage, deleteUpload } = require('../utils/files');
const { createNotification } = require('./notification.service');

// $1 is always the viewer's id (used for isFollowing). Extra parameters start at $2.
const USER_ROW = `${PUBLIC_USER_SQL},
  EXISTS (SELECT 1 FROM follows fv WHERE fv.follower_id = $1 AND fv.following_id = u.id) AS is_following`;

async function fetchUsers(viewerId, { from, where, params = [], order }, page) {
  const values = [viewerId, ...params];
  const { rows } = await query(
    `SELECT ${USER_ROW} FROM ${from} WHERE ${where} ORDER BY ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, page.limit + 1, page.offset]
  );
  return toPage(rows, page, (row) => toUserListItem(row, viewerId));
}

async function getIdByUsername(username) {
  const { rows } = await query('SELECT id FROM users WHERE username = $1', [username]);
  if (!rows[0]) throw new AppError(404, 'User not found.');
  return rows[0].id;
}

async function getProfile(viewerId, username) {
  const { rows } = await query(
    `SELECT ${USER_ROW},
       (SELECT COUNT(*)::int FROM posts WHERE user_id = u.id)         AS post_count,
       (SELECT COUNT(*)::int FROM follows WHERE following_id = u.id) AS follower_count,
       (SELECT COUNT(*)::int FROM follows WHERE follower_id = u.id)  AS following_count
     FROM users u WHERE u.username = $2`,
    [viewerId, username]
  );
  if (!rows[0]) throw new AppError(404, 'User not found.');
  return toProfile(rows[0], viewerId);
}

async function updateProfile(userId, fields, file) {
  const current = await query('SELECT avatar_url FROM users WHERE id = $1', [userId]);
  const oldAvatar = current.rows[0].avatar_url;

  const sets = [];
  const values = [];
  const add = (column, value) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`); // column names are fixed literals, never user input
  };

  if (fields.displayName !== undefined) add('display_name', fields.displayName);
  if (fields.bio !== undefined) add('bio', fields.bio);
  if (fields.location !== undefined) add('location', fields.location);
  if (fields.website !== undefined) add('website', fields.website);

  let newAvatar = null;
  if (file) {
    newAvatar = await saveImage(file);
    add('avatar_url', newAvatar);
  } else if (fields.removeAvatar) {
    add('avatar_url', null);
  }

  if (sets.length === 0) throw new AppError(422, 'There is nothing to update.');

  values.push(userId);
  try {
    const { rows } = await query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING ${USER_COLUMNS}`,
      values
    );
    if (newAvatar || fields.removeAvatar) await deleteUpload(oldAvatar);
    return toAuthUser(rows[0]);
  } catch (err) {
    await deleteUpload(newAvatar);
    throw err;
  }
}

function search(viewerId, q, page) {
  const contains = `%${escapeLike(q)}%`;
  const prefix = `${escapeLike(q)}%`;
  return fetchUsers(
    viewerId,
    {
      from: 'users u',
      where: '(u.username ILIKE $2 OR u.display_name ILIKE $2)',
      params: [contains, prefix],
      order: '(u.username ILIKE $3) DESC, u.username ASC',
    },
    page
  );
}

// People you do not follow yet, most-followed first.
async function suggestions(viewerId, limit) {
  const { rows } = await query(
    `SELECT ${USER_ROW},
            (SELECT COUNT(*) FROM follows ff WHERE ff.following_id = u.id) AS popularity
       FROM users u
      WHERE u.id <> $1
        AND NOT EXISTS (SELECT 1 FROM follows fx WHERE fx.follower_id = $1 AND fx.following_id = u.id)
      ORDER BY popularity DESC, u.created_at DESC
      LIMIT $2`,
    [viewerId, limit]
  );
  return rows.map((row) => toUserListItem(row, viewerId));
}

async function followers(viewerId, username, page) {
  const targetId = await getIdByUsername(username);
  return fetchUsers(
    viewerId,
    { from: 'follows f JOIN users u ON u.id = f.follower_id', where: 'f.following_id = $2', params: [targetId], order: 'f.created_at DESC, f.id DESC' },
    page
  );
}

async function following(viewerId, username, page) {
  const targetId = await getIdByUsername(username);
  return fetchUsers(
    viewerId,
    { from: 'follows f JOIN users u ON u.id = f.following_id', where: 'f.follower_id = $2', params: [targetId], order: 'f.created_at DESC, f.id DESC' },
    page
  );
}

async function followerCount(db, userId) {
  const { rows } = await db.query('SELECT COUNT(*)::int AS count FROM follows WHERE following_id = $1', [userId]);
  return rows[0].count;
}

async function follow(viewerId, targetId) {
  if (viewerId === targetId) throw new AppError(400, 'You cannot follow yourself.');
  const target = await query('SELECT id FROM users WHERE id = $1', [targetId]);
  if (!target.rows[0]) throw new AppError(404, 'User not found.');

  return withTransaction(async (client) => {
    const inserted = await client.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT (follower_id, following_id) DO NOTHING RETURNING id',
      [viewerId, targetId]
    );
    if (inserted.rows[0]) {
      await createNotification(client, { recipientId: targetId, actorId: viewerId, type: 'follow' });
    }
    return { isFollowing: true, followerCount: await followerCount(client, targetId) };
  });
}

async function unfollow(viewerId, targetId) {
  const target = await query('SELECT id FROM users WHERE id = $1', [targetId]);
  if (!target.rows[0]) throw new AppError(404, 'User not found.');

  return withTransaction(async (client) => {
    await client.query('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [viewerId, targetId]);
    await client.query(
      "DELETE FROM notifications WHERE actor_id = $1 AND recipient_id = $2 AND type = 'follow'",
      [viewerId, targetId]
    );
    return { isFollowing: false, followerCount: await followerCount(client, targetId) };
  });
}

module.exports = {
  getIdByUsername, getProfile, updateProfile, search, suggestions, followers, following, follow, unfollow,
};
