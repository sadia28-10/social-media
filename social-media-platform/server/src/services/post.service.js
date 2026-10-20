const { query } = require('../config/db');
const AppError = require('../utils/AppError');
const { toPost } = require('../utils/serializers');
const { toPage } = require('../utils/pagination');
const { escapeLike } = require('../utils/params');
const { saveImage, deleteUpload } = require('../utils/files');

const LIKE_COUNT = '(SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id)';
const COMMENT_COUNT = '(SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id)';
// $1 is always the id of the person viewing (used for likedByMe). Extra parameters start at $2.
const POST_SELECT = `
  SELECT p.id, p.content, p.image_url, p.created_at, p.updated_at,
         u.id AS author_id, u.username, u.display_name, u.avatar_url,
         ${LIKE_COUNT} AS like_count,
         ${COMMENT_COUNT} AS comment_count,
         EXISTS (SELECT 1 FROM likes lm WHERE lm.post_id = p.id AND lm.user_id = $1) AS liked_by_me
    FROM posts p
    JOIN users u ON u.id = p.user_id`;

const NEWEST_FIRST = 'p.created_at DESC, p.id DESC';
const MOST_POPULAR = `(${LIKE_COUNT} + 2 * ${COMMENT_COUNT}) DESC, p.id DESC`;

async function fetchPosts(viewerId, { where = 'TRUE', params = [], order = NEWEST_FIRST }, page) {
  const values = [viewerId, ...params];
  const { rows } = await query(
    `${POST_SELECT} WHERE ${where} ORDER BY ${order} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, page.limit + 1, page.offset]
  );
  return toPage(rows, page, toPost);
}

async function getPost(viewerId, postId) {
  const { rows } = await query(`${POST_SELECT} WHERE p.id = $2`, [viewerId, postId]);
  if (!rows[0]) throw new AppError(404, 'Post not found.');
  return toPost(rows[0]);
}

async function getPostOwnerId(postId) {
  const { rows } = await query('SELECT user_id FROM posts WHERE id = $1', [postId]);
  if (!rows[0]) throw new AppError(404, 'Post not found.');
  return rows[0].user_id;
}

async function createPost(user, content, file) {
  const imageUrl = await saveImage(file);
  try {
    const { rows } = await query(
      'INSERT INTO posts (user_id, content, image_url) VALUES ($1, $2, $3) RETURNING id',
      [user.id, content, imageUrl]
    );
    return await getPost(user.id, rows[0].id);
  } catch (err) {
    await deleteUpload(imageUrl); // do not leave orphaned files if the insert failed
    throw err;
  }
}

async function loadOwned(user, postId) {
  const { rows } = await query('SELECT user_id, image_url FROM posts WHERE id = $1', [postId]);
  if (!rows[0]) throw new AppError(404, 'Post not found.');
  if (rows[0].user_id !== user.id) throw new AppError(403, 'You can only change your own posts.');
  return rows[0];
}

async function updatePost(user, postId, content) {
  const existing = await loadOwned(user, postId);
  if (!content && !existing.image_url) {
    throw new AppError(422, 'Please fix the highlighted fields.', { content: 'A post without an image needs some text.' });
  }
  await query('UPDATE posts SET content = $1 WHERE id = $2', [content, postId]);
  return getPost(user.id, postId);
}

async function deletePost(user, postId) {
  const existing = await loadOwned(user, postId);
  await query('DELETE FROM posts WHERE id = $1', [postId]);
  await deleteUpload(existing.image_url);
}

function listPosts(viewerId, { q, sort, page }) {
  const params = [];
  let where = 'TRUE';
  if (q) {
    params.push(`%${escapeLike(q)}%`);
    where = 'p.content ILIKE $2';
  }
  return fetchPosts(viewerId, { where, params, order: sort === 'popular' ? MOST_POPULAR : NEWEST_FIRST }, page);
}

// Posts from the people I follow, plus my own.
function getFeed(viewerId, page) {
  return fetchPosts(
    viewerId,
    { where: '(p.user_id = $1 OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1))' },
    page
  );
}

function listByUser(viewerId, userId, page) {
  return fetchPosts(viewerId, { where: 'p.user_id = $2', params: [userId] }, page);
}

// Most-used #hashtags in the last 7 days.
async function trendingTopics(limit = 5) {
  const { rows } = await query(
    `SELECT lower(tag) AS tag, COUNT(*)::int AS uses
       FROM (
         SELECT (regexp_matches(content, '#([[:alnum:]_]{2,50})', 'g'))[1] AS tag
           FROM posts
          WHERE created_at > now() - interval '7 days'
       ) t
      GROUP BY lower(tag)
      ORDER BY uses DESC, tag
      LIMIT $1`,
    [limit]
  );
  return rows.map((row) => ({ tag: row.tag, count: row.uses }));
}

module.exports = {
  getPost, getPostOwnerId, createPost, updatePost, deletePost, listPosts, getFeed, listByUser, trendingTopics,
};
