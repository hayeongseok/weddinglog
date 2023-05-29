const db = require('../Core/Database.core');
const ipModel = require('../Models/ip.model');

module.exports = {
  async getStatistics(req, res) {
    const status = req.query.hasOwnProperty('type') ? req.query.type.trim() : '';
    
    
    try {
      // 쿼리 실행
      let log = (await db.raw(`
        SELECT a.visitor_length, b.sign_up_length, c.inquiry_length
        FROM (SELECT COUNT(*) AS visitor_length FROM logs_visitors WHERE DATE_FORMAT(reg_time, "%Y-%m-%d") = CURDATE()) a,
          (SELECT COUNT(*) AS sign_up_length FROM users WHERE DATE_FORMAT(regDt, "%Y-%m-%d") = CURDATE()) b,
          (SELECT COUNT(*) AS inquiry_length FROM inquiry WHERE DATE_FORMAT(regDt, "%Y-%m-%d") = CURDATE())c`))[0]
      let totalUser = (await db.raw(`SELECT COUNT(*) AS count FROM users`))[0]
      return res.status(200).json({ log, totalUser });
    } catch(e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다');
    }
  },

  async postStatistics(req, res) {
    // 오늘 접속자는 쿠키가 이미 생성되어 있으므로, 이미 생성된 쿠키가 있으면 모든 과정을 스킵한다.
    let cookie = req.cookies.visit ? req.cookies.visit : null;

    if(cookie !== null) return res.status(200).json({})

    // UserAgent 분석
    const useragent = require('express-useragent');
  
    // 로그인 로그 테이블에 로그인 정보 저장
    const userId = req.body.hasOwnProperty('userId') ? req.body.userId : 0;
    const ua = useragent.parse(req.headers['user-agent']);
    const loginIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const browser = ua.browser;
    const version = ua.version;
    const os = ua.os;
    const mobile = ua.isMobile;
    const ip = await ipModel.ip2long(loginIp);
    const referrer = req.headers.hasOwnProperty('referrer') ? req.headers.referrer.trim() : '';
 
    // 봇이 요청한 경우에는 처리하지 않는다.
    if(ua.isBot === true || os === 'unknown' || os === 'Linux') return res.status(200).json({});

    try {
      await db.raw(`INSERT INTO logs_visitors (log_type, user_id, ip, browser, version, os, mobile, referer) VALUES (?,?,?,?,?,?,?,?)`, ['사용자/방문자 접속', userId, ip, browser, version, os, mobile, referrer]);
    } catch (e) {
      console.log(e)
      return res.status(500).json('데이터베이스 오류가 발생하였습니다');
    }

    // 방문 쿠키 생성
    let expire = new Date();
    expire.setHours(23,59,59,0);
    res.cookie('visit', 1, {
        expires: expire
    })

    return res.status(200).json({});
  }
};
