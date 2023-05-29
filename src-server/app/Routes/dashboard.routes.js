/**
 * 대시보드 관련  Routes
 */

const router = require('express').Router()
const authorizeController = require('../Controllers/Authorize.Contoller')
const dashboardController = require('../Controllers/Dashboard.Controller')
const permissionController = require('../Controllers/Permission.Contoller')

// 대시보드 목록 가져오기
// router.get('/', authorizeController.LoginCheck, permissionController.ChackUserPermission, dashboardController.GetDashboard)

// 대시보드 비로그인 및 찜 비활성화 시 찜 리스트
router.get('/wishList', dashboardController.GetDashboardWishList)

// 대시보드 생성하기
router.post('/', authorizeController.LoginCheck, permissionController.ChackUserPermission, dashboardController.PostDashboard)

// 대시보드 type 목록 가져오기
router.get('/:typeId', dashboardController.GetDashboard)

// 대시보드 수정하기
router.post('/:id', authorizeController.LoginCheck, permissionController.ChackUserPermission, dashboardController.PostDashboard)

// 대시보드 삭제하기
router.delete('/:dashboardId', authorizeController.LoginCheck, permissionController.ChackUserPermission, dashboardController.DeleteDashboard)

module.exports = router