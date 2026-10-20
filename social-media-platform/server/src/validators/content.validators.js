// Validators for posts, comments and profiles. Each returns { value, errors }.
const text = (v) => (typeof v === 'string' ? v.trim() : '');

const POST_MAX = 500;
const COMMENT_MAX = 300;

function validatePostCreate(body, req) {
  const errors = {};
  const content = text(body.content);
  if (content.length > POST_MAX) errors.content = `Posts can be at most ${POST_MAX} characters.`;
  else if (!content && !(req && req.file)) errors.content = 'Write something or add an image.';
  return { value: { content }, errors };
}

function validatePostUpdate(body) {
  const errors = {};
  const content = text(body.content);
  if (content.length > POST_MAX) errors.content = `Posts can be at most ${POST_MAX} characters.`;
  return { value: { content }, errors };
}

function validateComment(body) {
  const errors = {};
  const content = text(body.content);
  if (!content) errors.content = 'Comment cannot be empty.';
  else if (content.length > COMMENT_MAX) errors.content = `Comments can be at most ${COMMENT_MAX} characters.`;
  return { value: { content }, errors };
}

// Only fields that were sent are validated and updated (PATCH semantics).
function validateProfile(body) {
  const errors = {};
  const value = {};

  if (body.displayName !== undefined) {
    const displayName = text(body.displayName);
    if (!displayName || displayName.length > 50) errors.displayName = 'Display name must be 1-50 characters.';
    value.displayName = displayName;
  }
  if (body.bio !== undefined) {
    const bio = text(body.bio);
    if (bio.length > 160) errors.bio = 'Bio can be at most 160 characters.';
    value.bio = bio;
  }
  if (body.location !== undefined) {
    const location = text(body.location);
    if (location.length > 80) errors.location = 'Location can be at most 80 characters.';
    value.location = location || null;
  }
  if (body.website !== undefined) {
    let website = text(body.website);
    if (website) {
      if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
      try {
        const url = new URL(website);
        if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) throw new Error('bad url');
        if (website.length > 200) throw new Error('too long');
      } catch (err) {
        errors.website = 'Enter a valid website address (max 200 characters).';
      }
    }
    value.website = website || null;
  }
  value.removeAvatar = body.removeAvatar === 'true' || body.removeAvatar === true;

  return { value, errors };
}

module.exports = { validatePostCreate, validatePostUpdate, validateComment, validateProfile };
