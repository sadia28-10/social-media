// An error we expect and can describe to the client (validation failure, not found, forbidden...).
class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
    this.isOperational = true;
  }
}

module.exports = AppError;
