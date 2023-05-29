const db = require('../Core/Database.core');

module.exports = {
  // 아이디 이중 체크
  async GetId(req, res) {
    const loginId = req.query.hasOwnProperty('loginId') ? req.query.loginId : null;
    let id

    try {  
      // 쿼리 실행
      id = (await db.raw('SELECT loginId FROM users WHERE loginId = ?', [loginId]))[0];
    } catch (e) {
      return res.status(400).json({ error: '데이터베이스 오류가 발생하였습니다.' });
    }

    if (id == '') {
      return res.status(200).json({ result: '사용 가능한 아이디 입니다.' });
    } else {
      return res.status(400).json({ error: '이미 존재하는 아이디 입니다.' });
    }
  },

  // 아이디 확인
  async GetIdCheck(req, res) {
    const companyName = req.query.hasOwnProperty('companyName') ? req.query.companyName : null;
    let id

    try {
      // 쿼리 실행
      id = (await db.raw(`SELECT id, companyName FROM company WHERE companyName = ?`, [companyName]))[0][0];
    } catch (e) {
      return res.status(400).json({ error: '데이터베이스 오류가 발생하였습니다.' });
    }

    if (id == undefined) {
      return res.status(200).json({ result: '사용 가능한 아이디 입니다.' });
    } else {
      return res.status(400).json({ error: '이미 존재하는 아이디 입니다.' });
    }
  },
};
