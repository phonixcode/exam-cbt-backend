const router          = require('express').Router()
const adminController = require('./admin.controller')
const { protect }     = require('../../middleware/auth.middleware')
const { isAdmin }     = require('../../middleware/admin.middleware')
const { uploadDocx }  = require('../../config/upload')

router.use(protect, isAdmin)

router.get('/stats',                        adminController.getPlatformStats)
router.get('/users',                        adminController.listUsers)
router.delete('/users/:userId',             adminController.deleteUser)

router.post('/import/preview',  uploadDocx.single('file'),  adminController.previewDocx)
router.post('/import/confirm',                              adminController.confirmImport)

module.exports = router