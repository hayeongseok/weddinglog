const db = require('../Core/Database.core');
const userModel = require('../Models/users.model');
const useragent = require('express-useragent');
const logModel = require('../Models/log.model');

/**
 * 로그 API 사용 권한을 확인한다.
 */
const CheckLogAuthorize = async (req) => {
  let returnAuth = {
    GET: false,
    INSERT: false,
    UPDATE: false,
    DELETE: false,
    POSTS: false,
  };

  // 1. 로그인 여부 확인
  if (typeof req.loginUserID === 'undefined' || !req.loginUserID || req.loginUserID <= 0) {
    return returnAuth;
  }

  // @todo: 2.로그인한 사용자가 슈퍼관리자이거나 사용자 관리 권한이 있는지 확인한다.
  // @todo: /v1/users/permission 에서 사용한 컨트롤러/모델을 이용
  const permission = await userModel.GetPermission(req.loginUserID);

  let returnAuthorize = {};
  for (let i in permission) {
    returnAuthorize[permission[i].key] = permission[i].isAuth === 'Y';
  }

  const isMaster = returnAuthorize.hasOwnProperty('MASTER') && returnAuthorize['MASTER'] === true;

  returnAuth.GET = isMaster;
  returnAuth.INSERT = isMaster;
  returnAuth.UPDATE = isMaster;
  returnAuth.DELETE = isMaster;

  // @todo: 3. 해당게시판 관리자 여부를 체크, 게시판 관리자는 게시글/댓글의 수정/삭제만 처리할수 있는 권한이다.
  return returnAuth;
};

module.exports = {
  // logs 조회하기
  async getLog(req, res) {
    const query = req.query.hasOwnProperty('query') ? req.query.query.trim() : '';
    const pageRows = req.query.hasOwnProperty('pageRows') ? req.query.pageRows.trim() * 1 : 10; // 한 페이지에 출력될 항목 갯수
    const page = req.query.hasOwnProperty('page') ? (req.query.page.trim() - 1) * pageRows : 0;
    const login = req.query.hasOwnProperty('login') ? req.query.login.trim() : 'true'; // true면 로그인 로그 기록 표시
    
    // 쿼리문을 작성한다.
    let dbQuery = '';
    let bindingList = []; // 바인딩할 배열
    
    dbQuery += `SELECT logs.id, log_type, user_id, \`group\`, loginId, nickname, ip `
    // 로그인 로그 조회
    if (login == 'true') {
      dbQuery += `, browser, \`version\`, os, mobile, reg_time FROM logs_visitors AS \`logs\` LEFT JOIN users ON user_id = users.id `
      dbQuery += `WHERE browser LIKE '%${query}%' OR \`version\` LIKE '%${query}%' OR os LIKE '%${query}%' OR mobile LIKE '%${query}%' OR `
      // 사용 로그 조회
    } else if (login === 'false') {
      dbQuery += `FROM \`logs\` LEFT JOIN users ON user_id = users.id WHERE `
    }

    dbQuery += `log_type LIKE '%${query}%' OR user_id LIKE '%${query}%' OR \`group\` LIKE '%${query}%' OR loginId LIKE '%${query}%' OR nickname LIKE '%${query}%' OR ip LIKE '%${query}%'`
    dbQuery += `ORDER BY id DESC LIMIT ?, ?`
    bindingList.push(page, pageRows)

    try {
      // 쿼리 실행
      const log = (await db.raw(dbQuery, bindingList))[0]
      return res.status(200).json({ log });
    } catch (e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다');
    }
  },

  // logs 생성하기는 모듈에 넣어두기
  async postLog(req, res) {
    const ua = useragent.parse(req.headers['user-agent']);

    const log_type = req.post.hasOwnProperty('logType') ? req.post.logType.trim() : '';
    const user_id = req.loginUserID;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const ip_description = req.post.hasOwnProperty('ipDescription') ? req.post.ipDescription : '';
    const browser = ua.browser;
    const version = ua.version;
    const os = ua.os;
    const mobile = ua.isMobile;

    // 로그인 로그
    if (!ip_description) {
      try {
        // 쿼리 실행
        await db.raw(`INSERT INTO \`logs_login\` (log_type, user_id, ip, browser, version, os, mobile) VALUES (?,?,?,?,?,?,?)`, [log_type, user_id, ip2long(ip), browser, version, os, mobile]);
      } catch (e) {
        return res.status(500).json('데이터베이스 오류가 발생하였습니다');
      }

      // 사용 로그
    } else {
      try {
        // 쿼리 실행
        await db.raw(`INSERT INTO \`logs\` (log_type, user_id, ip, ip_description) VALUES (?,?,?,?)`, ['사용자/로그인', user_id, ip2long(ip), 'User Uid : ' + user_id]);
      } catch (e) {
        return res.status(500).json('데이터베이스 오류가 발생하였습니다');
      }
    }
  },
};
