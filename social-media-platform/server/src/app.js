const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const { protect } = require('./middleware/auth');
const { apiLimiter, writeLimiter } = require('./middleware/rateLimiters');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const clientDir = path.join(__dirname, '../../client');
const app = express();

// Needed so rate limiting sees the real client IP when running behind a host's reverse proxy.
app.set('trust proxy', config.trustProxy);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: { 'img-src': ["'self'", 'data:', 'blob:'] },
    },
  })
);
app.use(
  cors({
    origin: config.clientOrigins,
    credentials: true, // allow the browser to send the auth cookie
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Uploaded images. The cross-origin policy lets a frontend on another host display them.
app.use(
  '/uploads',
  express.static(config.uploadDir, {
    maxAge: '7d',
    index: false,
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  })
);

app.use('/api', apiLimiter);
app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));
app.use('/api/auth', require('./routes/auth.routes'));

// Everything below requires a logged-in user (and a valid CSRF token for writes).
const guarded = [...protect, writeLimiter];
app.use('/api/users', ...guarded, require('./routes/user.routes'));
app.use('/api/posts', ...guarded, require('./routes/post.routes'));
app.use('/api/comments', ...guarded, require('./routes/comment.routes'));
app.use('/api/feed', ...guarded, require('./routes/feed.routes'));
app.use('/api/notifications', ...guarded, require('./routes/notification.routes'));

app.use('/api', notFound);

if (config.serveClient) {
  app.use(express.static(clientDir));
  // Friendly 404 page for unknown browser URLs.
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.accepts('html')) return res.status(404).sendFile(path.join(clientDir, '404.html'));
    return next();
  });
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
