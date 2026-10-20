const AppError = require('../utils/AppError');

// validate(validator) runs validator(body, req) and replaces req.body with the cleaned value.
const validate = (validator) => (req, res, next) => {
  const { value, errors } = validator(req.body || {}, req);
  if (Object.keys(errors).length > 0) {
    throw new AppError(422, 'Please fix the highlighted fields.', errors);
  }
  req.body = value;
  next();
};

module.exports = validate;
