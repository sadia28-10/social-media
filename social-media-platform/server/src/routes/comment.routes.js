const express = require('express');
const controller = require('../controllers/comment.controller');
const validate = require('../middleware/validate');
const { validateComment } = require('../validators/content.validators');

const router = express.Router();

router.patch('/:id', validate(validateComment), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
