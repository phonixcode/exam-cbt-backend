const ExamSession      = require('../exam/exam-session.model')
const { paginate,
        paginateMeta } = require('../../shared/helpers/pagination.helper')

const resultsService = {

  // ─── Get all past sessions for a user (dashboard) ────────
  getUserResults: async (userId, query) => {
    const { page, limit, skip } = paginate(query)
    const filter = { user: userId, status: 'completed' }

    if (query.subject) {
      filter.subjects = { $in: [query.subject.toLowerCase()] }
    }

    if (query.mode) filter.mode = query.mode

    if (query.from || query.to) {
      filter.createdAt = {}
      if (query.from) filter.createdAt.$gte = new Date(query.from)
      if (query.to)   filter.createdAt.$lte = new Date(query.to)
    }

    const [data, total] = await Promise.all([
      ExamSession.find(filter)
        .select('-answers')   // exclude full answers for list view
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      ExamSession.countDocuments(filter)
    ])

    return { data, meta: paginateMeta(total, page, limit) }
  },

  // ─── Get single session result with full review ───────────
  getSessionResult: async (sessionId, userId) => {
    const session = await ExamSession.findOne({
      _id:    sessionId,
      user:   userId,
      status: 'completed'
    }).populate({
      path:     'answers.question',
      populate: { path: 'passage', select: 'title passageText passageImage' }
    })

    if (!session) throw { status: 404, message: 'Result not found' }
    return session
  },

  // ─── Dashboard summary stats for a user ──────────────────
  getDashboardStats: async (userId) => {
    const sessions = await ExamSession.find({
      user:   userId,
      status: 'completed'
    }).select('subjects mode jambTotal totalPercentage subjectScores createdAt timeTaken')

    if (sessions.length === 0) {
      return {
        totalExams:       0,
        averageScore:     0,
        bestScore:        0,
        totalTimePracticed: 0,
        subjectStats:     [],
        recentSessions:   [],
        trend:            []
      }
    }

    // ── Overall stats ──────────────────────────────────────
    const totalExams         = sessions.length
    const averageScore       = parseFloat(
      (sessions.reduce((sum, s) => sum + s.totalPercentage, 0) / totalExams).toFixed(2)
    )
    const bestScore          = Math.max(...sessions.map(s => s.jambTotal))
    const totalTimePracticed = sessions.reduce((sum, s) => sum + s.timeTaken, 0)

    // ── Per subject stats ──────────────────────────────────
    const subjectMap = {}

    for (const session of sessions) {
      for (const ss of session.subjectScores) {
        if (!subjectMap[ss.subject]) {
          subjectMap[ss.subject] = {
            subject:    ss.subject,
            attempts:   0,
            totalScore: 0,
            bestScore:  0,
            scores:     []
          }
        }
        subjectMap[ss.subject].attempts++
        subjectMap[ss.subject].totalScore += ss.percentage
        subjectMap[ss.subject].scores.push(ss.percentage)
        if (ss.percentage > subjectMap[ss.subject].bestScore) {
          subjectMap[ss.subject].bestScore = ss.percentage
        }
      }
    }

    const subjectStats = Object.values(subjectMap).map(s => ({
      subject:      s.subject,
      attempts:     s.attempts,
      averageScore: parseFloat((s.totalScore / s.attempts).toFixed(2)),
      bestScore:    s.bestScore,
      trend:        s.scores.slice(-5)   // last 5 scores for mini chart
    }))

    // ── Score trend (last 10 exams) ────────────────────────
    const trend = sessions
      .slice(-10)
      .map(s => ({
        date:       s.createdAt,
        jambTotal:  s.jambTotal,
        percentage: s.totalPercentage,
        mode:       s.mode
      }))

    // ── Recent 5 sessions ──────────────────────────────────
    const recentSessions = sessions
      .slice(-5)
      .reverse()
      .map(s => ({
        _id:        s._id,
        subjects:   s.subjects,
        mode:       s.mode,
        jambTotal:  s.jambTotal,
        percentage: s.totalPercentage,
        timeTaken:  s.timeTaken,
        date:       s.createdAt
      }))

    return {
      totalExams,
      averageScore,
      bestScore,
      totalTimePracticed,
      subjectStats,
      recentSessions,
      trend
    }
  },

  // ─── Get weak areas (questions answered wrongly most) ────
  getWeakAreas: async (userId) => {
    const sessions = await ExamSession.find({
      user:   userId,
      status: 'completed'
    }).populate('answers.question', 'subject questionText year')

    const subjectWrong = {}

    for (const session of sessions) {
      for (const ans of session.answers) {
        if (!ans.isCorrect && ans.question) {
          const subject = ans.question.subject
          if (!subjectWrong[subject]) subjectWrong[subject] = 0
          subjectWrong[subject]++
        }
      }
    }

    const weakAreas = Object.entries(subjectWrong)
      .map(([subject, wrongCount]) => ({ subject, wrongCount }))
      .sort((a, b) => b.wrongCount - a.wrongCount)

    return weakAreas
  },

  // ─── Admin — get all results across all users ─────────────
  getAllResults: async (query) => {
    const { page, limit, skip } = paginate(query)
    const filter = { status: 'completed' }

    if (query.userId)  filter.user    = query.userId
    if (query.subject) filter.subjects = { $in: [query.subject.toLowerCase()] }
    if (query.mode)    filter.mode    = query.mode

    const [data, total] = await Promise.all([
      ExamSession.find(filter)
        .select('-answers')
        .populate('user', 'name phoneNumber')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      ExamSession.countDocuments(filter)
    ])

    return { data, meta: paginateMeta(total, page, limit) }
  }

}

module.exports = resultsService