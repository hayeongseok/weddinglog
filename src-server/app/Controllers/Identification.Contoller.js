const crypto = require('crypto');
const identificationModel = require('../Models/identification.model');

module.exports = {
  // 사용 로그
  async signUpIdentification(req, res) {
    const result = await identificationModel.identification();
    return res.status(200).json(result);
  },

  async signUpVerification(req, res) {
    // 인증 결과 확인
    try {
      const decipher = crypto.createDecipheriv('AES-128-CBC', Buffer.from(req.query.key),  req.query.iv);
      const decrypted = decipher.update(req.query.enc_data, 'base64');
      const resData = JSON.parse(Buffer.concat([decrypted, decipher.final()]).toString());

      if (resData.resultcode !== '0000') {
        return res.status(400).json('인증 실패');
      } else {
        return res.status(200).json({ mobileno: resData.mobileno });
      }
    } catch (e) {
      return res.status(400).json('인증 실패');
    }
  },
};
