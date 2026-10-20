const multer = require('multer');
const config = require('../config/env');
const AppError = require('../utils/AppError');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

// Files are held in memory, checked (size, MIME type, then magic bytes in utils/files.js), and only then written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxImageBytes, files: 1, fields: 10 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new AppError(415, 'Only JPEG, PNG, GIF or WebP images are allowed.'));
    }
    return cb(null, true);
  },
});

const uploadImage = (fieldName) => upload.single(fieldName);

module.exports = { uploadImage };
