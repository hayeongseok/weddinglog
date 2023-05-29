/**
 * 사용자 관련 API
 */

const router = require('express').Router()
const UserController = require('../Controllers/Users.Controller')
const authorizeController = require('../Controllers/Authorize.Contoller')
const permissionController = require('../Controllers/Permission.Contoller')
const permission = require("../Controllers/Permission.Contoller");

router.get('/id-check', UserController.checkId)

router.get('/find-id', UserController.findId)
router.get('/find-pass', UserController.findPass)
router.post('/find-change-pass', UserController.findPassChange)

// 사용자 권한 가져오기
router.get('/permission', authorizeController.LoginCheck, permission.GetUserPermission)

// 사용자 권한 설정
router.post('/permission', authorizeController.LoginCheck, permission.ChackUserPermission, permission.PostUserPermission)

// 사용자 권한 삭제
router.delete('/permission', authorizeController.LoginCheck, permission.ChackUserPermission, permission.DeleteUserPermission)


// 사용자 회원 목록
router.get('/', authorizeController.LoginCheck, permissionController.ChackUserPermission, UserController.GetUsers)

// 사용자 회원 정보
router.get('/:id', authorizeController.LoginCheck, permissionController.ChackUserPermission, UserController.GetUsers)

// 신규 회원가입
router.post('/', UserController.signUp)



// 사용자 정보 수정
router.post('/:id', authorizeController.LoginCheck, permissionController.ChackUserPermission, UserController.postUsers)

// 사용자 비밀번호 변경
router.post('/:id/password', authorizeController.LoginCheck, permissionController.ChackUserPermission, UserController.postPasswordChange)

// 사용자 상태 변경
router.post('/:id/status', authorizeController.LoginCheck, permissionController.ChackUserPermission, UserController.postStatusChange)

// 사용자 관리자 변경
router.post('/:id/admin', authorizeController.LoginCheck, permissionController.ChackUserPermission, UserController.postAdminChange)

// 사용자 포인트 목록
router.get('/:id/points', authorizeController.LoginCheck, permissionController.ChackUserPermission, UserController.getUserPoint)

// 사용자 포인트 추가
router.post('/:id/points', authorizeController.LoginCheck, permissionController.ChackUserPermission, UserController.postUserPoint)

// 사용자 포인트 차감
router.delete('/:id/points', authorizeController.LoginCheck, permissionController.ChackUserPermission, UserController.deleteUserPoint)

// 사용자 쿠폰 목록
router.get('/:userId/coupon', authorizeController.LoginCheck, permissionController.ChackUserPermission, UserController.getUserCoupon)
// 사용자 쿠폰 추가 
router.post('/:userId/coupon', authorizeController.LoginCheck, permissionController.ChackUserPermission, UserController.postUserCoupon)
// 사용자 쿠폰 삭제
router.delete('/:id/coupon', authorizeController.LoginCheck, permissionController.ChackUserPermission, UserController.deleteUserCoupon)


module.exports = router