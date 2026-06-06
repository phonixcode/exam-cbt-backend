const mongoose = require('mongoose')

const answerSchema = new mongoose.Schema({
  question: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Question',
    required: true
  },
  userAnswer: {
    type:    String,
    default: null    // null = unattempted
  },
  correctAnswer: {
    type:     String,
    required: true
  },
  isCorrect: {
    type:    Boolean,
    default: false
  },
  isFlagged: {
    type:    Boolean,  // bookmarked during exam for revisit
    default: false
  },
  timeSpent: {
    type:    Number,   // seconds spent on this question
    default: 0
  }
}, { _id: false })

const subjectScoreSchema = new mongoose.Schema({
  subject:    { type: String,  required: true },
  score:      { type: Number,  default: 0 },   // raw correct count
  total:      { type: Number,  required: true },
  percentage: { type: Number,  default: 0 }
}, { _id: false })

const examSessionSchema = new mongoose.Schema({
  user: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true
  },

  // ─── Exam config ────────────────────────────────────────
  // single = one topic, mock = several topics together
  mode: {
    type:     String,
    enum:     ['single', 'mock'],
    required: true
  },
  examMode: {
    type:    String,
    enum:    ['timed', 'practice'],
    default: 'timed'
  },
  // topics chosen for this exam
  subjects: {
    type:     [String],
    required: true
  },
  passMark: {
    type:    Number,
    default: 50    // percentage needed to pass
  },

  // ─── Timing ─────────────────────────────────────────────
  timeAllowed: {
    type:    Number,
    default: 0        // seconds; 0 = untimed (practice)
  },
  timeTaken: {
    type:    Number,  // actual seconds used
    default: 0
  },
  startedAt: {
    type:    Date,
    default: Date.now
  },
  completedAt: {
    type:    Date,
    default: null
  },

  // ─── Status ─────────────────────────────────────────────
  status: {
    type:    String,
    enum:    ['ongoing', 'completed', 'abandoned'],
    default: 'ongoing'
  },

  // ─── Questions & answers ─────────────────────────────────
  answers: [answerSchema],

  totalQuestions: {
    type:     Number,
    required: true
  },

  // ─── Results (populated on submit) ──────────────────────
  totalScore:      { type: Number,  default: 0 },   // raw correct count
  totalPercentage: { type: Number,  default: 0 },
  passed:          { type: Boolean, default: false },
  subjectScores:   [subjectScoreSchema]

}, { timestamps: true })

examSessionSchema.index({ user: 1, createdAt: -1 })
examSessionSchema.index({ user: 1, status: 1 })

module.exports = mongoose.model('ExamSession', examSessionSchema)