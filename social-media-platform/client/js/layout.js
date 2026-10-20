import { api, setUnauthorizedHandler } from './api.js';
import { loadSession, logout, loginUrl } from './auth.js';
import { h, getParam } from './utils.js';
import { icon } from './icons.js';
import { avatar, toast, showFlash, errorState, skeletonUsers } from './ui.js';
import { toggleTheme, getTheme } from './theme.js';
import { userRow } from './users.js';
import { openComposerModal } from './posts.js';

// ---------- notification badge (shared by the sidebar and the mobile bottom bar)
export function setUnreadBadge(count) {
  document.querySelectorAll('[data-unread-badge]').forEach((badge) => {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.hidden = count === 0;
  });
  document.querySelectorAll('[data-notif-link]').forEach((link) => {
    link.setAttribute('aria-label', count > 0 ? `Notifications, ${count} unread` : 'Notifications');
  });
}

export async function refreshUnreadBadge() {
  try {
    const { unreadCount } = await api.notifications.unreadCount();
    setUnreadBadge(unreadCount);
  } catch (err) {
    /* the badge is a convenience; ignore failures */
  }
}

// ---------- small building blocks
function logoMark() {
  const mark = h('span', { class: 'brand-mark', 'aria-hidden': 'true' });
  mark.innerHTML = '<svg width="28" height="28" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="16" cy="16" r="5" fill="currentColor"/></svg>';
  return mark;
}

const brand = () => h('a', { class: 'brand', href: 'index.html', 'aria-label': 'Circle home' }, logoMark(), h('span', { class: 'brand-text' }, 'Circle'));

function themeButton() {
  const button = h('button', { class: 'icon-btn', type: 'button', onclick: toggleTheme });
  const render = () => {
    const dark = getTheme() === 'dark';
    button.replaceChildren(icon(dark ? 'sun' : 'moon'));
    button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  };
  render();
  document.addEventListener('themechange', render);
  return button;
}

const logoutButton = () => h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Log out', title: 'Log out', onclick: logout }, icon('logout'));

function navItems(user) {
  return [
    { key: 'home', label: 'Home', href: 'index.html', icon: 'home' },
    { key: 'search', label: 'Search', href: 'search.html', icon: 'search' },
    { key: 'notifications', label: 'Notifications', href: 'notifications.html', icon: 'bell' },
    { key: 'profile', label: 'Profile', href: `profile.html?u=${encodeURIComponent(user.username)}`, icon: 'user' },
  ];
}

function navLink(item, active) {
  const isNotifications = item.key === 'notifications';
  return h('a', {
    class: `nav-link${active === item.key ? ' active' : ''}`,
    href: item.href,
    'aria-current': active === item.key ? 'page' : null,
    'data-notif-link': isNotifications ? '' : null,
  },
  h('span', { class: 'nav-icon' }, icon(item.icon, 24), isNotifications ? h('span', { class: 'badge', 'data-unread-badge': '', hidden: true }, '0') : null),
  h('span', { class: 'nav-label' }, item.label));
}

// ---------- the three page regions
function buildLeft(user, active) {
  return h('aside', { class: 'sidebar sidebar-left' },
    h('div', { class: 'sidebar-inner' },
      brand(),
      h('nav', { class: 'nav', 'aria-label': 'Primary' }, navItems(user).map((item) => navLink(item, active))),
      h('button', { class: 'btn btn-primary btn-block create-btn', type: 'button', onclick: () => openComposerModal(user) }, icon('plus', 20), h('span', { class: 'nav-label' }, 'New post')),
      h('div', { class: 'sidebar-footer' },
        h('a', { class: 'account-card', href: `profile.html?u=${encodeURIComponent(user.username)}` },
          avatar(user, 'sm'),
          h('span', { class: 'account-text' }, h('span', { class: 'user-name' }, user.displayName), h('span', { class: 'muted user-handle' }, `@${user.username}`))),
        h('div', { class: 'footer-buttons' }, themeButton(), logoutButton()))));
}

function buildMobileHeader() {
  return h('header', { class: 'mobile-header' }, brand(), h('div', { class: 'mobile-actions' }, themeButton(), logoutButton()));
}

function buildBottomNav(user, active) {
  const [home, search, notifications, profile] = navItems(user).map((item) => navLink(item, active));
  const create = h('button', { class: 'bottom-create', type: 'button', 'aria-label': 'New post', onclick: () => openComposerModal(user) }, icon('plus', 24));
  return h('nav', { class: 'bottom-nav', 'aria-label': 'Primary' }, home, search, create, notifications, profile);
}

const sideTitle = (id, text, iconName) => h('h2', { id, class: 'side-title' }, iconName ? icon(iconName, 18) : null, text);

function buildRight() {
  const searchForm = h('form', { class: 'side-search', action: 'search.html', method: 'get', role: 'search' },
    icon('search', 18),
    h('input', { type: 'search', name: 'q', placeholder: 'Search people and posts', 'aria-label': 'Search people and posts', maxlength: 50, autocomplete: 'off' }));

  const suggestionTitle = sideTitle('suggest-title', 'Who to follow', 'users');
  const suggestions = h('section', { class: 'card side-card', 'aria-labelledby': 'suggest-title' }, suggestionTitle, skeletonUsers(3));
  api.users.suggestions(4)
    .then(({ items }) => {
      suggestions.replaceChildren(suggestionTitle, ...(items.length
        ? items.map((user) => userRow(user, { compact: true }))
        : [h('p', { class: 'muted small' }, 'No suggestions right now. You may already follow everyone!')]));
    })
    .catch(() => suggestions.replaceChildren(suggestionTitle, h('p', { class: 'muted small' }, 'Could not load suggestions.')));

  const topicTitle = sideTitle('topics-title', 'Trending topics', 'trending');
  const topics = h('section', { class: 'card side-card', 'aria-labelledby': 'topics-title' }, topicTitle, h('p', { class: 'muted small' }, 'Loading...'));
  api.posts.topics()
    .then(({ items }) => {
      topics.replaceChildren(topicTitle, ...(items.length
        ? items.map((topic) => h('a', { class: 'topic', href: `search.html?q=${encodeURIComponent(`#${topic.tag}`)}&tab=posts` },
          h('span', { class: 'topic-tag' }, `#${topic.tag}`),
          h('span', { class: 'muted small' }, `${topic.count} post${topic.count === 1 ? '' : 's'} this week`)))
        : [h('p', { class: 'muted small' }, 'Nothing is trending yet. Add #hashtags to your posts!')]));
    })
    .catch(() => topics.replaceChildren(topicTitle, h('p', { class: 'muted small' }, 'Could not load topics.')));

  const about = h('section', { class: 'card side-card' },
    sideTitle('about-title', 'About Circle'),
    h('p', { class: 'muted small' }, 'A small community for short posts and photos. Be kind, be curious, and keep it friendly.'));

  return h('aside', { class: 'sidebar sidebar-right', 'aria-label': 'Discover' }, h('div', { class: 'sidebar-inner' }, searchForm, suggestions, topics, about));
}

// ---------- page setup used by every app page
let handlingExpiredSession = false;

// Loads the session, builds the sidebars and navigation around <main id="main">, and returns the current user.
// Returns null when the person is not logged in (they are redirected) or the server is unreachable.
export async function initLayout({ requireAuth = true, active = null } = {}) {
  document.body.prepend(h('a', { class: 'skip-link', href: '#main' }, 'Skip to main content'));
  const main = document.getElementById('main');

  let user;
  try {
    user = await loadSession();
  } catch (err) {
    main.replaceChildren(errorState(err.message, () => window.location.reload()));
    return null;
  }
  if (!user) {
    if (requireAuth) window.location.replace(loginUrl());
    return null;
  }

  setUnauthorizedHandler(() => {
    if (handlingExpiredSession) return;
    handlingExpiredSession = true;
    toast('Your session has expired. Redirecting to log in...', 'error');
    setTimeout(() => window.location.replace(loginUrl({ expired: true })), 1200);
  });

  let activeKey = active;
  if (active === 'profile-auto') {
    const viewed = (getParam('u') || user.username).toLowerCase();
    activeKey = viewed === user.username ? 'profile' : null;
  }

  const shell = document.getElementById('shell');
  shell.prepend(buildLeft(user, activeKey), buildMobileHeader());
  shell.append(buildRight(), buildBottomNav(user, activeKey));

  refreshUnreadBadge();
  setInterval(refreshUnreadBadge, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshUnreadBadge(); });
  showFlash();
  return user;
}
