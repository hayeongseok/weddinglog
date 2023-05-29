/**
 * 맞춤 추천 관련  Routes
 */

const router = require('express').Router()
const authorizeController = require('../Controllers/Authorize.Contoller')
const customizedController = require('../Controllers/customized.Controller')
const permissionController = require('../Controllers/Permission.Contoller')

// 맞춤 추천 목록 가져오기
router.get('/', authorizeController.LoginCheck, permissionController.ChackUserPermission, customizedController.GetCustomized)

// 맞춤 추천 생성하기
router.post('/', authorizeController.LoginCheck, permissionController.ChackUserPermission, customizedController.PostCustomized)

// 맞춤 추천 정보 가져오기
router.get('/:id', authorizeController.LoginCheck, permissionController.ChackUserPermission, customizedController.GetCustomized)

// 맞춤 추천 수정하기
router.post('/:id', authorizeController.LoginCheck, permissionController.ChackUserPermission, customizedController.PostCustomized)

// 맞춤 추천 삭제하기
router.delete('/:id', authorizeController.LoginCheck, permissionController.ChackUserPermission, customizedController.DeleteCustomized)



module.exports = router