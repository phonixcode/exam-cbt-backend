const mammoth        = require('mammoth')
const path           = require('path')
const fs             = require('fs')
const { v4: uuidv4 } = require('uuid')

const adminParser = {

  // ─── Convert a .docx into an array of question objects ────
  // `subject` is the topic/subject area (e.g. "anatomy"). No year needed.
  parseDocx: async (filePath, { subject }) => {
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

    const questions = adminParser._parseHtml(result.value, subject)
    return { questions, warnings: result.messages }
  },

  // ─── Turn the converted HTML into clean text lines ───────
  _toLines: (html) => {
    return html
      // preserve images as a sentinel line before stripping tags
      .replace(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi, '\n[[IMG:$1]]\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(p|li|div|tr|h[1-6])[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      // decode the handful of entities mammoth emits
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi,  '&')
      .replace(/&lt;/gi,   '<')
      .replace(/&gt;/gi,   '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi,  "'")
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
  },

  // ─── Split a line into A/B/C/D options ───────────────────
  // Handles options crammed onto one line: "A. NeuronB. NephronC. ..."
  // Returns { questionPart, options } or null if a full A→D run isn't found.
  _extractOptions: (text) => {
    const re = /([ABCD])[.)]\s*/g
    const marks = []
    let m
    while ((m = re.exec(text)) !== null) {
      marks.push({ label: m[1], start: m.index, textStart: re.lastIndex })
    }
    if (marks.length === 0) return null

    // find an in-order A → B → C → D run
    const after = (label, from) => marks.find(p => p.label === label && p.start >= from)
    const a = after('A', 0);            if (!a) return null
    const b = after('B', a.textStart);  if (!b) return null
    const c = after('C', b.textStart);  if (!c) return null
    const d = after('D', c.textStart);  if (!d) return null

    const clean = (s) => s.replace(/^[.):\s-]+/, '').trim()
    // option D runs to end of line; drop a trailing inline "Answer: X" if present
    let dText = text.slice(d.textStart).replace(/\s*(?:answer|ans|correct\s*answer)\s*[:\s].*$/i, '')

    return {
      questionPart: text.slice(0, a.start).trim(),
      options: {
        A: clean(text.slice(a.textStart, b.start)),
        B: clean(text.slice(b.textStart, c.start)),
        C: clean(text.slice(c.textStart, d.start)),
        D: clean(dText)
      }
    }
  },

  // ─── A single option on its own line: "A. Neuron" ────────
  _singleOption: (text) => {
    const m = text.match(/^\(?([A-Da-d])[.)]\s+(.+)$/)
    return m ? { label: m[1].toUpperCase(), text: m[2].trim() } : null
  },

  _stripLeadingNumber: (text) =>
    text.replace(/^\(?\s*(?:question\s*)?\d+\s*[.):]\s*/i, '').trim(),

  _newQuestion: (subject, number, questionText = '') => ({
    subject:         subject.toLowerCase(),
    questionNumber:  number,
    type:            'mcq',
    questionText:    questionText,
    questionImage:   null,
    passageText:     null,
    passageTitle:    null,
    options: {
      A: { text: '', image: null },
      B: { text: '', image: null },
      C: { text: '', image: null },
      D: { text: '', image: null }
    },
    correctAnswer:   '',
    acceptedAnswers: [],
    explanation:     'No explanation provided.',
    source:          '',
    _hasOptions:     false
  }),

  _parseHtml: (html, subject) => {
    const lines        = adminParser._toLines(html)
    const questions    = []
    let   current      = null     // question currently collecting options/answer
    let   stem         = ''       // buffered question text awaiting its options
    let   counter      = 0
    let   passageText  = ''       // shared passage for following questions
    let   passageTitle = ''
    let   inPassage    = false

    const flush = () => {
      if (current && adminParser._isValidQuestion(current)) {
        current.questionText = adminParser._stripLeadingNumber(current.questionText)
        delete current._hasOptions
        questions.push(current)
      }
      current = null
    }

    // Begin a new question from the buffered stem (+ any inline stem text)
    const begin = (inlineStem = '') => {
      flush()
      const text = `${stem} ${inlineStem}`.trim()
      current = adminParser._newQuestion(subject, ++counter, text)
      if (passageText) { current.passageText = passageText.trim(); current.passageTitle = passageTitle }
      stem = ''
    }

    for (const line of lines) {
      // ── Image sentinel ─────────────────────────────────
      const imgMatch = line.match(/^\[\[IMG:([^\]]+)\]\]$/)
      if (imgMatch) {
        if (current && !current.questionImage) current.questionImage = imgMatch[1]
        continue
      }

      // ── Answer line ────────────────────────────────────
      const answerMatch = line.match(/^(?:answer|ans|correct\s*answer)\s*[:\s]\s*\(?([A-Da-d])\b/i)
      if (answerMatch && current) {
        current.correctAnswer = answerMatch[1].toUpperCase()
        continue
      }

      // ── Explanation line ───────────────────────────────
      const explMatch = line.match(/^(?:explanation|reason|solution|note)\s*[:\s]\s*(.+)/i)
      if (explMatch && current) {
        current.explanation = explMatch[1].trim()
        continue
      }

      // ── All options bunched on one line ────────────────
      const opts = adminParser._extractOptions(line)
      if (opts) {
        begin(opts.questionPart)
        current.options.A.text = opts.options.A
        current.options.B.text = opts.options.B
        current.options.C.text = opts.options.C
        current.options.D.text = opts.options.D
        current._hasOptions    = true
        continue
      }

      // ── A single option on its own line ────────────────
      const single = adminParser._singleOption(line)
      if (single) {
        if (single.label === 'A' || !current || !current._hasOptions) {
          if (single.label === 'A') begin()       // 'A' opens a fresh question
          if (!current) begin()                   // stray option without a question
        }
        current.options[single.label].text = single.text
        current._hasOptions = true
        continue
      }

      // ── Bare number marker ("1." on its own line) ──────
      if (/^\(?\s*(?:question\s*)?\d+\s*[.):]\s*$/i.test(line)) {
        flush()
        stem = ''            // real stem follows on the next line(s)
        continue
      }

      // ── Passage / comprehension block ──────────────────
      if (/^(read\s+the\s+(passage|following|extract)|use\s+the\s+(passage|extract)|passage\s*\d*|extract\s*\d*)\b/i.test(line)) {
        flush()
        inPassage    = true
        passageText  = ''
        passageTitle = line
        stem         = ''
        continue
      }

      // ── Plain text — passage body or question stem ─────
      if (inPassage && !current) {
        passageText += (passageText ? ' ' : '') + line
      } else {
        // buffer as (part of) the next question's stem
        flush()
        stem = `${stem} ${line}`.trim()
      }
    }

    flush()
    return questions
  },

  _isValidQuestion: (q) => {
    const hasText    = q.questionText?.trim().length > 0
    const hasOptions = q.options.A.text && q.options.B.text
    return hasText && hasOptions
  }
}

module.exports = adminParser
