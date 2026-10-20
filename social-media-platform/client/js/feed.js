import { initLayout } from './layout.js';
import { api } from './api.js';
import { h } from './utils.js';
import { emptyState, skeletonUsers, tabBar } from './ui.js';
import { createComposer, createPostList } from './posts.js';
import { userRow } from './users.js';

const me = await initLayout({ active: 'home' });
if (me) start(me);

function feedEmptyView() {
  const box = h('div');
  box.append(emptyState({
    iconName: 'users',
    title: 'Your feed is empty',
    message: 'Follow people to see their posts here, or share your first post above.',
  }));
  const title = h('h2', { class: 'side-title' }, 'People you might like');
  const suggestions = h('section', { class: 'card side-card' }, title, skeletonUsers(3));
  box.append(suggestions);
  api.users.suggestions(5)
    .then(({ items }) => {
      if (items.length === 0) return suggestions.remove();
      return suggestions.replaceChildren(title, ...items.map((user) => userRow(user)));
    })
    .catch(() => suggestions.remove());
  return box;
}

function start(user) {
  const main = document.getElementById('main');
  const listHost = h('div');
  let tab = 'feed';
  let list;

  function mountList() {
    list = createPostList({
      me: user,
      fetchPage: (page) => (tab === 'feed' ? api.feed(page) : api.posts.list({ sort: 'popular', page })),
      emptyView: tab === 'feed'
        ? feedEmptyView
        : () => emptyState({ iconName: 'trending', title: 'No posts yet', message: 'Be the first to share something.' }),
    });
    listHost.replaceChildren(list.element);
  }

  const tabs = tabBar(
    [{ key: 'feed', label: 'Following' }, { key: 'popular', label: 'Popular' }],
    'feed',
    (key) => { tab = key; mountList(); }
  );

  // A new post (from the composer or the "New post" dialog) appears at the top of the feed immediately.
  document.addEventListener('post:created', (event) => {
    if (tab === 'feed') list.prepend(event.detail);
  });

  main.replaceChildren(
    h('header', { class: 'page-header' }, h('h1', {}, 'Home')),
    h('div', { class: 'card composer-card' }, createComposer({ me: user })),
    tabs.element,
    listHost);
  mountList();
}
