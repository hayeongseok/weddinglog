/**
 * 상담 신청 목록 Routes
 */

const router = require('express').Router();
const authorizeController = require('../Controllers/Authorize.Contoller');
const qnaController = require('../Controllers/Qna.Contoller');

// 상담 신청 리스트
router.get('/dress', authorizeController.LoginCheck, qnaController.GetQnaDress);

module.exports = router;
