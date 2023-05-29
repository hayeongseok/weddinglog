/**
 * 드레스 문의 신청 api
 */

const router = require('express').Router()
const authorizeController = require('../Controllers/Authorize.Contoller')
const dressInquiryController = require('../Controllers/DressInquiry.Contoller')

// 드레스 문의 신청
router.post('/', authorizeController.LoginCheck, dressInquiryController.applicationForm)

module.exports = routera