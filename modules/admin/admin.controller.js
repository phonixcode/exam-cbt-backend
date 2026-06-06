const adminService   = require('./admin.service')
const asyncHandler   = require('../../shared/helpers/async-handler.helper')
const apiResponse    = require('../../shared/helpers/response.helper')

const adminController = {

  previewDocx: asyncHandler(async (req, res) => {
    if (!req.file) throw { status: 400, message: 'No file uploaded' }

    const { subject } = req.body
    const data = await adminService.previewDocx(req.file.path, { subject })
    apiResponse.success(res, `${data.total} questions read successfully`, data)
  }),

  confirmImport: asyncHandler(async (req, res) => {
    const { questions } = req.body
    const data = await adminService.confirmImport(questions, req.user._id)
    apiResponse.success(
      res,
      `${data.created} question(s) imported, ${data.skipped} skipped`,
      data,
      201
    )
  }),

  getPlatformStats: asyncHandler(async (req, res) => {
    const data = await adminService.getPlatformStats()
    apiResponse.success(res, 'Platform stats fetched', data)
  }),

  listUsers: asyncHandler(async (req, res) => {
    const result = await adminService.listUsers(req.query)
    apiResponse.success(res, 'Users fetched', result.data, 200, result.meta)
  }),

  deleteUser: asyncHandler(async (req, res) => {
    const data = await adminService.deleteUser(req.params.userId)
    apiResponse.success(res, 'User deleted', data)
  })

}

module.exports = adminController