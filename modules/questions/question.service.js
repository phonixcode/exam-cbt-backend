const Question              = require('./question.model')
const Passage               = require('./passage.model')
const { paginate,
        paginateMeta }      = require('../../shared/helpers/pagination.helper')

const questionService = {

  // ─── List questions with filters ────────────────────────
  listQuestions: async (query) => {
    const { page, limit, skip } = paginate(query)
    const filter = { isActive: true }

    if (query.subject) filter.subject = query.subject.toLowerCase()
    if (query.year)    filter.year    = parseInt(query.year)
    if (query.type)    filter.type    = query.type

    if (query.yearFrom || query.yearTo) {
      filter.year = {}
      if (query.yearFrom) filter.year.$gte = parseInt(query.yearFrom)
      if (query.yearTo)   filter.year.$lte = parseInt(query.yearTo)
    }

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
        .sort({ year: -1, questionNumber: 1 }),
      Question.countDocuments(filter)
    ])

    return { data, meta: paginateMeta(total, page, limit) }
  },

  // ─── Get single question ─────────────────────────────────
  getQuestion: async (id) => {
    const question = await Question.findById(id)
      .populate('passage', 'title passageText passageImage')
    if (!question) throw { status: 404, message: 'Question not found' }
    return question
  },

  // ─── Get questions for exam session ─────────────────────
  getExamQuestions: async ({ subject, selectionType, yearFrom, yearTo, limit = 60 }) => {
    const filter = { isActive: true, subject: subject.toLowerCase() }

    if (selectionType === 'specific') {
      filter.year = parseInt(yearFrom)
    } else {
      filter.year = {
        $gte: parseInt(yearFrom),
        $lte: parseInt(yearTo)
      }
    }

    // get questions then shuffle for randomness
    const questions = await Question.find(filter)
      .populate('passage', 'title passageText passageImage')
      .sort({ year: 1, questionNumber: 1 })

    if (questions.length === 0) {
      throw { status: 404, message: `No questions found for ${subject}` }
    }

    // shuffle array
    const shuffled = questions.sort(() => Math.random() - 0.5)

    // return up to limit
    return shuffled.slice(0, limit)
  },

  // ─── Create single question ──────────────────────────────
  createQuestion: async (data, userId) => {
    const exists = await Question.findOne({
      subject:        data.subject.toLowerCase(),
      year:           data.year,
      questionNumber: data.questionNumber
    })

    if (exists) {
      throw {
        status:  400,
        message: `Question ${data.questionNumber} for ${data.subject} ${data.year} already exists`
      }
    }

    return await Question.create({ ...data, uploadedBy: userId })
  },

  // ─── Bulk create questions ───────────────────────────────
  bulkCreateQuestions: async (questions, userId) => {
    const results = { created: 0, skipped: 0, errors: [] }

    for (const q of questions) {
      const exists = await Question.findOne({
        subject:        q.subject.toLowerCase(),
        year:           q.year,
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

  // ─── Update question ─────────────────────────────────────
  updateQuestion: async (id, data) => {
    const question = await Question.findByIdAndUpdate(
      id,
      { ...data },
      { new: true, runValidators: true }
    )
    if (!question) throw { status: 404, message: 'Question not found' }
    return question
  },

  // ─── Soft delete (deactivate) ────────────────────────────
  deactivateQuestion: async (id) => {
    const question = await Question.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    )
    if (!question) throw { status: 404, message: 'Question not found' }
    return question
  },

  // ─── Hard delete ─────────────────────────────────────────
  deleteQuestion: async (id) => {
    const question = await Question.findByIdAndDelete(id)
    if (!question) throw { status: 404, message: 'Question not found' }
    return { deleted: true }
  },

  // ─── Get available subjects and years (for filters) ──────
  getSubjectsAndYears: async () => {
    const [subjects, years] = await Promise.all([
      Question.distinct('subject', { isActive: true }),
      Question.distinct('year',    { isActive: true })
    ])

    return {
      subjects: subjects.sort(),
      years:    years.sort((a, b) => b - a)
    }
  },

  // ─── Stats per subject ───────────────────────────────────
  getQuestionStats: async () => {
    const stats = await Question.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id:   { subject: '$subject', year: '$year' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id:        '$_id.subject',
          totalCount: { $sum: '$count' },
          years: {
            $push: { year: '$_id.year', count: '$count' }
          }
        }
      },
      { $sort: { _id: 1 } }
    ])

    return stats
  },

  // ─── Passage methods ─────────────────────────────────────
  createPassage: async (data, userId) => {
    return await Passage.create({ ...data, uploadedBy: userId })
  },

  listPassages: async (query) => {
    const { page, limit, skip } = paginate(query)
    const filter = {}

    if (query.subject) filter.subject = query.subject.toLowerCase()
    if (query.year)    filter.year    = parseInt(query.year)

    const [data, total] = await Promise.all([
      Passage.find(filter).skip(skip).limit(limit).sort({ year: -1 }),
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