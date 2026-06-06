const mongoose = require('mongoose')

const optionSchema = new mongoose.Schema({
  text:  { type: String, default: '' },
  image: { type: String, default: null }  // server file path
}, { _id: false })

const questionSchema = new mongoose.Schema({
  // "subject" is the topic / subject area, e.g. "anatomy", "immunity"
  subject: {
    type:      String,
    required:  [true, 'Topic is required'],
    trim:      true,
    lowercase: true
  },
  questionNumber: {
    type:     Number,
    required: [true, 'Question number is required']
  },
  type: {
    type:    String,
    enum:    ['mcq', 'typed'],
    default: 'mcq'
  },

  // ─── Passage ref (optional) ───────────────────────────
  passage: {
    type:    mongoose.Schema.Types.ObjectId,
    ref:     'Passage',
    default: null
  },

  // ─── Question body ────────────────────────────────────
  questionText: {
    type:     String,
    required: [true, 'Question text is required'],
    trim:     true
  },
  questionImage: {
    type:    String,  // server file path
    default: null
  },

  // ─── MCQ options (only when type is "mcq") ────────────
  options: {
    A: { type: optionSchema, default: null },
    B: { type: optionSchema, default: null },
    C: { type: optionSchema, default: null },
    D: { type: optionSchema, default: null }
  },

  // ─── Answer ───────────────────────────────────────────
  correctAnswer: {
    type:     String,
    required: [true, 'Correct answer is required'],
    trim:     true
    // "A"|"B"|"C"|"D" for mcq  ||  actual value for typed
  },

  // typed questions — all accepted variants
  acceptedAnswers: {
    type:    [String],
    default: []
    // e.g. ["5x", "5X", "5x "] — we trim + lowercase on check
  },

  // ─── Explanation ──────────────────────────────────────
  explanation: {
    type:    String,
    trim:    true,
    default: 'No explanation provided.'
  },
  explanationImage: {
    type:    String,
    default: null
  },

  // ─── Meta ─────────────────────────────────────────────
  isActive: {
    type:    Boolean,
    default: true
  },
  source: {
    type:    String,
    trim:    true,
    default: ''
  },
  uploadedBy: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true
  }
}, { timestamps: true })

// ─── Indexes ──────────────────────────────────────────────
questionSchema.index({ subject: 1, questionNumber: 1 }, { unique: true })
questionSchema.index({ subject: 1, isActive: 1 })

module.exports = mongoose.model('Question', questionSchema)