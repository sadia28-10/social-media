const express = require('express');
const controller = require('../controllers/user.controller');
const validate = require('../middleware/validate');
const { uploadImage } = require('../middleware/upload');
const { validateProfile } = require('../validators/content.validators');

const router = express.Router();

// Fixed paths must be declared before "/:username", otherwise "search" would be read as a username.
router.get('/search', controller.search);
router.get('/suggestions', controller.suggestions);
router.patch('/me', uploadImage('avatar'), validate(validateProfile), controller.updateMe);

router.post('/:id/follow', controller.follow);
router.delete('/:id/follow', controller.unfollow);

router.get('/:username', controller.getProfile);
router.get('/:username/posts', controller.userPosts);
router.get('/:username/followers', controller.followers);
router.get('/:username/following', controller.following);

module.exports = router;
