const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

const userSchema = new mongoose.Schema({
  name: {
    type:     String,
    required: [true, 'Name is required'],
    trim:     true
  },
  phoneNumber: {
    type:     String,
    required: [true, 'Phone number is required'],
    unique:   true,
    trim:     true
  },
  pin: {
    type:      String,
    required:  [true, 'PIN is required'],
    minlength: 4,
    select:    false  // never returned in queries by default
  },
  role: {
    type:    String,
    enum:    ['student', 'admin'],
    default: 'student'
  },
  subjects: {
    type:    [String],
    default: []
  },
  totalExamsTaken: {
    type:    Number,
    default: 0
  },
  lastActive: {
    type:    Date,
    default: Date.now
  }
}, { timestamps: true })

// ─── Hash PIN before saving ───────────────────────────────
userSchema.pre('save', async function () {
  if (!this.isModified('pin')) return
  const salt = await bcrypt.genSalt(10)
  this.pin   = await bcrypt.hash(this.pin, salt)
})

// ─── Compare entered PIN with stored hash ─────────────────
userSchema.methods.matchPin = async function (enteredPin) {
  return await bcrypt.compare(enteredPin, this.pin)
}

module.exports = mongoose.model('User', userSchema)