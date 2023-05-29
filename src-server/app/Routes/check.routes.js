/**
 * 아이디 이중 체크 Routes
 */

const router = require('express').Router()
const idCheckContoller = require('../Controllers/Check.Contoller')

// 아이디 이중 체크 Routes
router.get('/id', idCheckContoller.GetId)

// 아이디 확인 Routes
router.get('/company', idCheckContoller.GetIdCheck)


module.exports = router;