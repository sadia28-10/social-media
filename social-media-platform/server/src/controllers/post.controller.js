const asyncHandler = require('../utils/asyncHandler');
const { ok } = require('../utils/respond');
const { parsePagination } = require('../utils/pagination');
const { parseId } = require('../utils/params');
const postService = require('../services/post.service');
const commentService = require('../services/comment.service');
const likeService = require('../services/like.service');

exports.list = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const sort = req.query.sort === 'popular' ? 'popular' : 'latest';
  ok(res, await postService.listPosts(req.user.id, { q, sort, page: parsePagination(req.query) }));
});

exports.feed = asyncHandler(async (req, res) => {
  ok(res, await postService.getFeed(req.user.id, parsePagination(req.query)));
});

exports.topics = asyncHandler(async (req, res) => {
  ok(res, { items: await postService.trendingTopics(5) });
});

exports.get = asyncHandler(async (req, res) => {
  ok(res, { post: await postService.getPost(req.user.id, parseId(req.params.id)) });
});

exports.create = asyncHandler(async (req, res) => {
  ok(res, { post: await postService.createPost(req.user, req.body.content, req.file) }, 201);
});

exports.update = asyncHandler(async (req, res) => {
  ok(res, { post: await postService.updatePost(req.user, parseId(req.params.id), req.body.content) });
});

exports.remove = asyncHandler(async (req, res) => {
  await postService.deletePost(req.user, parseId(req.params.id));
  ok(res, { message: 'Post deleted.' });
});

exports.listComments = asyncHandler(async (req, res) => {
  ok(res, await commentService.list(parseId(req.params.id), parsePagination(req.query, { defaultLimit: 20 })));
});

exports.addComment = asyncHandler(async (req, res) => {
  ok(res, await commentService.create(req.user, parseId(req.params.id), req.body.content), 201);
});

exports.like = asyncHandler(async (req, res) => {
  ok(res, await likeService.like(req.user, parseId(req.params.id)));
});

exports.unlike = asyncHandler(async (req, res) => {
  ok(res, await likeService.unlike(req.user, parseId(req.params.id)));
});
