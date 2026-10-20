import { h, initials, assetUrl } from './utils.js';
import { icon } from './icons.js';

// ---------- toasts
export function toast(message, type = 'info') {
  let region = document.getElementById('toast-region');
  if (!region) {
    region = h('div', { id: 'toast-region', class: 'toast-region', 'aria-live': 'polite' });
    document.body.append(region);
  }
  const node = h('div', { class: `toast toast-${type}`, role: type === 'error' ? 'alert' : 'status' }, message);
  region.append(node);
  setTimeout(() => {
    node.classList.add('toast-out');
    setTimeout(() => node.remove(), 250);
  }, 4200);
}

// A message that survives one page navigation (used after saving a profile, for example).
export const flash = (message) => { try { sessionStorage.setItem('flash', message); } catch (e) { /* ignore */ } };
export function showFlash() {
  try {
    const message = sessionStorage.getItem('flash');
    if (message) {
      sessionStorage.removeItem('flash');
      toast(message, 'success');
    }
  } catch (e) { /* ignore */ }
}

// ---------- modals (native <dialog>: focus trapping and Escape key come for free)
let modalCount = 0;
export function openModal({ title, content, onClose }) {
  modalCount += 1;
  const titleId = `modal-title-${modalCount}`;
  const dialog = h('dialog', { class: 'modal', 'aria-labelledby': titleId });
  const closeButton = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: () => dialog.close() }, icon('x'));
  dialog.append(
    h('div', { class: 'modal-header' }, h('h2', { id: titleId }, title), closeButton),
    h('div', { class: 'modal-body' }, content)
  );
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (onClose) onClose();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close(); // click on the backdrop
  });
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, close: () => dialog.close() };
}

export function confirmDialog({ title, message, confirmText = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let confirmed = false;
    let modal;
    const content = h(
      'div',
      {},
      h('p', { class: 'muted' }, message),
      h(
        'div',
        { class: 'modal-actions' },
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => modal.close() }, 'Cancel'),
        h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, type: 'button', onclick: () => { confirmed = true; modal.close(); } }, confirmText)
      )
    );
    modal = openModal({ title, content, onClose: () => resolve(confirmed) });
  });
}

// ---------- dropdown menus (post options, comment options)
const openMenus = new Set();
let menuListenersReady = false;

function closeAllMenus(except) {
  for (const menu of openMenus) {
    if (menu !== except) {
      menu.hidden = true;
      menu.previousElementSibling?.setAttribute('aria-expanded', 'false');
      openMenus.delete(menu);
    }
  }
}

export function menu(label, items) {
  if (!menuListenersReady) {
    menuListenersReady = true;
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.menu-wrap')) closeAllMenus();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeAllMenus();
    });
  }
  const list = h('div', { class: 'menu', role: 'menu', hidden: true });
  const trigger = h('button', {
    class: 'icon-btn', type: 'button', 'aria-label': label, 'aria-haspopup': 'menu', 'aria-expanded': 'false',
    onclick: () => {
      const willOpen = list.hidden;
      closeAllMenus(list);
      list.hidden = !willOpen;
      trigger.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) openMenus.add(list); else openMenus.delete(list);
    },
  }, icon('more'));
  for (const item of items) {
    list.append(h('button', {
      class: `menu-item${item.danger ? ' menu-item-danger' : ''}`, type: 'button', role: 'menuitem',
      onclick: () => { closeAllMenus(); item.onSelect(); },
    }, icon(item.icon, 16), item.label));
  }
  return h('div', { class: 'menu-wrap' }, trigger, list);
}

// ---------- avatars
function hueFor(text) {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

export function avatar(user, size = 'md') {
  const classes = `avatar avatar-${size}`;
  if (user.avatarUrl) {
    return h('img', { class: classes, src: assetUrl(user.avatarUrl), alt: `${user.displayName}'s profile picture`, loading: 'lazy' });
  }
  return h('span', { class: `${classes} avatar-fallback`, style: `--avatar-hue:${hueFor(user.username)}`, 'aria-hidden': 'true' }, initials(user.displayName));
}

// ---------- states
export function skeletonPosts(count = 3) {
  const wrap = document.createElement('div');
  wrap.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i += 1) {
    wrap.append(
      h('div', { class: 'card skeleton-card' },
        h('div', { class: 'skeleton-row' }, h('div', { class: 'skeleton skeleton-circle' }), h('div', { class: 'skeleton-lines' }, h('div', { class: 'skeleton skeleton-line short' }), h('div', { class: 'skeleton skeleton-line tiny' }))),
        h('div', { class: 'skeleton skeleton-line' }),
        h('div', { class: 'skeleton skeleton-line medium' }))
    );
  }
  return wrap;
}

export function skeletonUsers(count = 3) {
  const wrap = document.createElement('div');
  wrap.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i += 1) {
    wrap.append(h('div', { class: 'skeleton-row skeleton-user' }, h('div', { class: 'skeleton skeleton-circle' }), h('div', { class: 'skeleton-lines' }, h('div', { class: 'skeleton skeleton-line short' }), h('div', { class: 'skeleton skeleton-line tiny' }))));
  }
  return wrap;
}

export function emptyState({ iconName = 'search', title, message, action }) {
  return h('div', { class: 'empty-state' },
    h('div', { class: 'empty-icon' }, icon(iconName, 28)),
    h('h3', {}, title),
    message ? h('p', { class: 'muted' }, message) : null,
    action || null);
}

export function errorState(message, onRetry) {
  return h('div', { class: 'empty-state' },
    h('div', { class: 'empty-icon empty-icon-error' }, icon('alert', 28)),
    h('h3', {}, 'Something went wrong'),
    h('p', { class: 'muted' }, message),
    onRetry ? h('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: onRetry }, 'Try again') : null);
}

// ---------- buttons and forms
export function setBusy(button, busy, busyLabel = 'Please wait...') {
  if (busy) {
    button.dataset.label = button.textContent;
    button.textContent = busyLabel;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
  } else {
    if (button.dataset.label) button.textContent = button.dataset.label;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

// Shows server or client validation messages next to their inputs. errors = { fieldName: 'message' }
export function showFieldErrors(form, errors = {}) {
  for (const input of form.querySelectorAll('[name]')) {
    const message = errors[input.name];
    const output = form.querySelector(`[data-error-for="${input.name}"]`);
    if (output) output.textContent = message || '';
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      if (output?.id) input.setAttribute('aria-describedby', output.id);
    } else {
      input.removeAttribute('aria-invalid');
    }
  }
}

// ---------- infinite scroll
// Calls loadMore() whenever the sentinel scrolls near the viewport. loadMore returns true while more data exists.
export function infiniteScroll(sentinel, loadMore) {
  let active = true;
  const observer = new IntersectionObserver(async (entries) => {
    if (!entries[0].isIntersecting || !active) return;
    observer.unobserve(sentinel);
    const more = await loadMore();
    if (more === false) { active = false; return; }
    observer.observe(sentinel); // re-observing re-checks whether the sentinel is still visible
  }, { rootMargin: '400px' });
  observer.observe(sentinel);
  return {
    restart() { active = true; observer.unobserve(sentinel); observer.observe(sentinel); },
    stop() { active = false; observer.disconnect(); },
  };
}

// ---------- tabs
// tabs = [{ key, label }]. Returns { element, select(key) }.
export function tabBar(tabs, active, onSelect) {
  const element = h('div', { class: 'tabs', role: 'tablist' });
  const buttons = new Map();

  function select(key, { silent = false } = {}) {
    for (const [tabKey, button] of buttons) {
      const isActive = tabKey === key;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    }
    if (!silent) onSelect(key);
  }

  tabs.forEach((tab, index) => {
    const button = h('button', {
      class: 'tab', type: 'button', role: 'tab', onclick: () => select(tab.key),
      onkeydown: (event) => {
        const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        const next = tabs[(index + step + tabs.length) % tabs.length];
        select(next.key);
        buttons.get(next.key).focus();
      },
    }, tab.label);
    buttons.set(tab.key, button);
    element.append(button);
  });

  select(active, { silent: true });
  return { element, select };
}
