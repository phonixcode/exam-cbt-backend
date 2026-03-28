const mongoose = require('mongoose')

const passageSchema = new mongoose.Schema({
  subject: {
    type:     String,
    required: [true, 'Subject is required'],
    trim:     true,
    lowercase: true
  },
  year: {
    type:     Number,
    required: [true, 'Year is required']
  },
  title: {
    type:    String,
    trim:    true,
    default: ''
  },
  passageText: {
    type:     String,
    required: [true, 'Passage text is required'],
    trim:     true
  },
  passageImage: {
    type:    String,  // server file path
    default: null
  },
  uploadedBy: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true
  }
}, { timestamps: true })

passageSchema.index({ subject: 1, year: 1 })

module.exports = mongoose.model('Passage', passageSchema)