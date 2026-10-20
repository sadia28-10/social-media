const express = require('express');
const controller = require('../controllers/post.controller');
const validate = require('../middleware/validate');
const { uploadImage } = require('../middleware/upload');
const { validatePostCreate, validatePostUpdate, validateComment } = require('../validators/content.validators');

const router = express.Router();

router.get('/', controller.list);
router.post('/', uploadImage('image'), validate(validatePostCreate), controller.create);
router.get('/topics', controller.topics);

router.get('/:id', controller.get);
router.patch('/:id', validate(validatePostUpdate), controller.update);
router.delete('/:id', controller.remove);

router.get('/:id/comments', controller.listComments);
router.post('/:id/comments', validate(validateComment), controller.addComment);

router.post('/:id/like', controller.like);
router.delete('/:id/like', controller.unlike);

module.exports = router;
