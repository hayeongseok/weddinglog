/**
 * 문의 관련  Routes
 */

const router = require('express').Router()
const authorizeController = require('../Controllers/Authorize.Contoller')
const inquiryController = require('../Controllers/Inquiry.Controller')
const permissionController = require('../Controllers/Permission.Contoller')

// 문의 목록 가져오기
router.get('/', authorizeController.LoginCheck, permissionController.ChackUserPermission, inquiryController.GetInquiry)

// 문의 생성하기
router.post('/', inquiryController.PostInquiry)

// 문의 정보 가져오기
router.get('/:id', authorizeController.LoginCheck, permissionController.ChackUserPermission, inquiryController.GetInquiry)

// 문의 수정하기
router.post('/:id', authorizeController.LoginCheck, permissionController.ChackUserPermission, inquiryController.PostInquiry)

// 문의 삭제하기
router.delete('/:id', authorizeController.LoginCheck, permissionController.ChackUserPermission, inquiryController.DeleteInquiry)



module.exports = router