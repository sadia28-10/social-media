import { initLayout } from './layout.js';
import { api } from './api.js';
import { h, getParam, monthYear, attachCounter, validateImageFile } from './utils.js';
import { icon } from './icons.js';
import { avatar, emptyState, errorState, flash, openModal, setBusy, showFieldErrors, skeletonPosts } from './ui.js';
import { createPostList } from './posts.js';
import { followButton, openUserListModal } from './users.js';

const me = await initLayout({ active: 'profile-auto' });
if (me) start(me);

function openEditProfile(profile) {
  let avatarFile = null;
  let previewUrl = null;
  const preview = h('div', { class: 'edit-avatar' }, avatar(profile, 'lg'));
  const fileInput = h('input', { type: 'file', name: 'avatar', id: 'avatar-input', class: 'visually-hidden', accept: 'image/jpeg,image/png,image/gif,image/webp' });
  const removeBox = h('input', { type: 'checkbox', id: 'remove-avatar', name: 'removeAvatar' });
  const avatarError = h('p', { class: 'field-error', id: 'avatar-error', 'data-error-for': 'avatar', role: 'alert' });

  fileInput.addEventListener('change', () => {
    const chosen = fileInput.files[0];
    if (!chosen) return;
    const problem = validateImageFile(chosen);
    if (problem) {
      fileInput.value = '';
      avatarError.textContent = problem;
      return;
    }
    avatarError.textContent = '';
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(chosen);
    avatarFile = chosen;
    removeBox.checked = false;
    preview.replaceChildren(h('img', { class: 'avatar avatar-lg', src: previewUrl, alt: 'Preview of your new profile picture' }));
  });

  const field = (name, label, control, extra) => h('div', { class: 'field' },
    h('label', { for: name }, label), control, extra || null,
    h('p', { class: 'field-error', id: `${name}-error`, 'data-error-for': name, role: 'alert' }));

  const displayName = h('input', { class: 'input', id: 'displayName', name: 'displayName', maxlength: 50, required: true });
  displayName.value = profile.displayName;
  const bio = h('textarea', { class: 'input textarea', id: 'bio', name: 'bio', rows: 3, maxlength: 160 });
  bio.value = profile.bio || '';
  const bioCounter = h('span', { class: 'counter' });
  attachCounter(bio, bioCounter, 160);
  const location = h('input', { class: 'input', id: 'location', name: 'location', maxlength: 80 });
  location.value = profile.location || '';
  const website = h('input', { class: 'input', id: 'website', name: 'website', maxlength: 200, placeholder: 'example.com' });
  website.value = profile.website || '';
  const formError = h('p', { class: 'form-error', role: 'alert' });
  const save = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save changes');

  const form = h('form', { novalidate: true },
    h('div', { class: 'edit-avatar-row' }, preview,
      h('div', {},
        h('label', { class: 'btn btn-outline btn-sm', for: 'avatar-input' }, 'Choose photo'), fileInput,
        profile.avatarUrl ? h('label', { class: 'checkbox' }, removeBox, 'Remove current photo') : null,
        avatarError)),
    field('displayName', 'Display name', displayName),
    field('bio', 'Bio', bio, h('div', { class: 'form-row' }, bioCounter)),
    field('location', 'Location (optional)', location),
    field('website', 'Website (optional)', website),
    formError,
    h('div', { class: 'modal-actions' }, save));

  const modal = openModal({ title: 'Edit profile', content: form, onClose: () => previewUrl && URL.revokeObjectURL(previewUrl) });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    formError.textContent = '';
    if (!displayName.value.trim()) {
      showFieldErrors(form, { displayName: 'Display name is required.' });
      displayName.focus();
      return;
    }
    showFieldErrors(form, {});
    const data = new FormData();
    data.append('displayName', displayName.value.trim());
    data.append('bio', bio.value);
    data.append('location', location.value);
    data.append('website', website.value);
    if (avatarFile) data.append('avatar', avatarFile);
    else if (removeBox.checked) data.append('removeAvatar', 'true');

    setBusy(save, true, 'Saving...');
    try {
      await api.users.updateMe(data);
      flash('Profile updated.');
      window.location.reload();
    } catch (err) {
      if (Object.keys(err.details).length) showFieldErrors(form, err.details);
      else formError.textContent = err.message;
      setBusy(save, false);
      modal.dialog.querySelector('[aria-invalid="true"]')?.focus();
    }
  });
}

function buildHeader(profile) {
  const postCountEl = h('strong', {}, String(profile.postCount));
  const followerCountEl = h('strong', {}, String(profile.followerCount));
  const followingCountEl = h('strong', {}, String(profile.followingCount));

  const action = profile.isMe
    ? h('button', { class: 'btn btn-outline', type: 'button', onclick: () => openEditProfile(profile) }, icon('edit', 16), 'Edit profile')
    : followButton(profile, { onChange: (result) => { profile.followerCount = result.followerCount; followerCountEl.textContent = String(result.followerCount); } });

  const meta = [];
  if (profile.location) meta.push(h('span', { class: 'meta-item' }, icon('pin', 16), profile.location));
  if (profile.website && /^https?:\/\//i.test(profile.website)) {
    meta.push(h('span', { class: 'meta-item' }, icon('link', 16),
      h('a', { href: profile.website, target: '_blank', rel: 'noopener noreferrer nofollow', class: 'inline-link' }, profile.website.replace(/^https?:\/\//i, ''))));
  }
  meta.push(h('span', { class: 'meta-item' }, icon('calendar', 16), `Joined ${monthYear(profile.createdAt)}`));

  const stat = (countEl, label, onClick) => (onClick
    ? h('button', { class: 'stat stat-button', type: 'button', onclick: onClick }, countEl, ` ${label}`)
    : h('span', { class: 'stat' }, countEl, ` ${label}`));

  const element = h('section', { class: 'card profile-card', 'aria-label': 'Profile' },
    h('div', { class: 'profile-top' }, avatar(profile, 'xl'), action),
    h('h1', { class: 'profile-name' }, profile.displayName),
    h('p', { class: 'muted' }, `@${profile.username}`),
    profile.bio ? h('p', { class: 'profile-bio' }, profile.bio) : null,
    h('div', { class: 'profile-meta' }, meta),
    h('div', { class: 'profile-stats' },
      stat(postCountEl, 'posts'),
      stat(followerCountEl, 'followers', () => openUserListModal({ title: 'Followers', emptyTitle: 'No followers yet', fetchPage: (page) => api.users.followers(profile.username, page) })),
      stat(followingCountEl, 'following', () => openUserListModal({ title: 'Following', emptyTitle: 'Not following anyone yet', fetchPage: (page) => api.users.following(profile.username, page) }))));

  return { element, postCountEl };
}

async function start(user) {
  const main = document.getElementById('main');
  const username = (getParam('u') || user.username).toLowerCase();
  main.replaceChildren(skeletonPosts(1));

  let profile;
  try {
    ({ user: profile } = await api.users.get(username));
  } catch (err) {
    main.replaceChildren(err.status === 404
      ? emptyState({ iconName: 'user', title: 'User not found', message: `We could not find @${username}.`, action: h('a', { class: 'btn btn-primary', href: 'index.html' }, 'Back to home') })
      : errorState(err.message, () => window.location.reload()));
    return;
  }

  document.title = `${profile.displayName} (@${profile.username}) · Circle`;
  const header = buildHeader(profile);
  const setPostCount = (delta) => {
    profile.postCount += delta;
    header.postCountEl.textContent = String(profile.postCount);
  };

  const list = createPostList({
    me: user,
    fetchPage: (page) => api.users.posts(profile.username, page),
    onDeleted: () => setPostCount(-1),
    emptyView: () => emptyState({
      iconName: 'edit',
      title: profile.isMe ? 'You have not posted yet' : 'No posts yet',
      message: profile.isMe ? 'Use the New post button to share your first post.' : `@${profile.username} has not posted anything yet.`,
    }),
  });

  if (profile.isMe) {
    document.addEventListener('post:created', (event) => {
      list.prepend(event.detail);
      setPostCount(1);
    });
  }

  main.replaceChildren(header.element, h('h2', { class: 'section-title' }, 'Posts'), list.element);
}
