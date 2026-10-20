const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/env');
const AppError = require('./AppError');

const EXTENSIONS = { jpeg: '.jpg', png: '.png', gif: '.gif', webp: '.webp' };

// Never trust the MIME type sent by the browser: check the real file signature ("magic bytes").
function detectImageType(buffer) {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  const gifHeader = buffer.subarray(0, 6).toString('ascii');
  if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') return 'gif';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

// Saves an uploaded image under a random name and returns its public URL path ("/uploads/abc.png").
async function saveImage(file) {
  if (!file) return null;
  const type = detectImageType(file.buffer);
  if (!type) throw new AppError(415, 'That file is not a valid JPEG, PNG, GIF or WebP image.');
  await fs.mkdir(config.uploadDir, { recursive: true });
  const filename = crypto.randomBytes(16).toString('hex') + EXTENSIONS[type];
  await fs.writeFile(path.join(config.uploadDir, filename), file.buffer);
  return `/uploads/${filename}`;
}

// Best-effort cleanup. path.basename prevents any path traversal.
async function deleteUpload(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  try {
    await fs.unlink(path.join(config.uploadDir, path.basename(url)));
  } catch (err) {
    /* file already gone: nothing to do */
  }
}

module.exports = { saveImage, deleteUpload, detectImageType };
