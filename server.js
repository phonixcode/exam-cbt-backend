const express    = require('express')
const cors       = require('cors')
const helmet     = require('helmet')
const morgan     = require('morgan')
const path       = require('path')
require('dotenv').config()

const connectDB  = require('./config/db')

const app = express()

app.use(helmet())
app.use(morgan('dev'))
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Exam CBT API is running!' })
})

app.use('/api/auth',      require('./modules/auth/auth.routes'))
app.use('/api/users',     require('./modules/users/user.routes'))
app.use('/api/questions', require('./modules/questions/question.routes'))
app.use('/api/exam',      require('./modules/exam/exam.routes'))
app.use('/api/results',   require('./modules/results/results.routes'))
app.use('/api/admin',     require('./modules/admin/admin.routes'))

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
})

app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`)
  const statusCode = err.status || err.statusCode || 500
  const message    = err.message || 'Internal Server Error'
  const errors     = err.errors  || null
  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors })
  })
})

const PORT = process.env.PORT || 5000

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
      console.log(`Environment: ${process.env.NODE_ENV}`)
    })
  })
  .catch((err) => {
    console.error('Failed to connect to database:', err.message)
    process.exit(1)
  })