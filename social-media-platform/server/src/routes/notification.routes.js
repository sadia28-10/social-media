const express = require('express');
const controller = require('../controllers/notification.controller');

const router = express.Router();

router.get('/', controller.list);
router.get('/unread-count', controller.unreadCount);
router.patch('/read-all', controller.markAllRead);
router.patch('/:id/read', controller.markRead);

module.exports = router;
