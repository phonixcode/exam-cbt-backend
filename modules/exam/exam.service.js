const ExamSession       = require('./exam-session.model')
const questionService   = require('../questions/question.service')

const SECS_PER_QUESTION = 60    // ~1 minute per question for timed exams
const DEFAULT_PASS_MARK = 50    // percentage needed to pass

const examService = {

  // data: { mode, subjects, questionsPerTopic, examMode, passMark, timeAllowed }
  startExam: async (data, userId) => {
    const { mode, subjects, questionsPerTopic, examMode, passMark, timeAllowed } = data

    if (!subjects || subjects.length === 0)
      throw { status: 400, message: 'Please pick at least one topic' }

    if (mode === 'mock' && subjects.length < 2)
      throw { status: 400, message: 'A mock exam needs at least 2 topics' }

    const ongoing = await ExamSession.findOne({ user: userId, status: 'ongoing' })
    if (ongoing)
      throw { status: 400, message: 'You have an ongoing exam. Please submit or abandon it first.' }

    // how many questions to pull from each topic (blank = all available)
    const perTopic = questionsPerTopic ? parseInt(questionsPerTopic) : null

    const allAnswers = []

    for (const subject of subjects) {
      const questions = await questionService.getExamQuestions({
        subject, limit: perTopic
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

    const isPractice = examMode === 'practice'
    const time = isPractice
      ? 0
      : (timeAllowed ? parseInt(timeAllowed) : allAnswers.length * SECS_PER_QUESTION)

    const session = await ExamSession.create({
      user:           userId,
      mode,
      subjects,
      examMode:       isPractice ? 'practice' : 'timed',
      passMark:       passMark ? parseInt(passMark) : DEFAULT_PASS_MARK,
      timeAllowed:    time,
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

    // ── Calculate per-topic scores ────────────────────────────
    const subjectScores = Object.entries(subjectMap).map(([subject, data]) => {
      const percentage = parseFloat(((data.score / data.total) * 100).toFixed(2))
      return { subject, score: data.score, total: data.total, percentage }
    })

    const totalPercentage = parseFloat(((totalScore / session.totalQuestions) * 100).toFixed(2))

    // ── Update session ────────────────────────────────────────
    session.status          = 'completed'
    session.timeTaken       = timeTaken || session.timeAllowed
    session.completedAt     = new Date()
    session.totalScore      = totalScore
    session.totalPercentage = totalPercentage
    session.passed          = totalPercentage >= (session.passMark || DEFAULT_PASS_MARK)
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