const errorResponse = (code, message, details = {}) => ({
  error: { code, message, details },
});

const successResponse = (data, meta = null) => {
  const res = { data };
  if (meta) res.meta = meta;
  return res;
};

const paginatedResponse = (data, total, page, limit) => ({
  data,
  meta: { total, page, limit, pages: Math.ceil(total / limit) },
});

module.exports = { errorResponse, successResponse, paginatedResponse };
