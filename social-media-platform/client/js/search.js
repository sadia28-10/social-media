import { initLayout } from './layout.js';
import { api } from './api.js';
import { h, getParam, debounce } from './utils.js';
import { icon } from './icons.js';
import { emptyState, tabBar } from './ui.js';
import { createPostList } from './posts.js';
import { createUserList } from './users.js';

const me = await initLayout({ active: 'search' });
if (me) start(me);

function start(user) {
  const main = document.getElementById('main');
  const TABS = ['popular', 'posts', 'people'];
  let query = (getParam('q') || '').trim().slice(0, 50);
  let tab = TABS.includes(getParam('tab')) ? getParam('tab') : (query ? 'posts' : 'popular');

  const input = h('input', { class: 'input search-input', type: 'search', name: 'q', placeholder: 'Search people and posts', 'aria-label': 'Search people and posts', maxlength: 50, autocomplete: 'off' });
  input.value = query;
  const results = h('div', { class: 'search-results', 'aria-live': 'polite' });

  function syncUrl() {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('tab', tab);
    window.history.replaceState(null, '', `search.html?${params}`);
  }

  function noResults(what) {
    return () => emptyState({
      iconName: 'search',
      title: query ? `No ${what} found` : `No ${what} yet`,
      message: query ? `Nothing matched "${query}". Try a different word or check the spelling.` : undefined,
    });
  }

  function render() {
    syncUrl();
    let content;
    if (tab === 'people') {
      const heading = query ? `People matching "${query}"` : 'Suggested people';
      const list = createUserList({
        fetchPage: query
          ? (page) => api.users.search(query, page)
          : async () => ({ items: (await api.users.suggestions(10)).items, pagination: { hasMore: false } }),
        emptyView: noResults('people'),
      });
      content = [h('h2', { class: 'section-title' }, heading), h('div', { class: 'card' }, list)];
    } else {
      const sort = tab === 'popular' ? 'popular' : 'latest';
      const heading = `${tab === 'popular' ? 'Popular posts' : 'Latest posts'}${query ? ` matching "${query}"` : ''}`;
      const list = createPostList({
        me: user,
        fetchPage: (page) => api.posts.list({ q: query, sort, page }),
        emptyView: noResults('posts'),
      });
      content = [h('h2', { class: 'section-title' }, heading), list.element];
    }
    results.replaceChildren(...content);
  }

  const tabs = tabBar(
    [{ key: 'popular', label: 'Popular' }, { key: 'posts', label: 'Latest' }, { key: 'people', label: 'People' }],
    tab,
    (key) => { tab = key; render(); }
  );

  const runSearch = () => {
    query = input.value.trim().slice(0, 50);
    render();
  };
  input.addEventListener('input', debounce(runSearch, 300));
  const form = h('form', { class: 'search-form', role: 'search', onsubmit: (event) => { event.preventDefault(); runSearch(); } }, icon('search', 18), input);

  main.replaceChildren(h('header', { class: 'page-header' }, h('h1', {}, 'Search')), form, tabs.element, results);
  render();
}
