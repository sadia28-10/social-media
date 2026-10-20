// Columns safe to load for the logged-in user. password_hash is deliberately absent.
const USER_COLUMNS = 'id, username, email, display_name, bio, avatar_url, website, location, created_at';
// Same idea for queries that alias the users table as "u". Never includes email.
const PUBLIC_USER_SQL = 'u.id, u.username, u.display_name, u.bio, u.avatar_url, u.website, u.location, u.created_at';

function toPublicUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    website: row.website,
    location: row.location,
    createdAt: row.created_at,
  };
}

// The logged-in user's own view: public fields plus their email.
function toAuthUser(row) {
  return { ...toPublicUser(row), email: row.email };
}

function toProfile(row, viewerId) {
  return {
    ...toPublicUser(row),
    postCount: row.post_count,
    followerCount: row.follower_count,
    followingCount: row.following_count,
    isFollowing: row.is_following,
    isMe: row.id === viewerId,
  };
}

function toUserListItem(row, viewerId) {
  return { ...toPublicUser(row), isFollowing: row.is_following, isMe: row.id === viewerId };
}

// Rows for posts, comments and notifications alias the author as author_id/username/display_name/avatar_url.
const toAuthor = (row) => ({
  id: row.author_id,
  username: row.username,
  displayName: row.display_name,
  avatarUrl: row.avatar_url,
});

function toPost(row) {
  return {
    id: row.id,
    content: row.content,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: toAuthor(row),
    likeCount: row.like_count,
    commentCount: row.comment_count,
    likedByMe: row.liked_by_me,
  };
}

function toComment(row) {
  return {
    id: row.id,
    postId: row.post_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: toAuthor(row),
  };
}

function toNotification(row) {
  return {
    id: row.id,
    type: row.type,
    isRead: row.is_read,
    createdAt: row.created_at,
    postId: row.post_id,
    postPreview: row.post_preview,
    actor: toAuthor(row),
  };
}

module.exports = {
  USER_COLUMNS, PUBLIC_USER_SQL, toPublicUser, toAuthUser, toProfile, toUserListItem, toPost, toComment, toNotification,
};
