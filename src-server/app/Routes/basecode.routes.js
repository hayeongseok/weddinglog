/**
 * 사용자 인증 관련 Routes
 */

const router = require('express').Router()
const authorizeController = require('../Controllers/Authorize.Contoller')
const systemController = require('../Controllers/System.Controller')
const permissionController = require('../Controllers/Permission.Contoller')

router.get('/:type', systemController.GetBaseCode)
router.get('/:type/:id', systemController.GetBaseCode)
router.get('/', authorizeController.LoginCheck, permissionController.ChackUserPermission, systemController.GetProductBaseCode)

router.post('/:type', authorizeController.LoginCheck, permissionController.ChackUserPermission, systemController.PostBaseCode)
router.post('/:type/:id', authorizeController.LoginCheck, permissionController.ChackUserPermission, systemController.PostBaseCode)
router.delete('/:type/:id', authorizeController.LoginCheck, permissionController.ChackUserPermission, systemController.DeleteBaseCode)


module.exports = router