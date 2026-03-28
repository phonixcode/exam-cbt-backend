const mammoth        = require('mammoth')
const path           = require('path')
const fs             = require('fs')
const { v4: uuidv4 } = require('uuid')

const adminParser = {

  parseDocx: async (filePath, { subject, year }) => {
    const result = await mammoth.convertToHtml(
      { path: filePath },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          const imageBuffer = await image.read()
          const ext         = image.contentType.split('/')[1] || 'png'
          const filename    = `${uuidv4()}.${ext}`
          const savePath    = path.join('uploads', 'images', filename)
          fs.writeFileSync(savePath, imageBuffer)
          return { src: `/uploads/images/${filename}` }
        })
      }
    )

    const html      = result.value
    const questions = adminParser._parseHtml(html, subject, year)
    return { questions, warnings: result.messages }
  },

  _parseHtml: (html, subject, year) => {
    // convert html to clean lines
    const lines = html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p[^>]*>/gi,   '\n')
      .replace(/<\/p>/gi,      '\n')
      .replace(/<li[^>]*>/gi,  '\n')
      .replace(/<\/li>/gi,     '\n')
      .replace(/<[^>]+>/g,     '')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)

    const questions    = []
    let   current      = null
    let   currentPassage = null   // passage text being built
    let   passageTitle   = ''

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // ── Detect passage/read block ───────────────────
      // matches: "Read the passage", "Use the passage", "Read the following"
      const passageStartMatch = line.match(
        /^(read\s+the\s+(passage|following|extract)|use\s+the\s+(passage|extract)|passage\s*\d*|extract\s*\d*)/i
      )
      if (passageStartMatch) {
        // start collecting passage text
        currentPassage = ''
        passageTitle   = line
        continue
      }

      // ── Detect end of passage (when question starts) ─
      const questionMatch = line.match(/^(?:question\s*)?(\d+)[.)]\s+(.+)/i)

      if (questionMatch) {
        // if we were building a passage, stop
        if (currentPassage !== null && currentPassage.trim().length > 0) {
          // passage is ready — will be attached to questions
        }

        // save previous question
        if (current && adminParser._isValidQuestion(current)) {
          questions.push(current)
        }

        current = {
          subject:         subject.toLowerCase(),
          year:            parseInt(year),
          questionNumber:  parseInt(questionMatch[1]),
          type:            'mcq',
          questionText:    questionMatch[2].trim(),
          questionImage:   null,
          passageText:     currentPassage ? currentPassage.trim() : null,
          passageTitle:    passageTitle || null,
          options: {
            A: { text: '', image: null },
            B: { text: '', image: null },
            C: { text: '', image: null },
            D: { text: '', image: null }
          },
          correctAnswer:   '',
          acceptedAnswers: [],
          explanation:     'No explanation provided.',
          source:          `JAMB ${year}`
        }
        continue
      }

      // ── If we're in a passage block, collect text ───
      if (currentPassage !== null && !current) {
        // still in passage territory (no question started yet)
        const isOptionLine = line.match(/^\(?([A-Da-d])[.):\s]/)
        const isAnswerLine = line.match(/^(?:answer|ans|correct)[:\s]+/i)
        if (!isOptionLine && !isAnswerLine) {
          currentPassage += (currentPassage ? ' ' : '') + line
        }
        continue
      }

      if (!current) continue

      // ── Image ───────────────────────────────────────
      const imgMatch = line.match(/src="([^"]+)"/)
      if (imgMatch) {
        if (!current.questionImage) current.questionImage = imgMatch[1]
        continue
      }

      // ── Options ─────────────────────────────────────
      const optionMatch = line.match(/^\(?([A-Da-d])[.):\s]\s*(.+)/)
      if (optionMatch) {
        const key = optionMatch[1].toUpperCase()
        current.options[key].text = optionMatch[2].trim()
        continue
      }

      // ── Answer ──────────────────────────────────────
      const answerMatch = line.match(/^(?:answer|ans|correct\s*answer)[:\s]+([A-Da-d])/i)
      if (answerMatch) {
        current.correctAnswer = answerMatch[1].toUpperCase()

        // ── RESET passage after answer so next questions
        // don't inherit it (unless they're in the same group)
        // We reset only when a new non-passage question starts
        continue
      }

      // ── Explanation ─────────────────────────────────
      const explMatch = line.match(/^(?:explanation|reason|solution|note)[:\s]+(.+)/i)
      if (explMatch) {
        current.explanation = explMatch[1].trim()
        continue
      }

      // ── Append extra text to question ───────────────
      if (!current.correctAnswer) {
        current.questionText += ' ' + line
      }
    }

    // push last question
    if (current && adminParser._isValidQuestion(current)) {
      questions.push(current)
    }

    return questions
  },

  _isValidQuestion: (q) => {
    const hasText    = q.questionText?.trim().length > 0
    const hasOptions = q.type === 'mcq'
      ? (q.options.A.text && q.options.B.text)
      : true
    return hasText && hasOptions
  }
}

module.exports = adminParser