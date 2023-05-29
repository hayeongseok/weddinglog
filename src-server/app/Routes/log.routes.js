/**
 * 로그 관련 Routes
 */

const router = require('express').Router()
const authorizeController = require('../Controllers/Authorize.Contoller')
const logController = require('../Controllers/Log.Contoller')
const permissionController = require('../Controllers/Permission.Contoller')

// 회원 로그 조회
router.get('/', authorizeController.LoginCheck, permissionController.ChackUserPermission, logController.getLog)

module.exports = router