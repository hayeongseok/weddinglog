/**
 * 통계 Routes
 */

const router = require('express').Router();
const statisticsController = require('../Controllers/Statistics.Contoller');

// 가입자, 방문자, 문의 수 확인
router.get('/', statisticsController.getStatistics);
router.post('/', statisticsController.postStatistics);

module.exports = router;
