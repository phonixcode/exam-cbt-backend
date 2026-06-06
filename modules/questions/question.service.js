const Question              = require('./question.model')
const Passage               = require('./passage.model')
const { paginate,
        paginateMeta }      = require('../../shared/helpers/pagination.helper')

const questionService = {

  listQuestions: async (query) => {
    const { page, limit, skip } = paginate(query)
    const filter = { isActive: true }

    if (query.subject) filter.subject = query.subject.toLowerCase()
    if (query.type)    filter.type    = query.type

    if (query.search) {
      filter.$or = [
        { questionText:  { $regex: query.search, $options: 'i' } },
        { explanation:   { $regex: query.search, $options: 'i' } }
      ]
    }

    const [data, total] = await Promise.all([
      Question.find(filter)
        .populate('passage', 'title passageText passageImage')
        .skip(skip)
        .limit(limit)
        .sort({ subject: 1, questionNumber: 1 }),
      Question.countDocuments(filter)
    ])

    return { data, meta: paginateMeta(total, page, limit) }
  },

  getQuestion: async (id) => {
    const question = await Question.findById(id)
      .populate('passage', 'title passageText passageImage')
    if (!question) throw { status: 404, message: 'Question not found' }
    return question
  },


  getExamQuestions: async ({ subject, limit = null }) => {
    const filter = { isActive: true, subject: subject.toLowerCase() }

    const questions = await Question.find(filter)
      .populate('passage', 'title passageText passageImage')

    if (questions.length === 0) {
      throw { status: 404, message: `No questions found for "${subject}"` }
    }

    // shuffle for randomness
    const shuffled = questions.sort(() => Math.random() - 0.5)

    return limit ? shuffled.slice(0, limit) : shuffled
  },

  createQuestion: async (data, userId) => {
    const exists = await Question.findOne({
      subject:        data.subject.toLowerCase(),
      questionNumber: data.questionNumber
    })

    if (exists) {
      throw {
        status:  400,
        message: `Question ${data.questionNumber} for "${data.subject}" already exists`
      }
    }

    return await Question.create({ ...data, uploadedBy: userId })
  },

  bulkCreateQuestions: async (questions, userId) => {
    const results = { created: 0, skipped: 0, errors: [] }

    for (const q of questions) {
      const exists = await Question.findOne({
        subject:        q.subject.toLowerCase(),
        questionNumber: q.questionNumber
      })

      if (exists) {
        results.skipped++
        continue
      }

      await Question.create({ ...q, uploadedBy: userId })
      results.created++
    }

    return results
  },

  updateQuestion: async (id, data) => {
    const question = await Question.findByIdAndUpdate(
      id,
      { ...data },
      { new: true, runValidators: true }
    )
    if (!question) throw { status: 404, message: 'Question not found' }
    return question
  },

  deactivateQuestion: async (id) => {
    const question = await Question.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    )
    if (!question) throw { status: 404, message: 'Question not found' }
    return question
  },

  deleteQuestion: async (id) => {
    const question = await Question.findByIdAndDelete(id)
    if (!question) throw { status: 404, message: 'Question not found' }
    return { deleted: true }
  },

  getSubjects: async () => {
    const subjects = await Question.distinct('subject', { isActive: true })
    return { subjects: subjects.sort() }
  },

  getQuestionStats: async () => {
    const stats = await Question.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$subject', totalCount: { $sum: 1 } } },
      { $sort:  { _id: 1 } }
    ])

    return stats
  },

  createPassage: async (data, userId) => {
    return await Passage.create({ ...data, uploadedBy: userId })
  },

  listPassages: async (query) => {
    const { page, limit, skip } = paginate(query)
    const filter = {}

    if (query.subject) filter.subject = query.subject.toLowerCase()

    const [data, total] = await Promise.all([
      Passage.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Passage.countDocuments(filter)
    ])

    return { data, meta: paginateMeta(total, page, limit) }
  },

  getPassage: async (id) => {
    const passage = await Passage.findById(id)
    if (!passage) throw { status: 404, message: 'Passage not found' }
    return passage
  }

}

module.exports = questionService