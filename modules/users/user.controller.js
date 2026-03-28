const userService  = require('./user.service')
const asyncHandler = require('../../shared/helpers/async-handler.helper')
const apiResponse  = require('../../shared/helpers/response.helper')

const userController = {

  getProfile: asyncHandler(async (req, res) => {
    const data = await userService.getProfile(req.user._id)
    apiResponse.success(res, 'Profile fetched', data)
  }),

  updateSubjects: asyncHandler(async (req, res) => {
    const data = await userService.updateSubjects(req.user._id, req.body.subjects)
    apiResponse.success(res, 'Subjects updated', data)
  }),

  listUsers: asyncHandler(async (req, res) => {
    const result = await userService.listUsers(req.query)
    apiResponse.success(res, 'Users fetched', result.data, 200, result.meta)
  })

}

module.exports = userController