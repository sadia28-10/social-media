import { API_BASE_URL } from './config.js';

// h('div', { class: 'card', onclick: fn }, 'text', childNode) builds DOM nodes.
// Text is always inserted as text nodes (never as HTML), which is what protects the app from XSS.
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === undefined || child === null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const getParam = (name) => new URLSearchParams(window.location.search).get(name);

// Uploaded files are served by the API, so their URLs need the API origin when it differs from the page origin.
export function assetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path}`;
}

export function timeAgo(dateString) {
  const date = new Date(dateString);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

export const fullDate = (dateString) =>
  new Date(dateString).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const monthYear = (dateString) =>
  new Date(dateString).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]).join('').toUpperCase() || '?';
}

// Turns post text into DOM nodes, linking #hashtags to search and @mentions to profiles.
export function renderContent(text) {
  const fragment = document.createDocumentFragment();
  const pattern = /(#[\p{L}\p{N}_]{2,50}|@[a-z0-9_]{3,30})/gu;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) fragment.append(text.slice(last, match.index));
    const token = match[0];
    const href = token.startsWith('#')
      ? `search.html?q=${encodeURIComponent(token)}&tab=posts`
      : `profile.html?u=${encodeURIComponent(token.slice(1))}`;
    fragment.append(h('a', { href, class: 'inline-link' }, token));
    last = match.index + token.length;
  }
  if (last < text.length) fragment.append(text.slice(last));
  return fragment;
}

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Client-side check for a friendlier message. The server validates again, so this is only a convenience.
export function validateImageFile(file) {
  if (!IMAGE_TYPES.includes(file.type)) return 'Please choose a JPEG, PNG, GIF or WebP image.';
  if (file.size > MAX_IMAGE_BYTES) return 'Images must be 3 MB or smaller.';
  return null;
}

// Keeps a "123/500" counter in sync with a textarea and warns as the limit approaches.
export function attachCounter(input, counter, max) {
  const update = () => {
    const remaining = max - input.value.length;
    counter.textContent = `${input.value.length}/${max}`;
    counter.classList.toggle('counter-warn', remaining <= 20);
  };
  input.addEventListener('input', update);
  update();
  return update;
}

export function autoGrow(textarea) {
  const resize = () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 320)}px`;
  };
  textarea.addEventListener('input', resize);
}

// Only allow redirects to a page inside this site (prevents open-redirect tricks via ?next=).
export function safeNext(next) {
  if (next && /^[a-z0-9-]+\.html(\?[\w=&%.#-]*)?$/i.test(next)) return next;
  return 'index.html';
}
