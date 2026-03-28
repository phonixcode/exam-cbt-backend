const examService  = require('./exam.service')
const asyncHandler = require('../../shared/helpers/async-handler.helper')
const apiResponse  = require('../../shared/helpers/response.helper')

const examController = {

  startExam: asyncHandler(async (req, res) => {
    const data = await examService.startExam(req.body, req.user._id)
    apiResponse.success(res, 'Exam started', data, 201)
  }),

  saveAnswer: asyncHandler(async (req, res) => {
    const data = await examService.saveAnswer(
      req.params.sessionId,
      req.user._id,
      req.body
    )
    apiResponse.success(res, 'Answer saved', data)
  }),

  submitExam: asyncHandler(async (req, res) => {
    const data = await examService.submitExam(
      req.params.sessionId,
      req.user._id,
      req.body.timeTaken
    )
    apiResponse.success(res, 'Exam submitted successfully', data)
  }),

  abandonExam: asyncHandler(async (req, res) => {
    const data = await examService.abandonExam(
      req.params.sessionId,
      req.user._id
    )
    apiResponse.success(res, 'Exam abandoned', data)
  }),

  getOngoingSession: asyncHandler(async (req, res) => {
    const data = await examService.getOngoingSession(req.user._id)
    apiResponse.success(res, 'Ongoing session fetched', data)
  }),

  getSession: asyncHandler(async (req, res) => {
    const data = await examService.getSession(
      req.params.sessionId,
      req.user._id
    )
    apiResponse.success(res, 'Session fetched', data)
  })

}

module.exports = examController