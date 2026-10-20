import { api } from './api.js';
import { h, timeAgo, fullDate, attachCounter, autoGrow } from './utils.js';
import { avatar, toast, menu, confirmDialog, setBusy, skeletonUsers, emptyState, errorState } from './ui.js';

const COMMENT_MAX = 300;

function commentItem(initial, { me, onRemoved, onCountChange }) {
  const comment = { ...initial };
  const node = h('article', { class: 'comment', dataset: { commentId: comment.id } });

  function draw() {
    const profileHref = `profile.html?u=${encodeURIComponent(comment.author.username)}`;
    const edited = new Date(comment.updatedAt) - new Date(comment.createdAt) > 1000;
    const isOwner = me && comment.author.id === me.id;

    node.replaceChildren(
      h('a', { href: profileHref, tabindex: '-1', 'aria-hidden': 'true' }, avatar(comment.author, 'sm')),
      h('div', { class: 'comment-main' },
        h('div', { class: 'comment-head' },
          h('a', { class: 'post-author', href: profileHref }, comment.author.displayName),
          h('span', { class: 'muted' }, `@${comment.author.username}`),
          h('span', { class: 'muted', 'aria-hidden': 'true' }, '·'),
          h('time', { class: 'muted', datetime: comment.createdAt, title: fullDate(comment.createdAt) }, timeAgo(comment.createdAt)),
          edited ? h('span', { class: 'muted' }, '(edited)') : null),
        h('p', { class: 'comment-body' }, comment.content)),
      isOwner ? menu('Comment options', [
        { label: 'Edit', icon: 'edit', onSelect: startEdit },
        { label: 'Delete', icon: 'trash', danger: true, onSelect: remove },
      ]) : null);
  }

  function startEdit() {
    const textarea = h('textarea', { class: 'input textarea', rows: 2, maxlength: COMMENT_MAX, 'aria-label': 'Edit comment' });
    textarea.value = comment.content;
    autoGrow(textarea);
    const counter = h('span', { class: 'counter' });
    attachCounter(textarea, counter, COMMENT_MAX);
    const error = h('p', { class: 'field-error', role: 'alert' });
    const save = h('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Save');
    const cancel = h('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: draw }, 'Cancel');
    const form = h('form', { class: 'comment-edit', novalidate: true }, textarea, error, h('div', { class: 'form-row' }, counter, cancel, save));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const content = textarea.value.trim();
      if (!content) { error.textContent = 'Comment cannot be empty.'; return; }
      setBusy(save, true, 'Saving...');
      try {
        const result = await api.comments.update(comment.id, content);
        Object.assign(comment, result.comment);
        draw();
      } catch (err) {
        error.textContent = err.details?.content || err.message;
        setBusy(save, false);
      }
    });
    node.replaceChildren(avatar(comment.author, 'sm'), h('div', { class: 'comment-main' }, form));
    textarea.focus();
  }

  async function remove() {
    const confirmed = await confirmDialog({ title: 'Delete comment?', message: 'This cannot be undone.', confirmText: 'Delete', danger: true });
    if (!confirmed) return;
    try {
      const result = await api.comments.remove(comment.id);
      node.remove();
      toast('Comment deleted.', 'success');
      onCountChange(result.commentCount);
      onRemoved(comment);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  draw();
  return node;
}

// Builds the comment form and the paginated comment list inside `container`.
export function initComments(container, { postId, me, onCountChange = () => {} }) {
  const seen = new Set();
  let page = 1;

  const textarea = h('textarea', { class: 'input textarea', name: 'content', rows: 2, maxlength: COMMENT_MAX, placeholder: 'Write a comment...', 'aria-label': 'Write a comment' });
  autoGrow(textarea);
  const counter = h('span', { class: 'counter' });
  const updateCounter = attachCounter(textarea, counter, COMMENT_MAX);
  const error = h('p', { class: 'field-error', role: 'alert' });
  const submit = h('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Reply');
  const form = h('form', { class: 'comment-form', novalidate: true },
    avatar(me, 'sm'),
    h('div', { class: 'comment-form-body' }, textarea, error, h('div', { class: 'form-row' }, counter, submit)));

  const listEl = h('div', { class: 'comment-list' });
  const statusEl = h('div');
  const moreButton = h('button', { class: 'btn btn-ghost btn-block', type: 'button', hidden: true, onclick: () => load() }, 'Load more comments');

  function showEmptyIfNeeded() {
    if (listEl.children.length === 0) {
      statusEl.replaceChildren(emptyState({ iconName: 'comment', title: 'No comments yet', message: 'Start the conversation.' }));
    }
  }

  function addToList(comment) {
    if (seen.has(comment.id)) return;
    seen.add(comment.id);
    listEl.append(commentItem(comment, {
      me,
      onCountChange,
      onRemoved: (removed) => { seen.delete(removed.id); showEmptyIfNeeded(); },
    }));
  }

  async function load() {
    moreButton.disabled = true;
    if (page === 1) statusEl.replaceChildren(skeletonUsers(2));
    try {
      const data = await api.posts.comments(postId, page);
      data.items.forEach(addToList);
      moreButton.hidden = !data.pagination.hasMore;
      page += 1;
      statusEl.replaceChildren();
      showEmptyIfNeeded();
    } catch (err) {
      statusEl.replaceChildren(errorState(err.message, load));
    } finally {
      moreButton.disabled = false;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const content = textarea.value.trim();
    if (!content) { error.textContent = 'Comment cannot be empty.'; return; }
    error.textContent = '';
    setBusy(submit, true, 'Sending...');
    try {
      const result = await api.posts.addComment(postId, content);
      textarea.value = '';
      textarea.style.height = 'auto';
      updateCounter();
      statusEl.replaceChildren();
      addToList(result.comment);
      onCountChange(result.commentCount);
    } catch (err) {
      error.textContent = err.details?.content || err.message;
    } finally {
      setBusy(submit, false);
    }
  });

  container.append(form, listEl, statusEl, moreButton);
  load();
}
