const paginate = (query = {}) => {
  const page  = Math.max(parseInt(query.page)  || 1, 1)
  const limit = Math.min(parseInt(query.limit) || 20, 100)
  const skip  = (page - 1) * limit
  return { page, limit, skip }
}

const paginateMeta = (total, page, limit) => ({
  total,
  page,
  limit,
  pages: Math.ceil(total / limit)
})

module.exports = { paginate, paginateMeta }