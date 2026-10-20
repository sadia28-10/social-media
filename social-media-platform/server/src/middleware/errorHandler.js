const AppError = require('../utils/AppError');

function notFound(req, res, next) {
  next(new AppError(404, 'The page or endpoint you requested does not exist.'));
}

// Every error in the app ends up here and is returned in one consistent JSON shape.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;
  if (err.type === 'entity.parse.failed') error = new AppError(400, 'Request body is not valid JSON.');
  if (err.type === 'entity.too.large') error = new AppError(413, 'Request body is too large.');
  if (err.name === 'MulterError') {
    error = err.code === 'LIMIT_FILE_SIZE'
      ? new AppError(413, 'Images must be 3 MB or smaller.')
      : new AppError(400, 'The upload was not valid.');
  }

  const status = error.isOperational ? error.status : 500;
  if (status >= 500) console.error(err); // log details on the server only

  res.status(status).json({
    success: false,
    error: {
      message: status >= 500 ? 'Something went wrong on our side. Please try again.' : error.message,
      ...(error.details && { details: error.details }),
    },
  });
}

module.exports = { notFound, errorHandler };
