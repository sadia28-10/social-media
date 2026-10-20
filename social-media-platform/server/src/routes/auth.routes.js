const express = require('express');
const controller = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiters');
const { validateRegister, validateLogin } = require('../validators/auth.validators');

const router = express.Router();

router.post('/register', registerLimiter, validate(validateRegister), controller.register);
router.post('/login', loginLimiter, validate(validateLogin), controller.login);
router.post('/logout', controller.logout);
router.get('/me', requireAuth, controller.me);

module.exports = router;
