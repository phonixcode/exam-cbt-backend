const fs              = require('fs')
const adminParser     = require('./admin.parser')
const questionService = require('../questions/question.service')
const ExamSession     = require('../exam/exam-session.model')
const User            = require('../users/user.model')
const { paginate,
        paginateMeta } = require('../../shared/helpers/pagination.helper')

const adminService = {

  // ─── Parse docx and return preview (don't save yet) ──────
  previewDocx: async (filePath, { subject }) => {
    if (!subject) throw { status: 400, message: 'Please choose a topic for these questions' }

    const { questions } = await adminParser.parseDocx(filePath, { subject })

    // clean up uploaded docx after parsing
    fs.unlinkSync(filePath)

    if (questions.length === 0) {
      throw {
        status:  400,
        message: 'No questions could be read from this file. Check the document format.'
      }
    }

    return {
      total:    questions.length,
      subject,
      questions
    }
  },

  // ─── Confirm and save previewed questions ─────────────────
  confirmImport: async (questions, userId) => {
    if (!questions || questions.length === 0) {
      throw { status: 400, message: 'No questions provided' }
    }

    const Question = require('../questions/question.model')
    const Passage  = require('../questions/passage.model')

    const results = { created: 0, skipped: 0, errors: [] }

    // Group questions by their passageText to avoid duplicate passages
    const passageCache = {}

    for (const q of questions) {
      let passageId = null

      // Create passage if question has passage text
      if (q.passageText && q.passageText.trim().length > 20) {
        const cacheKey = q.passageText.substring(0, 100)

        if (passageCache[cacheKey]) {
          passageId = passageCache[cacheKey]
        } else {
          const passage = await Passage.create({
            subject:     q.subject,
            title:       q.passageTitle || `Passage — ${q.subject}`,
            passageText: q.passageText.trim(),
            uploadedBy:  userId
          })
          passageId = passage._id
          passageCache[cacheKey] = passageId
        }
      }

      // Check for duplicate
      const exists = await Question.findOne({
        subject:        q.subject.toLowerCase(),
        questionNumber: q.questionNumber
      })

      if (exists) { results.skipped++; continue }

      await Question.create({
        subject:        q.subject.toLowerCase(),
        questionNumber: q.questionNumber,
        type:           q.type || 'mcq',
        passage:        passageId,
        questionText:   q.questionText,
        questionImage:  q.questionImage || null,
        options:        q.options,
        correctAnswer:  q.correctAnswer,
        acceptedAnswers: q.acceptedAnswers || [],
        explanation:    q.explanation || 'No explanation provided.',
        source:         q.source || '',
        isActive:       true,
        uploadedBy:     userId
      })
      results.created++
    }

    return results
  },

  // ─── Get platform overview stats ─────────────────────────
  getPlatformStats: async () => {
    const [
      totalUsers,
      totalStudents,
      totalAdmins,
      totalQuestions,
      totalSessions,
      completedSessions
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'admin' }),
      require('../questions/question.model').countDocuments({ isActive: true }),
      ExamSession.countDocuments(),
      ExamSession.countDocuments({ status: 'completed' })
    ])

    const subjectStats = await questionService.getQuestionStats()

    return {
      users: {
        total:    totalUsers,
        students: totalStudents,
        admins:   totalAdmins
      },
      questions: {
        total:    totalQuestions,
        bySubject: subjectStats
      },
      exams: {
        total:     totalSessions,
        completed: completedSessions,
        abandoned: totalSessions - completedSessions
      }
    }
  },

  // ─── List all users (admin view) ─────────────────────────
  listUsers: async (query) => {
    const { page, limit, skip } = paginate(query)
    const filter = {}

    if (query.role)   filter.role = query.role
    if (query.search) {
      filter.$or = [
        { name:        { $regex: query.search, $options: 'i' } },
        { phoneNumber: { $regex: query.search, $options: 'i' } }
      ]
    }

    const [data, total] = await Promise.all([
      User.find(filter).select('-pin').skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments(filter)
    ])

    return { data, meta: paginateMeta(total, page, limit) }
  },

  // ─── Toggle user active status ────────────────────────────
  deleteUser: async (userId) => {
    const user = await User.findByIdAndDelete(userId)
    if (!user) throw { status: 404, message: 'User not found' }
    return { deleted: true }
  }

}

module.exports = adminService