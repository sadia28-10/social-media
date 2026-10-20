const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { ok } = require('../utils/respond');
const { parsePagination } = require('../utils/pagination');
const { parseId, parseUsername } = require('../utils/params');
const userService = require('../services/user.service');
const postService = require('../services/post.service');

exports.getProfile = asyncHandler(async (req, res) => {
  ok(res, { user: await userService.getProfile(req.user.id, parseUsername(req.params.username)) });
});

exports.updateMe = asyncHandler(async (req, res) => {
  ok(res, { user: await userService.updateProfile(req.user.id, req.body, req.file) });
});

exports.userPosts = asyncHandler(async (req, res) => {
  const userId = await userService.getIdByUsername(parseUsername(req.params.username));
  ok(res, await postService.listByUser(req.user.id, userId, parsePagination(req.query)));
});

exports.followers = asyncHandler(async (req, res) => {
  ok(res, await userService.followers(req.user.id, parseUsername(req.params.username), parsePagination(req.query, { defaultLimit: 20 })));
});

exports.following = asyncHandler(async (req, res) => {
  ok(res, await userService.following(req.user.id, parseUsername(req.params.username), parsePagination(req.query, { defaultLimit: 20 })));
});

exports.search = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 50);
  if (!q) throw new AppError(400, 'Enter something to search for.');
  ok(res, await userService.search(req.user.id, q, parsePagination(req.query, { defaultLimit: 20 })));
});

exports.suggestions = asyncHandler(async (req, res) => {
  const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 5));
  ok(res, { items: await userService.suggestions(req.user.id, limit) });
});

exports.follow = asyncHandler(async (req, res) => {
  ok(res, await userService.follow(req.user.id, parseId(req.params.id)));
});

exports.unfollow = asyncHandler(async (req, res) => {
  ok(res, await userService.unfollow(req.user.id, parseId(req.params.id)));
});
