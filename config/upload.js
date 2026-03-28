const multer  = require('multer')
const path    = require('path')
const { v4: uuidv4 } = require('uuid')

// ─── Docx upload storage ──────────────────────────────────
const docxStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/docx/')
  },
  filename: (req, file, cb) => {
    const ext      = path.extname(file.originalname)
    const filename = `${uuidv4()}${ext}`
    cb(null, filename)
  }
})

// ─── Image upload storage ─────────────────────────────────
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/images/')
  },
  filename: (req, file, cb) => {
    const ext      = path.extname(file.originalname)
    const filename = `${uuidv4()}${ext}`
    cb(null, filename)
  }
})

// ─── File filters ─────────────────────────────────────────
const docxFilter = (req, file, cb) => {
  const allowed = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb({ status: 400, message: 'Only .docx files are allowed' }, false)
  }
}

const imageFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb({ status: 400, message: 'Only image files are allowed' }, false)
  }
}

// ─── Exported uploaders ───────────────────────────────────
const uploadDocx  = multer({
  storage:  docxStorage,
  fileFilter: docxFilter,
  limits:   { fileSize: 10 * 1024 * 1024 }  // 10MB max
})

const uploadImage = multer({
  storage:  imageStorage,
  fileFilter: imageFilter,
  limits:   { fileSize: 5 * 1024 * 1024 }   // 5MB max
})

module.exports = { uploadDocx, uploadImage }