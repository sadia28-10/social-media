import { API_BASE_URL } from './config.js';

// One place that talks to the backend: adds cookies, the CSRF header, and turns failures into ApiError.
let csrfToken = null;
let unauthorizedHandler = null;

export const setCsrfToken = (token) => { csrfToken = token; };
export const setUnauthorizedHandler = (fn) => { unauthorizedHandler = fn; };

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details || {};
  }
}

async function request(method, path, { body, form, query } = {}) {
  const url = new URL(`${API_BASE_URL}/api${path}`, window.location.origin);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  }

  const headers = {};
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;
  let payload;
  if (form) {
    payload = form; // the browser sets the multipart boundary itself
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, { method, headers, body: payload, credentials: 'include' });
  } catch (err) {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  let json = null;
  try {
    json = await response.json();
  } catch (err) {
    /* empty or non-JSON body */
  }

  if (!response.ok) {
    const message = json?.error?.message || 'Something went wrong. Please try again.';
    // An expired session while using the app sends the person back to log in. Auth calls handle their own 401s.
    if (response.status === 401 && !path.startsWith('/auth/') && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(response.status, message, json?.error?.details);
  }
  return json.data;
}

const get = (path, query) => request('GET', path, { query });
const send = (method) => (path, body) => request(method, path, { body });
const post = send('POST');
const patch = send('PATCH');
const del = (path) => request('DELETE', path);

export const api = {
  auth: {
    register: (data) => post('/auth/register', data),
    login: (data) => post('/auth/login', data),
    logout: () => post('/auth/logout'),
    me: () => get('/auth/me'),
  },
  users: {
    get: (username) => get(`/users/${encodeURIComponent(username)}`),
    posts: (username, page) => get(`/users/${encodeURIComponent(username)}/posts`, { page }),
    followers: (username, page) => get(`/users/${encodeURIComponent(username)}/followers`, { page }),
    following: (username, page) => get(`/users/${encodeURIComponent(username)}/following`, { page }),
    search: (q, page) => get('/users/search', { q, page }),
    suggestions: (limit) => get('/users/suggestions', { limit }),
    follow: (id) => post(`/users/${id}/follow`),
    unfollow: (id) => del(`/users/${id}/follow`),
    updateMe: (formData) => request('PATCH', '/users/me', { form: formData }),
  },
  posts: {
    list: ({ q, sort, page }) => get('/posts', { q, sort, page }),
    get: (id) => get(`/posts/${id}`),
    create: (formData) => request('POST', '/posts', { form: formData }),
    update: (id, content) => patch(`/posts/${id}`, { content }),
    remove: (id) => del(`/posts/${id}`),
    like: (id) => post(`/posts/${id}/like`),
    unlike: (id) => del(`/posts/${id}/like`),
    topics: () => get('/posts/topics'),
    comments: (id, page) => get(`/posts/${id}/comments`, { page }),
    addComment: (id, content) => post(`/posts/${id}/comments`, { content }),
  },
  comments: {
    update: (id, content) => patch(`/comments/${id}`, { content }),
    remove: (id) => del(`/comments/${id}`),
  },
  feed: (page) => get('/feed', { page }),
  notifications: {
    list: (page) => get('/notifications', { page }),
    unreadCount: () => get('/notifications/unread-count'),
    markRead: (id) => patch(`/notifications/${id}/read`),
    markAllRead: () => patch('/notifications/read-all'),
  },
};
