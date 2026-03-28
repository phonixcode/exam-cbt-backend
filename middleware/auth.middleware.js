const jwt          = require('jsonwebtoken')
const User         = require('../modules/users/user.model')
const asyncHandler = require('../shared/helpers/async-handler.helper')

const protect = asyncHandler(async (req, res, next) => {
  let token

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1]
  }

  if (!token) throw { status: 401, message: 'Not authorized, no token provided' }

  const decoded = jwt.verify(token, process.env.JWT_SECRET)
  const user    = await User.findById(decoded.id).select('-pin')

  if (!user) throw { status: 401, message: 'Not authorized, user no longer exists' }

  req.user = user
  next()
})

module.exports = { protect }