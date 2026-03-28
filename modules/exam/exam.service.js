const ExamSession       = require('./exam-session.model')
const questionService   = require('../questions/question.service')

// const JAMB_TIME_ALLOWED = 6000  // 1hr 40min in seconds
const JAMB_TIME_PER_SUBJECT = 1500  // 25 mins per subject in seconds
const QUESTIONS_PER_SUBJECT = 60

const examService = {

  // ─── Start a new exam session ────────────────────────────
  startExam: async (data, userId) => {
    const { mode, subjects, selectionType, yearFrom, yearTo } = data

    // ── Validate ────────────────────────────────────────────
    if (!subjects || subjects.length === 0) {
      throw { status: 400, message: 'At least one subject is required' }
    }

    if (mode === 'mock' && subjects.length !== 4) {
      throw { status: 400, message: 'Mock exam requires exactly 4 subjects' }
    }

    if (!yearFrom || !yearTo) {
      throw { status: 400, message: 'Year range is required' }
    }

    if (parseInt(yearFrom) > parseInt(yearTo)) {
      throw { status: 400, message: 'yearFrom cannot be greater than yearTo' }
    }

    if (selectionType === 'specific' && yearFrom !== yearTo) {
      throw { status: 400, message: 'Specific selection requires yearFrom and yearTo to be the same' }
    }

    // ── Check for ongoing session ────────────────────────────
    const ongoing = await ExamSession.findOne({ user: userId, status: 'ongoing' })
    if (ongoing) {
      throw { status: 400, message: 'You have an ongoing exam session. Please submit or abandon it first.' }
    }

    // ── Fetch questions for each subject ─────────────────────
    const allAnswers      = []
    const totalQuestions  = subjects.length * QUESTIONS_PER_SUBJECT

    for (const subject of subjects) {
      const questions = await questionService.getExamQuestions({
        subject,
        selectionType,
        yearFrom,
        yearTo,
        limit: QUESTIONS_PER_SUBJECT
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

    const timeAllowed = mode === 'mock'
      ? JAMB_TIME_PER_SUBJECT * 4        // 6000s = 1hr 40min for 4 subjects
      : JAMB_TIME_PER_SUBJECT * subjects.length  // 1500s = 25min per subject

    const session = await ExamSession.create({
      user:           userId,
      mode,
      subjects,
      selectionType,
      yearFrom:       parseInt(yearFrom),
      yearTo:         parseInt(yearTo),
      timeAllowed,
      totalQuestions: allAnswers.length,
      answers:        allAnswers,
      status:         'ongoing'
    })

    // ── Return session with populated questions ───────────────
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
      const jambScore  = parseFloat(((data.score / data.total) * 100).toFixed(2))
      // each subject scaled to 100, total 400 across 4 subjects
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