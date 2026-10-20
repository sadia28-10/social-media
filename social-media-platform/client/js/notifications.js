import { initLayout, setUnreadBadge, refreshUnreadBadge } from './layout.js';
import { api } from './api.js';
import { h, timeAgo, fullDate } from './utils.js';
import { avatar, toast, emptyState, errorState, skeletonUsers, infiniteScroll } from './ui.js';

const me = await initLayout({ active: 'notifications' });
if (me) start();

const MESSAGES = {
  follow: 'started following you',
  like: 'liked your post',
  comment: 'commented on your post',
};

function notificationItem(notification) {
  const href = notification.type === 'follow' || !notification.postId
    ? `profile.html?u=${encodeURIComponent(notification.actor.username)}`
    : `post.html?id=${notification.postId}`;

  const link = h('a', { class: `notification${notification.isRead ? '' : ' unread'}`, href },
    avatar(notification.actor, 'md'),
    h('div', { class: 'notification-body' },
      h('p', {}, h('strong', {}, notification.actor.displayName), ` ${MESSAGES[notification.type] || 'interacted with you'}`),
      notification.postPreview ? h('p', { class: 'muted notification-preview' }, notification.postPreview) : null,
      h('time', { class: 'muted small', datetime: notification.createdAt, title: fullDate(notification.createdAt) }, timeAgo(notification.createdAt))),
    notification.isRead ? null : h('span', { class: 'unread-dot', role: 'img', 'aria-label': 'Unread' }));

  // Opening a notification marks it as read, then follows the link.
  link.addEventListener('click', async (event) => {
    if (notification.isRead) return;
    event.preventDefault();
    try {
      const { unreadCount } = await api.notifications.markRead(notification.id);
      setUnreadBadge(unreadCount);
    } catch (err) {
      /* still navigate even if marking failed */
    }
    window.location.href = href;
  });
  return link;
}

function start() {
  const main = document.getElementById('main');
  const listEl = h('div', { class: 'card notification-list' });
  const statusEl = h('div');
  const sentinel = h('div', { class: 'sentinel', 'aria-hidden': 'true' });
  const markAll = h('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: markAllRead }, 'Mark all as read');
  let page = 1;
  let hasMore = true;
  let scroller;

  async function markAllRead() {
    markAll.disabled = true;
    try {
      await api.notifications.markAllRead();
      listEl.querySelectorAll('.notification.unread').forEach((node) => {
        node.classList.remove('unread');
        node.querySelector('.unread-dot')?.remove();
      });
      setUnreadBadge(0);
      toast('All notifications marked as read.', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      markAll.disabled = false;
    }
  }

  async function loadMore() {
    if (!hasMore) return false;
    statusEl.replaceChildren(skeletonUsers(page === 1 ? 4 : 1));
    try {
      const data = await api.notifications.list(page);
      data.items.forEach((notification) => listEl.append(notificationItem(notification)));
      hasMore = data.pagination.hasMore;
      page += 1;
      setUnreadBadge(data.unreadCount);
      statusEl.replaceChildren();
      if (listEl.children.length === 0) {
        listEl.remove();
        markAll.hidden = true;
        statusEl.replaceChildren(emptyState({ iconName: 'bell', title: 'No notifications yet', message: 'When people follow you, like your posts, or comment, you will see it here.' }));
      }
      return hasMore;
    } catch (err) {
      statusEl.replaceChildren(errorState(err.message, () => scroller.restart()));
      return false;
    }
  }

  main.replaceChildren(
    h('header', { class: 'page-header page-header-row' }, h('h1', {}, 'Notifications'), markAll),
    listEl, statusEl, sentinel);
  scroller = infiniteScroll(sentinel, loadMore);
  refreshUnreadBadge();
}
