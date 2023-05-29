/**
 * pass, 문자 인증 api
 */

const router = require('express').Router();
const identificationController = require('../Controllers/Identification.Contoller');

// poss, 문자 인증
router.post('/', identificationController.signUpIdentification);
router.get('/verification', identificationController.signUpVerification);

module.exports = router;
