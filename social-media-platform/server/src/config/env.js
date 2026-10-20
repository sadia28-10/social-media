const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const required = ['DATABASE_URL', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}. Copy server/.env.example to server/.env and fill it in.`);
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long.');
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const sameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
if (!['lax', 'strict', 'none'].includes(sameSite)) {
  throw new Error('COOKIE_SAMESITE must be one of: lax, strict, none.');
}
const secureCookie = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd;
if (sameSite === 'none' && !secureCookie) {
  throw new Error('COOKIE_SAMESITE=none requires COOKIE_SECURE=true.');
}

const days = Number(process.env.JWT_EXPIRES_IN_DAYS || 7);

module.exports = {
  nodeEnv,
  isProd,
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === 'true',
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresInSeconds: Math.round(days * 24 * 60 * 60),
  },
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:4000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  cookie: { sameSite, secure: secureCookie },
  trustProxy: Number(process.env.TRUST_PROXY || 0),
  serveClient: process.env.SERVE_CLIENT === 'true',
  uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
  maxImageBytes: 3 * 1024 * 1024,
};
