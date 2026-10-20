const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const { parsePagination } = require('../utils/pagination');
const { parseId } = require('../utils/params');
const notificationService = require('../services/notification.service');

exports.list = asyncHandler(async (req, res) => {
  const page = await notificationService.list(req.user.id, parsePagination(req.query, { defaultLimit: 20 }));
  ok(res, { ...page, unreadCount: await notificationService.unreadCount(req.user.id) });
});

exports.unreadCount = asyncHandler(async (req, res) => {
  ok(res, { unreadCount: await notificationService.unreadCount(req.user.id) });
});

exports.markRead = asyncHandler(async (req, res) => {
  await notificationService.markRead(req.user.id, parseId(req.params.id));
  ok(res, { unreadCount: await notificationService.unreadCount(req.user.id) });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.user.id);
  ok(res, { unreadCount: 0 });
});
