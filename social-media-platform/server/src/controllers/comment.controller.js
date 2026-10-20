const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const { parseId } = require('../utils/params');
const commentService = require('../services/comment.service');

exports.update = asyncHandler(async (req, res) => {
  ok(res, { comment: await commentService.update(req.user, parseId(req.params.id), req.body.content) });
});

exports.remove = asyncHandler(async (req, res) => {
  ok(res, await commentService.remove(req.user, parseId(req.params.id)));
});
