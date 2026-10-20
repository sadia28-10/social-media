# Circle — a small social media platform

Circle is a mini social platform: sign up, post text and images, follow people, like and comment,
and see a personalized feed. Built as a full-stack project with a vanilla JS frontend, an
Express/PostgreSQL REST API, and cookie-based JWT authentication.

## Features

- **Auth** — register/login/logout, bcrypt password hashing, HttpOnly cookie sessions, CSRF protection
- **Profiles** — avatar, bio, location, website, edit your own profile, follow/unfollow others
- **Posts** — text and/or image, edit/delete your own, infinite-scroll feed and explore, latest/popular sort
- **Comments** — add, edit, delete your own, live comment counts
- **Likes** — like/unlike, duplicate-proof, optimistic UI with rollback on failure
- **Follow system** — followers/following lists, "who to follow" suggestions, self-follow blocked
- **Personalized feed** — posts from people you follow plus your own, newest first
- **Search & discovery** — search people and posts, trending #hashtags (last 7 days)
- **Notifications** — new follower, like, comment; unread badge; mark as read / mark all as read
- **UI polish** — light/dark mode (persisted), skeleton loading states, toasts, empty states,
  confirmation dialogs before deleting, responsive desktop/tablet/mobile layouts

## Technology stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | HTML5, CSS3 (Grid/Flexbox, custom properties), vanilla JS (ES modules), Fetch API |
| Backend   | Node.js, Express, JWT (HttpOnly cookie), bcrypt, multer (uploads), express-rate-limit, helmet |
| Database  | PostgreSQL (`pg`), raw parameterized SQL, custom migration runner |
| Testing   | Node's built-in test runner (`node:test`) + supertest, against a real PostgreSQL database |

No frontend framework is used, per the project spec — the UI is built with a small `h()` helper
(see `client/js/utils.js`) that creates DOM nodes directly, which is also what keeps user content
safe from XSS (text is always inserted as text, never as HTML).

## Screenshots

_Add screenshots of the home feed, a profile page, and the mobile view here before publishing the
repository — e.g. `docs/screenshot-home.png`, embedded as `![Home feed](docs/screenshot-home.png)`._

## Architecture overview

```
Browser (client/) --fetch, credentials: 'include'--> Express API (server/) --pg--> PostgreSQL
```

- **`client/`** — static HTML/CSS/JS. Every page loads `js/layout.js`, which restores the session,
  builds the left/right sidebars and the mobile bottom nav, and renders `<main id="main">` for that page.
- **`server/src/`** — `routes` → `controllers` (HTTP in/out) → `services` (business logic + SQL) →
  PostgreSQL. `validators` clean and check input before it reaches a controller. `middleware` covers
  auth, CSRF, rate limiting, uploads, and centralized error handling.
- **`database/migrations/`** — one plain SQL file per migration, applied in order by
  `npm run migrate`, tracked in a `schema_migrations` table.

### Request lifecycle (example: creating a post)

1. `client/js/posts.js` submits a `FormData` (text + optional image) with the stored CSRF token.
2. `helmet` → `cors` → `express.json`/multer → rate limiter → `requireAuth` (reads the JWT cookie) →
   `requireCsrf` (checks the header) → `validate(validatePostCreate)`.
3. `post.controller.js` calls `post.service.js`, which saves the image (if any) to `server/uploads`
   after checking its real file signature, then inserts the row and re-reads it with like/comment counts.
4. The JSON response updates the UI; on failure, `errorHandler` returns a consistent `{ success:false, error }` body.

## Database schema

Six tables: `users`, `posts`, `comments`, `likes`, `follows`, `notifications` — see
`database/migrations/001_initial_schema.sql` for full column definitions, constraints and indexes.

- **users → posts / comments / likes / follows / notifications**: one-to-many, `ON DELETE CASCADE`.
- **users ↔ users** (`follows`): many-to-many; `UNIQUE(follower_id, following_id)` blocks duplicate
  follows, a `CHECK` blocks following yourself.
- **users ↔ posts** (`likes`): many-to-many; `UNIQUE(post_id, user_id)` blocks duplicate likes.
- **notifications**: `recipient_id`/`actor_id` both reference `users`; `post_id` is nullable (a follow
  notification has no post).
- Trigram indexes (migration `002`, needs the `pg_trgm` extension) back `ILIKE` search on usernames,
  display names and post content.

## API endpoints

All routes are prefixed `/api`. Endpoints other than `/auth/*` and `/health` require a valid session
cookie, and all POST/PATCH/DELETE requests also require the `X-CSRF-Token` header (see Security below).

**Auth** — `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `GET /auth/me`

**Users** — `GET /users/:username` · `PATCH /users/me` (multipart, optional `avatar` file) ·
`GET /users/:username/posts` · `GET /users/:username/followers` · `GET /users/:username/following` ·
`GET /users/search?q=` · `GET /users/suggestions` · `POST /users/:id/follow` · `DELETE /users/:id/follow`

**Posts** — `GET /posts?q=&sort=&page=` · `POST /posts` (multipart, optional `image` file) ·
`GET /posts/topics` · `GET /posts/:id` · `PATCH /posts/:id` · `DELETE /posts/:id` ·
`GET /posts/:id/comments` · `POST /posts/:id/comments` · `POST /posts/:id/like` · `DELETE /posts/:id/like`

**Comments** — `PATCH /comments/:id` · `DELETE /comments/:id`

**Feed** — `GET /feed?page=`

**Notifications** — `GET /notifications?page=` · `GET /notifications/unread-count` ·
`PATCH /notifications/:id/read` · `PATCH /notifications/read-all`

Every list endpoint takes `?page=1&limit=10` (offset pagination) and returns
`{ items, pagination: { page, limit, hasMore } }`. Every response is `{ success: true, data }` or
`{ success: false, error: { message, details? } }`.

## Prerequisites

- Node.js 20+ and npm
- PostgreSQL 14+ running locally or a connection string to a managed instance

## Installation

```bash
git clone <your-repo-url> circle
cd circle/server
npm install
```

## Environment variables

```bash
cp .env.example .env
```

Then edit `server/.env`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_SSL` | `true` for most managed databases (Render, Neon, Supabase, Railway) |
| `JWT_SECRET` | 32+ random characters — generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN_DAYS` | Session length (default 7) |
| `CLIENT_ORIGIN` | Comma-separated origins allowed to call the API with cookies |
| `COOKIE_SAMESITE` / `COOKIE_SECURE` | `lax`/`false` for local HTTP; `lax` or `none` + `true` in production (HTTPS) |
| `TRUST_PROXY` | Number of reverse proxies in front of the app (e.g. `1` on Render/Railway/Heroku) |
| `SERVE_CLIENT` | `true` to have Express also serve `client/` (simplest local setup) |
| `TEST_DATABASE_URL` | A **separate, empty** database for `npm test` (name must contain "test") |

Never commit `.env`. `.gitignore` already excludes it.

## Database migration and seeding

```bash
createdb social_platform            # or create it in your PostgreSQL GUI of choice
npm run migrate                     # applies database/migrations/*.sql in order
npm run seed                        # optional: 4 demo users, posts, comments, likes, follows
```

Demo accounts (seed only): `demo_alice`, `demo_bob`, `demo_carol`, `demo_dave`, password `DemoPass123`.
Demo data is clearly labelled and never contains real credentials; seeding refuses to run against a
production database unless `SEED_ALLOW_PRODUCTION=true` is explicitly set.

## Local development

```bash
npm run dev      # auto-restarting server (Node's --watch) on http://localhost:4000
# or
npm start        # single run, no watcher
```

With `SERVE_CLIENT=true` (the default in `.env.example`), open `http://localhost:4000` directly —
the API and the static frontend share one origin, which is the simplest setup and avoids CORS/cookie
edge cases entirely. To develop the frontend separately (e.g. VS Code Live Server on another port),
set `SERVE_CLIENT=false`, add that origin to `CLIENT_ORIGIN`, and set `API_BASE_URL` in
`client/js/config.js` to `http://localhost:4000`.

## Testing

```bash
createdb social_platform_test       # separate, empty database — tests TRUNCATE it
npm test
```

Tests cover: registration/login (including duplicate-account and invalid-credential handling), CSRF
enforcement, protected-route rejection, post CRUD and ownership checks, image upload validation
(rejects non-images, cleans up files on delete), feed pagination and filtering, comment CRUD and
ownership, like uniqueness, follow uniqueness and self-follow prevention, profile-editing ownership
and validation, search, and notification creation/read state. `npm test` was written to run in this
project but **has not been executed in this environment** (no network/PostgreSQL access here) — run
it yourself and treat its output as the source of truth, not this README.

## Deployment

1. **Database**: create a managed PostgreSQL instance (Render, Railway, Supabase, Neon, etc.). Set
   `DATABASE_URL` and `DATABASE_SSL=true`.
2. **Backend**: deploy `server/` to any Node-compatible host. Set every variable from `.env.example`
   in the host's dashboard — never commit `.env`. Set `NODE_ENV=production`, `TRUST_PROXY=1` (if the
   host sits behind a proxy, which most do), `COOKIE_SECURE=true`, and `CLIENT_ORIGIN` to your
   frontend's real URL. Run `npm run migrate` once (a one-off/release command on most hosts).
3. **Frontend**: if you keep `SERVE_CLIENT=true`, the backend host also serves `client/` and you're
   done. To host the frontend separately (a static host — Netlify, Vercel, GitHub Pages), set
   `SERVE_CLIENT=false` on the backend, set `client/js/config.js`'s `API_BASE_URL` to the backend's
   URL, and add the frontend's URL to `CLIENT_ORIGIN`.
4. Uploaded images are written to local disk (`server/uploads` by default). Most free/low-cost hosts
   use an ephemeral filesystem, so uploaded images can be lost on redeploy — for production, mount a
   persistent volume or switch `saveImage`/`deleteUpload` in `server/src/utils/files.js` to an object
   store (S3-compatible), which is a drop-in change since the rest of the app only deals with the
   returned URL.

## Known limitations

- Uploaded images are stored on local disk, not object storage (see Deployment above).
- No admin role: only a comment's or post's own author can edit/delete it.
- Notifications are polled (every 60s and on tab focus), not pushed over WebSockets, per the spec's
  instruction to skip real-time features for the core app.
- A stolen/leaked JWT stays valid until it expires (up to `JWT_EXPIRES_IN_DAYS`); there is no
  server-side token revocation list.
- Search uses PostgreSQL trigram similarity (`pg_trgm`), which is fast at this scale but not a
  substitute for a dedicated search engine at very large scale.
