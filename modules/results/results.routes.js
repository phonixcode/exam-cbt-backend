const router            = require('express').Router()
const resultsController = require('./results.controller')
const { protect }       = require('../../middleware/auth.middleware')
const { isAdmin }       = require('../../middleware/admin.middleware')

// ─── Student routes ───────────────────────────────────────
router.get('/dashboard',         protect,          resultsController.getDashboardStats)
router.get('/weak-areas',        protect,          resultsController.getWeakAreas)
router.get('/analytics',         protect,          resultsController.getAnalytics)
router.get('/admin/all',         protect, isAdmin, resultsController.getAllResults)
router.get('/',                  protect,          resultsController.getUserResults)
router.get('/:sessionId',        protect,          resultsController.getSessionResult)

module.exports = router