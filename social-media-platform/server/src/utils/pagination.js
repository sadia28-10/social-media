// Offset pagination: ?page=1&limit=10. We fetch limit+1 rows so we can tell whether another page exists.
function parsePagination(query, { defaultLimit = 10, maxLimit = 50 } = {}) {
  const page = Math.min(1000, Math.max(1, parseInt(query.page, 10) || 1));
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

function toPage(rows, { page, limit }, mapper = (row) => row) {
  return {
    items: rows.slice(0, limit).map(mapper),
    pagination: { page, limit, hasMore: rows.length > limit },
  };
}

module.exports = { parsePagination, toPage };
