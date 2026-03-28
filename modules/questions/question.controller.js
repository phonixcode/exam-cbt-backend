const questionService = require('./question.service')
const asyncHandler    = require('../../shared/helpers/async-handler.helper')
const apiResponse     = require('../../shared/helpers/response.helper')

const questionController = {

  listQuestions: asyncHandler(async (req, res) => {
    const result = await questionService.listQuestions(req.query)
    apiResponse.success(res, 'Questions fetched', result.data, 200, result.meta)
  }),

  getQuestion: asyncHandler(async (req, res) => {
    const data = await questionService.getQuestion(req.params.id)
    apiResponse.success(res, 'Question fetched', data)
  }),

  createQuestion: asyncHandler(async (req, res) => {
    const data = await questionService.createQuestion(req.body, req.user._id)
    apiResponse.success(res, 'Question created', data, 201)
  }),

  bulkCreateQuestions: asyncHandler(async (req, res) => {
    const { questions } = req.body
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      throw { status: 400, message: 'Questions array is required' }
    }
    const data = await questionService.bulkCreateQuestions(questions, req.user._id)
    apiResponse.success(res, `${data.created} question(s) created, ${data.skipped} skipped`, data, 201)
  }),

  updateQuestion: asyncHandler(async (req, res) => {
    const data = await questionService.updateQuestion(req.params.id, req.body)
    apiResponse.success(res, 'Question updated', data)
  }),

  deactivateQuestion: asyncHandler(async (req, res) => {
    const data = await questionService.deactivateQuestion(req.params.id)
    apiResponse.success(res, 'Question deactivated', data)
  }),

  deleteQuestion: asyncHandler(async (req, res) => {
    const data = await questionService.deleteQuestion(req.params.id)
    apiResponse.success(res, 'Question deleted', data)
  }),

  getSubjectsAndYears: asyncHandler(async (req, res) => {
    const data = await questionService.getSubjectsAndYears()
    apiResponse.success(res, 'Subjects and years fetched', data)
  }),

  getQuestionStats: asyncHandler(async (req, res) => {
    const data = await questionService.getQuestionStats()
    apiResponse.success(res, 'Question stats fetched', data)
  }),

  // ─── Passage controllers ──────────────────────────────────
  createPassage: asyncHandler(async (req, res) => {
    const data = await questionService.createPassage(req.body, req.user._id)
    apiResponse.success(res, 'Passage created', data, 201)
  }),

  listPassages: asyncHandler(async (req, res) => {
    const result = await questionService.listPassages(req.query)
    apiResponse.success(res, 'Passages fetched', result.data, 200, result.meta)
  }),

  getPassage: asyncHandler(async (req, res) => {
    const data = await questionService.getPassage(req.params.id)
    apiResponse.success(res, 'Passage fetched', data)
  })

}

module.exports = questionController