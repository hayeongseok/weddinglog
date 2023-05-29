/**
 * checklist Routes
 */

 const router = require('express').Router()
 const authorizeController = require('../Controllers/Authorize.Contoller')
 const checklistController = require('../Controllers/Checklist.Contoller')
 const permissionController = require('../Controllers/Permission.Contoller')
 
 
 // checklist 목록 가져오기
 router.get('/', authorizeController.nonLoginCheck, checklistController.GetChecklist)
 
 // checklist 정보 가져오기 (1 item)
 router.get('/:id', authorizeController.LoginCheck, permissionController.ChackUserPermission, checklistController.GetChecklist)
 
 // checklist 등록
 router.post('/', authorizeController.LoginCheck, permissionController.ChackUserPermission, checklistController.PostChecklist)
 
 // checklist 정보 수정하기
 router.post('/:id', authorizeController.LoginCheck, permissionController.ChackUserPermission, checklistController.PostChecklist)
 
 // checklist 정보 삭제하기
 router.delete('/:id', authorizeController.LoginCheck, permissionController.ChackUserPermission, checklistController.DeleteChecklist)
 
 
 module.exports = router;