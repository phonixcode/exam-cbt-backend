const ExamSession       = require('./exam-session.model')
const questionService   = require('../questions/question.service')

const ENGLISH_QUESTIONS = 60    // Use of English always 60
const OTHER_QUESTIONS   = 40    // All other subjects 40
const MOCK_TIME         = 7200  // 2 hours flat for full mock (180 questions)
const SECS_PER_QUESTION = 40    // ~40 seconds per question for single subject

const isEnglish = (subject) =>
  subject.toLowerCase() === 'use of english'

const questionsForSubject = (subject) =>
  isEnglish(subject) ? ENGLISH_QUESTIONS : OTHER_QUESTIONS

// Mock: JAMB standard is 2 hours for all 180 questions together.
// Single: 40 seconds per question.
const timeForSubjects = (subjects, mode) =>
  mode === 'mock'
    ? MOCK_TIME
    : questionsForSubject(subjects[0]) * SECS_PER_QUESTION

const examService = {

  startExam: async (data, userId) => {
    const { mode, subjects, selectionType, yearFrom, yearTo, course } = data

    if (!subjects || subjects.length === 0)
      throw { status: 400, message: 'At least one subject is required' }

    if (mode === 'mock' && subjects.length !== 4)
      throw { status: 400, message: 'Mock exam requires exactly 4 subjects' }

    if (!yearFrom || !yearTo)
      throw { status: 400, message: 'Year range is required' }

    const ongoing = await ExamSession.findOne({ user: userId, status: 'ongoing' })
    if (ongoing)
      throw { status: 400, message: 'You have an ongoing exam. Please submit or abandon it first.' }

    // Fetch questions — English gets 60, others get 40
    const allAnswers = []

    for (const subject of subjects) {
      const limit = questionsForSubject(subject)

      const questions = await questionService.getExamQuestions({
        subject, selectionType, yearFrom, yearTo, limit
      })

      for (const q of questions) {
        allAnswers.push({
          question:      q._id,
          correctAnswer: q.correctAnswer,
          userAnswer:    null,
          isCorrect:     false,
          isFlagged:     false,
          timeSpent:     0
        })
      }
    }

    const session = await ExamSession.create({
      user:           userId,
      mode,
      subjects,
      selectionType,
      yearFrom:       parseInt(yearFrom),
      yearTo:         parseInt(yearTo),
      course:         course || null,
      timeAllowed:    timeForSubjects(subjects, mode),
      totalQuestions: allAnswers.length,
      answers:        allAnswers,
      status:         'ongoing'
    })

    return await ExamSession.findById(session._id)
      .populate({
        path:     'answers.question',
        populate: { path: 'passage', select: 'title passageText passageImage' }
      })
  },

  // ─── Save answer for a single question (auto-save) ───────
  saveAnswer: async (sessionId, userId, { questionId, userAnswer, isFlagged, timeSpent }) => {
    const session = await ExamSession.findOne({ _id: sessionId, user: userId })

    if (!session)                       throw { status: 404, message: 'Exam session not found' }
    if (session.status !== 'ongoing')   throw { status: 400, message: 'Exam session is not ongoing' }

    const answerIndex = session.answers.findIndex(
      a => a.question.toString() === questionId
    )

    if (answerIndex === -1) throw { status: 404, message: 'Question not found in this session' }

    // update only provided fields
    if (userAnswer  !== undefined) session.answers[answerIndex].userAnswer  = userAnswer
    if (isFlagged   !== undefined) session.answers[answerIndex].isFlagged   = isFlagged
    if (timeSpent   !== undefined) session.answers[answerIndex].timeSpent   = timeSpent

    await session.save()
    return { saved: true }
  },

  // ─── Submit exam & calculate results ─────────────────────
  submitExam: async (sessionId, userId, timeTaken) => {
    const session = await ExamSession.findOne({ _id: sessionId, user: userId })
      .populate('answers.question')

    if (!session)                       throw { status: 404, message: 'Exam session not found' }
    if (session.status !== 'ongoing')   throw { status: 400, message: 'Exam session already submitted' }

    // ── Score each answer ─────────────────────────────────────
    let totalScore = 0
    const subjectMap = {}

    for (const ans of session.answers) {
      const question = ans.question
      const subject  = question.subject

      // init subject tracker
      if (!subjectMap[subject]) {
        subjectMap[subject] = { score: 0, total: 0 }
      }
      subjectMap[subject].total++

      // check answer
      const isCorrect = examService._checkAnswer(
        question.type,
        ans.userAnswer,
        question.correctAnswer,
        question.acceptedAnswers
      )

      ans.isCorrect = isCorrect
      if (isCorrect) {
        totalScore++
        subjectMap[subject].score++
      }
    }

    // ── Calculate subject scores ──────────────────────────────
    const subjectScores = Object.entries(subjectMap).map(([subject, data]) => {
      const percentage = parseFloat(((data.score / data.total) * 100).toFixed(2))
      // JAMB: each subject scaled to 100, total out of 400
      const jambScore  = parseFloat((percentage).toFixed(2))
      return { subject, score: data.score, total: data.total, percentage, jambScore }
    })

    const totalPercentage = parseFloat(((totalScore / session.totalQuestions) * 100).toFixed(2))
    const jambTotal       = parseFloat(subjectScores.reduce((sum, s) => sum + s.jambScore, 0).toFixed(2))

    // ── Update session ────────────────────────────────────────
    session.status          = 'completed'
    session.timeTaken       = timeTaken || session.timeAllowed
    session.completedAt     = new Date()
    session.totalScore      = totalScore
    session.totalPercentage = totalPercentage
    session.jambTotal       = jambTotal
    session.subjectScores   = subjectScores

    await session.save()

    // ── Update user exam count ────────────────────────────────
    const User = require('../users/user.model')
    await User.findByIdAndUpdate(userId, { $inc: { totalExamsTaken: 1 }, lastActive: Date.now() })

    return await ExamSession.findById(session._id)
      .populate({
        path:     'answers.question',
        populate: { path: 'passage', select: 'title passageText passageImage' }
      })
  },

  // ─── Abandon an ongoing session ──────────────────────────
  abandonExam: async (sessionId, userId) => {
    const session = await ExamSession.findOne({ _id: sessionId, user: userId })

    if (!session)                       throw { status: 404, message: 'Exam session not found' }
    if (session.status !== 'ongoing')   throw { status: 400, message: 'Exam session is not ongoing' }

    session.status      = 'abandoned'
    session.completedAt = new Date()
    await session.save()

    return { abandoned: true }
  },

  // ─── Get ongoing session (resume exam) ───────────────────
  getOngoingSession: async (userId) => {
    const session = await ExamSession.findOne({ user: userId, status: 'ongoing' })
      .populate({
        path:     'answers.question',
        populate: { path: 'passage', select: 'title passageText passageImage' }
      })

    if (!session) throw { status: 404, message: 'No ongoing exam session found' }
    return session
  },

  // ─── Get single completed session (for review) ───────────
  getSession: async (sessionId, userId) => {
    const session = await ExamSession.findOne({ _id: sessionId, user: userId })
      .populate({
        path:     'answers.question',
        populate: { path: 'passage', select: 'title passageText passageImage' }
      })

    if (!session) throw { status: 404, message: 'Exam session not found' }
    return session
  },

  // ─── Internal — check typed or mcq answer ────────────────
  _checkAnswer: (type, userAnswer, correctAnswer, acceptedAnswers = []) => {
    if (!userAnswer) return false

    if (type === 'mcq') {
      return userAnswer.trim().toUpperCase() === correctAnswer.trim().toUpperCase()
    }

    // typed — check against correctAnswer + all accepted variants
    const normalize   = (str) => str.trim().toLowerCase()
    const normalized  = normalize(userAnswer)
    const allAccepted = [correctAnswer, ...acceptedAnswers].map(normalize)

    return allAccepted.includes(normalized)
  }

}

module.exports = examService