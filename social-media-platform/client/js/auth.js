import { api, setCsrfToken } from './api.js';
import { getParam, safeNext } from './utils.js';
import { setBusy, showFieldErrors } from './ui.js';

// Restores the session on every page load. Returns the user, or null when logged out.
export async function loadSession() {
  try {
    const data = await api.auth.me();
    setCsrfToken(data.csrfToken);
    return data.user;
  } catch (err) {
    if (err.status === 401) return null;
    throw err;
  }
}

export async function logout() {
  try {
    await api.auth.logout();
  } catch (err) {
    /* even if the request fails, send the person to the login page */
  }
  window.location.replace('login.html');
}

export function loginUrl({ expired = false } = {}) {
  const current = window.location.pathname.split('/').pop() + window.location.search;
  const next = current && current !== 'login.html' ? `next=${encodeURIComponent(current)}` : '';
  return `login.html?${[next, expired ? 'expired=1' : ''].filter(Boolean).join('&')}`;
}

// ---------- frontend form validation (the server validates again; this gives instant feedback)
const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegister(data) {
  const errors = {};
  if (!USERNAME_RE.test(data.username)) errors.username = 'Use 3-30 characters: lowercase letters, numbers and underscores.';
  if (data.email.length > 254 || !EMAIL_RE.test(data.email)) errors.email = 'Enter a valid email address.';
  if (data.password.length < 8 || data.password.length > 72) errors.password = 'Password must be 8-72 characters.';
  else if (!/[A-Za-z]/.test(data.password) || !/\d/.test(data.password)) errors.password = 'Include at least one letter and one number.';
  if (data.displayName.length > 50) errors.displayName = 'Display name can be at most 50 characters.';
  return errors;
}

function focusFirstError(form) {
  form.querySelector('[aria-invalid="true"]')?.focus();
}

async function initLogin(form) {
  if (await loadSession()) return window.location.replace('index.html');
  const formError = document.getElementById('form-error');
  if (getParam('expired')) formError.textContent = 'Your session has expired. Please log in again.';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = { identifier: form.elements.identifier.value.trim(), password: form.elements.password.value };
    const errors = {};
    if (!data.identifier) errors.identifier = 'Enter your email or username.';
    if (!data.password) errors.password = 'Enter your password.';
    showFieldErrors(form, errors);
    formError.textContent = '';
    if (Object.keys(errors).length) return focusFirstError(form);

    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true, 'Logging in...');
    try {
      const result = await api.auth.login(data);
      setCsrfToken(result.csrfToken);
      window.location.href = safeNext(getParam('next'));
    } catch (err) {
      formError.textContent = err.message;
      setBusy(button, false);
    }
  });
  return undefined;
}

async function initRegister(form) {
  if (await loadSession()) return window.location.replace('index.html');
  const formError = document.getElementById('form-error');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = {
      username: form.elements.username.value.trim().toLowerCase(),
      email: form.elements.email.value.trim().toLowerCase(),
      password: form.elements.password.value,
      displayName: form.elements.displayName.value.trim(),
    };
    const errors = validateRegister(data);
    showFieldErrors(form, errors);
    formError.textContent = '';
    if (Object.keys(errors).length) return focusFirstError(form);

    const button = form.querySelector('button[type="submit"]');
    setBusy(button, true, 'Creating account...');
    try {
      const result = await api.auth.register(data);
      setCsrfToken(result.csrfToken);
      window.location.href = 'index.html';
    } catch (err) {
      if (Object.keys(err.details).length) {
        showFieldErrors(form, err.details);
        focusFirstError(form);
      } else {
        formError.textContent = err.message;
      }
      setBusy(button, false);
    }
  });
  return undefined;
}

// This file doubles as the entry point of login.html and register.html.
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
if (loginForm) initLogin(loginForm);
if (registerForm) initRegister(registerForm);
