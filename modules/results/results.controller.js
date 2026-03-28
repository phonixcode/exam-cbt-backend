const resultsService = require('./results.service')
const asyncHandler   = require('../../shared/helpers/async-handler.helper')
const apiResponse    = require('../../shared/helpers/response.helper')

const resultsController = {

  getUserResults: asyncHandler(async (req, res) => {
    const result = await resultsService.getUserResults(req.user._id, req.query)
    apiResponse.success(res, 'Results fetched', result.data, 200, result.meta)
  }),

  getSessionResult: asyncHandler(async (req, res) => {
    const data = await resultsService.getSessionResult(
      req.params.sessionId,
      req.user._id
    )
    apiResponse.success(res, 'Session result fetched', data)
  }),

  getDashboardStats: asyncHandler(async (req, res) => {
    const data = await resultsService.getDashboardStats(req.user._id)
    apiResponse.success(res, 'Dashboard stats fetched', data)
  }),

  getWeakAreas: asyncHandler(async (req, res) => {
    const data = await resultsService.getWeakAreas(req.user._id)
    apiResponse.success(res, 'Weak areas fetched', data)
  }),

  getAllResults: asyncHandler(async (req, res) => {
    const result = await resultsService.getAllResults(req.query)
    apiResponse.success(res, 'All results fetched', result.data, 200, result.meta)
  })

}

module.exports = resultsController