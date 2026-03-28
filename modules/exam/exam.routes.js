const router         = require('express').Router()
const examController = require('./exam.controller')
const { protect }    = require('../../middleware/auth.middleware')

router.post('/',                          protect, examController.startExam)
router.get('/ongoing',                    protect, examController.getOngoingSession)
router.get('/:sessionId',                 protect, examController.getSession)
router.patch('/:sessionId/answer',        protect, examController.saveAnswer)
router.patch('/:sessionId/submit',        protect, examController.submitExam)
router.patch('/:sessionId/abandon',       protect, examController.abandonExam)

module.exports = router