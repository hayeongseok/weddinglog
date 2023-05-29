/**
 * 사용자 인증 관련 Routes
 */

const router = require('express').Router()
const authorizeController = require('../Controllers/Authorize.Contoller')

router.post('/', authorizeController.signIn)
router.post('/token', authorizeController.tokenRefresh)
router.get('/callback', authorizeController.kakaoLogin)
router.post('/pincode', authorizeController.getPincode)

module.exports = router