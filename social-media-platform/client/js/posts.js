import { api } from './api.js';
import { h, timeAgo, fullDate, renderContent, assetUrl, validateImageFile, attachCounter, autoGrow } from './utils.js';
import { icon } from './icons.js';
import {
  avatar, toast, menu, openModal, confirmDialog, setBusy, skeletonPosts, emptyState, errorState, infiniteScroll,
} from './ui.js';

const POST_MAX = 500;

// ---------- a single post
export function postCard(initial, { me, detail = false, onDeleted } = {}) {
  const post = { ...initial };
  const article = h('article', { class: `card post${detail ? ' post-detail' : ''}`, dataset: { postId: post.id } });
  const likeCountEl = h('span', { class: 'action-count' });
  const commentCountEl = h('span', { class: 'action-count' });
  let liking = false;

  const likeButton = h('button', { class: 'action-btn', type: 'button', onclick: toggleLike }, icon('heart'), likeCountEl);
  const commentLink = h('a', { class: 'action-btn', href: `post.html?id=${post.id}#comments`, 'aria-label': 'View comments' }, icon('comment'), commentCountEl);

  function updateActions() {
    likeButton.classList.toggle('liked', post.likedByMe);
    likeButton.setAttribute('aria-pressed', String(post.likedByMe));
    likeButton.setAttribute('aria-label', post.likedByMe ? 'Unlike' : 'Like');
    likeCountEl.textContent = String(post.likeCount);
    commentCountEl.textContent = String(post.commentCount);
  }

  // Optimistic update: change the UI immediately, then confirm with the server, and revert on failure.
  async function toggleLike() {
    if (liking) return;
    liking = true;
    const previous = { liked: post.likedByMe, count: post.likeCount };
    post.likedByMe = !previous.liked;
    post.likeCount += previous.liked ? -1 : 1;
    updateActions();
    try {
      const result = previous.liked ? await api.posts.unlike(post.id) : await api.posts.like(post.id);
      post.likedByMe = result.likedByMe;
      post.likeCount = result.likeCount;
    } catch (err) {
      post.likedByMe = previous.liked;
      post.likeCount = previous.count;
      toast(err.message, 'error');
    } finally {
      liking = false;
      updateActions();
    }
  }

  function editPost() {
    const textarea = h('textarea', { class: 'input textarea', rows: 4, maxlength: POST_MAX, 'aria-label': 'Post text' });
    textarea.value = post.content;
    autoGrow(textarea);
    const counter = h('span', { class: 'counter' });
    attachCounter(textarea, counter, POST_MAX);
    const error = h('p', { class: 'field-error', role: 'alert' });
    const save = h('button', { class: 'btn btn-primary', type: 'submit' }, 'Save');
    const form = h('form', { novalidate: true }, textarea, error, h('div', { class: 'modal-actions' }, counter, save));
    const modal = openModal({ title: 'Edit post', content: form });
    textarea.focus();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const content = textarea.value.trim();
      if (!content && !post.imageUrl) {
        error.textContent = 'A post without an image needs some text.';
        return;
      }
      setBusy(save, true, 'Saving...');
      try {
        const result = await api.posts.update(post.id, content);
        Object.assign(post, result.post);
        draw();
        modal.close();
        toast('Post updated.', 'success');
      } catch (err) {
        error.textContent = err.details?.content || err.message;
        setBusy(save, false);
      }
    });
  }

  async function deletePost() {
    const confirmed = await confirmDialog({
      title: 'Delete post?', message: 'This permanently deletes the post along with its likes and comments.', confirmText: 'Delete', danger: true,
    });
    if (!confirmed) return;
    try {
      await api.posts.remove(post.id);
      toast('Post deleted.', 'success');
      article.classList.add('removing');
      setTimeout(() => article.remove(), 200);
      if (onDeleted) onDeleted(post);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function draw() {
    const profileHref = `profile.html?u=${encodeURIComponent(post.author.username)}`;
    const isOwner = me && post.author.id === me.id;
    const edited = new Date(post.updatedAt) - new Date(post.createdAt) > 1000;

    const header = h('header', { class: 'post-header' },
      h('a', { href: profileHref, tabindex: '-1', 'aria-hidden': 'true' }, avatar(post.author)),
      h('div', { class: 'post-meta' },
        h('a', { class: 'post-author', href: profileHref }, post.author.displayName),
        h('span', { class: 'muted post-handle' }, `@${post.author.username}`),
        h('span', { class: 'muted', 'aria-hidden': 'true' }, '·'),
        h('a', { class: 'muted post-time', href: `post.html?id=${post.id}` },
          h('time', { datetime: post.createdAt, title: fullDate(post.createdAt) }, timeAgo(post.createdAt))),
        edited ? h('span', { class: 'muted post-edited' }, '(edited)') : null),
      isOwner ? menu('Post options', [
        { label: 'Edit', icon: 'edit', onSelect: editPost },
        { label: 'Delete', icon: 'trash', danger: true, onSelect: deletePost },
      ]) : null);

    const image = post.imageUrl
      ? h('img', { src: assetUrl(post.imageUrl), alt: `Image posted by ${post.author.displayName}`, loading: 'lazy' })
      : null;

    article.replaceChildren(
      header,
      post.content ? h('p', { class: 'post-content' }, renderContent(post.content)) : null,
      image ? h(detail ? 'div' : 'a', { class: 'post-media', href: detail ? null : `post.html?id=${post.id}`, 'aria-label': detail ? null : 'Open post' }, image) : null,
      h('footer', { class: 'post-actions' }, likeButton, commentLink));
    updateActions();
  }

  draw();
  article.setCommentCount = (count) => { post.commentCount = count; updateActions(); };
  return article;
}

// ---------- composer (create a post)
let composerCount = 0;

export function createComposer({ me, onPosted, autofocus = false, placeholder = "What's on your mind?" }) {
  composerCount += 1;
  const fileId = `composer-file-${composerCount}`;
  let file = null;
  let previewUrl = null;

  const textarea = h('textarea', { class: 'composer-input', name: 'content', rows: 2, maxlength: POST_MAX, placeholder, 'aria-label': 'Post text' });
  autoGrow(textarea);
  const counter = h('span', { class: 'counter' });
  const updateCounter = attachCounter(textarea, counter, POST_MAX);
  const error = h('p', { class: 'field-error', role: 'alert' });
  const preview = h('div', { class: 'composer-preview', hidden: true });
  const fileInput = h('input', { type: 'file', id: fileId, class: 'visually-hidden', accept: 'image/jpeg,image/png,image/gif,image/webp', tabindex: '-1' });
  const imageButton = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Add an image', onclick: () => fileInput.click() }, icon('image'));
  const submit = h('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Post');

  function clearImage() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    file = null;
    fileInput.value = '';
    preview.replaceChildren();
    preview.hidden = true;
  }

  fileInput.addEventListener('change', () => {
    const chosen = fileInput.files[0];
    if (!chosen) return;
    const problem = validateImageFile(chosen);
    if (problem) {
      error.textContent = problem;
      fileInput.value = '';
      return;
    }
    error.textContent = '';
    clearImage();
    file = chosen;
    previewUrl = URL.createObjectURL(chosen);
    preview.hidden = false;
    preview.append(
      h('img', { src: previewUrl, alt: 'Preview of the image you are about to post' }),
      h('button', { class: 'icon-btn preview-remove', type: 'button', 'aria-label': 'Remove image', onclick: clearImage }, icon('x', 16)));
  });

  const form = h('form', { class: 'composer', novalidate: true },
    avatar(me),
    h('div', { class: 'composer-body' },
      textarea, preview, error,
      h('div', { class: 'composer-footer' },
        h('div', { class: 'composer-tools' }, imageButton, fileInput),
        h('div', { class: 'composer-tools' }, counter, submit))));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = textarea.value.trim();
    if (!content && !file) {
      error.textContent = 'Write something or add an image.';
      textarea.focus();
      return;
    }
    error.textContent = '';
    const data = new FormData();
    data.append('content', content);
    if (file) data.append('image', file);

    setBusy(submit, true, 'Posting...');
    try {
      const result = await api.posts.create(data);
      textarea.value = '';
      textarea.style.height = 'auto';
      updateCounter();
      clearImage();
      toast('Post published.', 'success');
      document.dispatchEvent(new CustomEvent('post:created', { detail: result.post }));
      if (onPosted) onPosted(result.post);
    } catch (err) {
      error.textContent = err.details?.content || err.message;
    } finally {
      setBusy(submit, false);
    }
  });

  if (autofocus) setTimeout(() => textarea.focus(), 0);
  return form;
}

export function openComposerModal(me) {
  let modal;
  const composer = createComposer({ me, autofocus: true, onPosted: () => modal.close() });
  modal = openModal({ title: 'New post', content: composer });
  return modal;
}

// ---------- a list of posts with infinite scroll
// fetchPage(page) resolves to { items, pagination }. emptyView() returns the node shown when there are no posts.
export function createPostList({ fetchPage, me, emptyView, onDeleted }) {
  const element = h('div', { class: 'post-list' });
  const itemsEl = h('div');
  const statusEl = h('div');
  const sentinel = h('div', { class: 'sentinel', 'aria-hidden': 'true' });
  element.append(itemsEl, statusEl, sentinel);

  const seen = new Set(); // offset pagination can repeat a post when new ones arrive, so de-duplicate by id
  let page = 1;
  let hasMore = true;
  let scroller;

  function showEmptyIfNeeded() {
    if (itemsEl.children.length === 0 && !hasMore) {
      statusEl.replaceChildren(emptyView ? emptyView() : emptyState({ title: 'Nothing here yet' }));
    }
  }

  function handleDeleted(post) {
    seen.delete(post.id);
    if (onDeleted) onDeleted(post);
    setTimeout(showEmptyIfNeeded, 260);
  }

  async function loadMore() {
    if (!hasMore) return false;
    statusEl.replaceChildren(page === 1 ? skeletonPosts(3) : h('div', { class: 'loading-more', role: 'status' }, 'Loading more...'));
    try {
      const data = await fetchPage(page);
      for (const post of data.items) {
        if (seen.has(post.id)) continue;
        seen.add(post.id);
        itemsEl.append(postCard(post, { me, onDeleted: handleDeleted }));
      }
      hasMore = data.pagination.hasMore;
      page += 1;
      statusEl.replaceChildren();
      showEmptyIfNeeded();
      return hasMore;
    } catch (err) {
      statusEl.replaceChildren(errorState(err.message, () => scroller.restart()));
      return false;
    }
  }

  scroller = infiniteScroll(sentinel, loadMore);

  return {
    element,
    reload() {
      itemsEl.replaceChildren();
      statusEl.replaceChildren();
      seen.clear();
      page = 1;
      hasMore = true;
      scroller.restart();
    },
    prepend(post) {
      if (seen.has(post.id)) return;
      seen.add(post.id);
      if (itemsEl.children.length === 0) statusEl.replaceChildren();
      itemsEl.prepend(postCard(post, { me, onDeleted: handleDeleted }));
    },
  };
}
