import { initLayout } from './layout.js';
import { api } from './api.js';
import { h, getParam } from './utils.js';
import { icon } from './icons.js';
import { emptyState, errorState, skeletonPosts } from './ui.js';
import { postCard } from './posts.js';
import { initComments } from './comments.js';

const me = await initLayout({ active: null });
if (me) start(me);

async function start(user) {
  const main = document.getElementById('main');
  const id = getParam('id');
  const back = h('a', { class: 'back-link', href: 'index.html' }, icon('home', 18), 'Back to home');
  main.replaceChildren(h('header', { class: 'page-header' }, h('h1', {}, 'Post')), skeletonPosts(1));

  if (!/^\d+$/.test(id || '')) {
    main.replaceChildren(emptyState({ iconName: 'search', title: 'Post not found', message: 'This link does not point to a post.', action: back }));
    return;
  }

  try {
    const { post } = await api.posts.get(id);
    const card = postCard(post, { me: user, detail: true, onDeleted: () => window.location.replace('index.html') });
    const commentsSection = h('section', { class: 'card comments-card', id: 'comments', 'aria-labelledby': 'comments-title' }, h('h2', { id: 'comments-title', class: 'side-title' }, 'Comments'));
    main.replaceChildren(h('header', { class: 'page-header' }, h('h1', {}, 'Post')), card, commentsSection);
    document.title = `${post.author.displayName}: "${post.content.slice(0, 40)}" · Circle`;
    initComments(commentsSection, { postId: post.id, me: user, onCountChange: (count) => card.setCommentCount(count) });
    if (window.location.hash === '#comments') commentsSection.scrollIntoView();
  } catch (err) {
    main.replaceChildren(err.status === 404
      ? emptyState({ iconName: 'search', title: 'Post not found', message: 'It may have been deleted.', action: back })
      : errorState(err.message, () => window.location.reload()));
  }
}
