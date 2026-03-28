const router         = require('express').Router()
const userController = require('./user.controller')
const { protect }    = require('../../middleware/auth.middleware')
const { isAdmin }    = require('../../middleware/admin.middleware')

router.get('/profile',          protect,          userController.getProfile)
router.put('/subjects',         protect,          userController.updateSubjects)
router.get('/',        protect, isAdmin,          userController.listUsers)

module.exports = router