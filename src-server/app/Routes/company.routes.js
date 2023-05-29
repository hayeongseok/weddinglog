/**
 * 업체 등록 Routes
 */

const router = require('express').Router()
const authorizeController = require('../Controllers/Authorize.Contoller')
const companyController = require('../Controllers/Company.Contoller')
const permissionController = require('../Controllers/Permission.Contoller')


// 업체 목록 가져오기
router.get('/', authorizeController.LoginCheck, permissionController.ChackUserPermission, companyController.GetCompany)

// 업체 정보 가져오기 (1 item)
router.get('/:id', authorizeController.LoginCheck, permissionController.ChackUserPermission, companyController.GetCompany)

// 업체 등록
router.post('/', authorizeController.LoginCheck, permissionController.ChackUserPermission, companyController.PostCompany)

// 업체 정보 수정하기
router.post('/:id', authorizeController.LoginCheck, permissionController.ChackUserPermission, companyController.PostCompany)

// 업체 정보 삭제하기
router.delete('/:id', authorizeController.LoginCheck, permissionController.ChackUserPermission, companyController.DeleteCompany)


module.exports = router;