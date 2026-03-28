const router         = require('express').Router()
const authController = require('./auth.controller')
const { protect }    = require('../../middleware/auth.middleware')

router.post('/register',       authController.register)
router.post('/login',          authController.login)
router.post('/register-admin', authController.registerAdmin)
router.get('/me',   protect,   authController.getMe)

module.exports = router