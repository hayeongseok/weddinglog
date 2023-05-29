// 라우터 객체 생성
const router = require('express').Router();

// 사용자 로그인, jwt 토큰 관련 (권한 확인 없이 진행)
router.use('/v1/authorize', require('./authorize.routes'));

// 사용자 관련
router.use('/v1/users', require('./users.routes'));

// 사용자 체크 (권한 확인 없이 진행)
router.use('/v1/check', require('./check.routes'));

// System 메뉴 관련 Routes
router.use('/v1/basecode', require('./basecode.routes'));

// log
router.use('/v1/log', require('./log.routes'));

// 업체 등록
router.use('/v1/company', require('./company.routes'));

// 상품 관련
router.use('/v1/products', require('./products.routes'));

// 게시판 관련 라우팅
router.use('/v1/board', require('./board.routes'));

// 맞춤 추천 관련
router.use('/v1/customized', require('./customized.routes'));

// 문의 관련
router.use('/v1/inquiry', require('./inquiry.routes'));

// Dashboard img 설정 관련
router.use('/v1/dashboard', require('./dashboard.routes'));

// checklist 관련
router.use('/v1/checklist', require('./checklist.routes'));

// pass, 문자 인증 관련
router.use('/v1/identification', require('./identification.router'));

// 통계 관련
router.use('/v1/statistics', require('./statistics.router'));

const SystemController = require('../Controllers/System.Controller');

router.post('/v1/system/change-sort', SystemController.ChangeSort);

// 객체 Export1
module.exports = router;
