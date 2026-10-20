import { api } from './api.js';
import { h } from './utils.js';
import { avatar, toast, openModal, skeletonUsers, emptyState, errorState, infiniteScroll } from './ui.js';

// Follow/unfollow button with an optimistic update that is reverted if the request fails.
export function followButton(user, { onChange } = {}) {
  let busy = false;
  const button = h('button', { type: 'button', 'aria-label': `Follow @${user.username}` });

  const render = () => {
    button.textContent = user.isFollowing ? 'Following' : 'Follow';
    button.className = `btn btn-sm ${user.isFollowing ? 'btn-outline' : 'btn-primary'}`;
    button.setAttribute('aria-pressed', String(user.isFollowing));
  };
  render();

  button.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    const wasFollowing = user.isFollowing;
    user.isFollowing = !wasFollowing;
    render();
    try {
      const result = wasFollowing ? await api.users.unfollow(user.id) : await api.users.follow(user.id);
      user.isFollowing = result.isFollowing;
      render();
      if (onChange) onChange(result);
    } catch (err) {
      user.isFollowing = wasFollowing;
      render();
      toast(err.message, 'error');
    } finally {
      busy = false;
    }
  });
  return button;
}

export function userRow(user, { compact = false } = {}) {
  const href = `profile.html?u=${encodeURIComponent(user.username)}`;
  return h('div', { class: 'user-row' },
    h('a', { class: 'user-row-main', href },
      avatar(user, compact ? 'sm' : 'md'),
      h('span', { class: 'user-row-text' },
        h('span', { class: 'user-name' }, user.displayName),
        h('span', { class: 'user-handle muted' }, `@${user.username}`),
        !compact && user.bio ? h('span', { class: 'user-bio' }, user.bio) : null)),
    user.isMe ? null : followButton(user));
}

// A list of users that loads more pages as you scroll. fetchPage(page) resolves to { items, pagination }.
export function createUserList({ fetchPage, emptyView }) {
  const root = h('div', { class: 'user-list' });
  const itemsEl = h('div');
  const statusEl = h('div');
  const sentinel = h('div', { class: 'sentinel', 'aria-hidden': 'true' });
  root.append(itemsEl, statusEl, sentinel);
  let page = 1;
  let hasMore = true;
  let scroller;

  async function loadMore() {
    if (!hasMore) return false;
    statusEl.replaceChildren(skeletonUsers(page === 1 ? 4 : 1));
    try {
      const data = await fetchPage(page);
      data.items.forEach((user) => itemsEl.append(userRow(user)));
      hasMore = data.pagination.hasMore;
      page += 1;
      statusEl.replaceChildren();
      if (!itemsEl.children.length) statusEl.replaceChildren(emptyView ? emptyView() : emptyState({ iconName: 'users', title: 'No people found' }));
      return hasMore;
    } catch (err) {
      statusEl.replaceChildren(errorState(err.message, () => scroller.restart()));
      return false;
    }
  }

  scroller = infiniteScroll(sentinel, loadMore);
  return root;
}

export function openUserListModal({ title, fetchPage, emptyTitle }) {
  const list = createUserList({
    fetchPage,
    emptyView: () => emptyState({ iconName: 'users', title: emptyTitle }),
  });
  return openModal({ title, content: list });
}
