const authService   = require('./auth.service')
const asyncHandler  = require('../../shared/helpers/async-handler.helper')
const apiResponse   = require('../../shared/helpers/response.helper')

const authController = {

  register: asyncHandler(async (req, res) => {
    const data = await authService.register(req.body)
    apiResponse.success(res, 'Registration successful', data, 201)
  }),

  login: asyncHandler(async (req, res) => {
    const { phoneNumber, pin } = req.body
    const data = await authService.login(phoneNumber, pin)
    apiResponse.success(res, 'Login successful', data)
  }),

  registerAdmin: asyncHandler(async (req, res) => {
    const data = await authService.registerAdmin(req.body)
    apiResponse.success(res, 'Admin registered successfully', data, 201)
  }),

  getMe: asyncHandler(async (req, res) => {
    const data = await authService.getMe(req.user._id)
    apiResponse.success(res, 'Profile fetched', data)
  })

}

module.exports = authController