const asyncHandler = require('../shared/helpers/async-handler.helper')

const isAdmin = asyncHandler(async (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next()
  throw { status: 403, message: 'Access denied, admin only' }
})

module.exports = { isAdmin }