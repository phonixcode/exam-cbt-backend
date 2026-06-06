const router             = require('express').Router()
const questionController = require('./question.controller')
const { protect }        = require('../../middleware/auth.middleware')
const { isAdmin }        = require('../../middleware/admin.middleware')

router.get('/filters',                                questionController.getSubjects)
router.get('/stats',                protect, isAdmin, questionController.getQuestionStats)
router.get('/passages',             protect,          questionController.listPassages)
router.get('/passages/:id',         protect,          questionController.getPassage)

router.get('/',                     protect,          questionController.listQuestions)
router.post('/',                    protect, isAdmin, questionController.createQuestion)
router.post('/bulk',                protect, isAdmin, questionController.bulkCreateQuestions)
router.post('/passages',            protect, isAdmin, questionController.createPassage)

router.get('/:id',                  protect,          questionController.getQuestion)
router.put('/:id',                  protect, isAdmin, questionController.updateQuestion)
router.patch('/:id/deactivate',     protect, isAdmin, questionController.deactivateQuestion)
router.delete('/:id',               protect, isAdmin, questionController.deleteQuestion)

module.exports = router