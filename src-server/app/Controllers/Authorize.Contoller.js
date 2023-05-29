const userModel = require('../Models/users.model');
const logModel = require('../Models/log.model');
const ipModel = require('../Models/ip.model');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { secretKey } = require('../config');
const db = require('../Core/Database.core');
const UserModel = require('../Models/users.model');
const request = require('request');
const useragent = require('express-useragent');

const createAccessToken = async (user) => {
  const config = require('../config');

  return await jwt.sign(
    {
      id: user.id,
      nickname: user.nickname,
      isAdmin: user.isAdmin === 'Y',
    },
    config.secretKey,
    {
      expiresIn: config.jwt.accessTokenExpire,
    }
  );
};

function doRequest(options) {
  return new Promise(function (resolve, reject) {
    if (options.form) {
      request.post(options, function (error, response, body) {
        if (!error) {
          resolve(body);
        } else {
          reject(error);
        }
      });
    } else {
      request.get(options, function (error, response, body) {
        if (!error && response.statusCode === 200) {
          resolve(body);
        } else {
          reject(error);
        }
      });
    }
  });
}

/**
 * RefreshToken을 발급한다.
 * @param user 사용자 정보 객체
 * @returns {Promise<*>}
 */
const createRefreshToken = async (user) => {
  const config = require('../config');
  return await jwt.sign({ id: user.id, nickname: user.nickname, isAdmin: user.isAdmin === 'Y' }, config.secretKey, {
    expiresIn: config.jwt.refreshTokenExpire,
  });
};

const ResponseToken = async (user) => {
  let newAccessToken = '',
    newRefreshToken = '';
  await createAccessToken(user).then((v) => (newAccessToken = v));
  await createRefreshToken(user).then((v) => (newRefreshToken = v));

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    userData: {
      id: user.id,
      nickname: user.nickname,
      isAdmin: user.isAdmin === 'Y',
      group: user.group
    },
    permission: user.permission,
  };
};

const inet_aton = async (ip) => {
  // split into octets
  var a = ip.split('.');
  var buffer = new ArrayBuffer(4);
  var dv = new DataView(buffer);
  for (var i = 0; i < 4; i++) {
    dv.setUint8(i, a[i]);
  }
  return dv.getUint32(0);
};

const generateRandomCode = (n) => {
  let str = '';
  for (let i = 0; i < n; i++) {
    str += Math.floor(Math.random() * 10);
  }
  return str;
};

module.exports = {
  /** 사용자 로그인 처리 **/
  async signIn(req, res) {
    const loginId = req.body.hasOwnProperty('loginId') ? req.body.loginId : '',
      loginPass = req.body.hasOwnProperty('loginPass') ? req.body.loginPass : '';

    if (loginId.length === 0) return res.status(400).json({ code: 'AUTH.ERR003', error: '[이메일주소]를 입력하세요.' });

    if (loginPass.length === 0) return res.status(400).json({ code: 'AUTH.ERR004', error: '[비밀번호]를 입력하세요.' });

    let user = await userModel.GetUser(loginId, 'loginId');

    if (user === false || user === null) {
      return res.status(400).json({
        status: 400,
        code: 'AUTH.ERR005',
        error: '가입되지 않은 [이메일주소]이거나 [비밀번호]가 올바르지 않습니다.',
      });
    }

    const secretKey = require('../config');
    const encryptedPassword = require('sha256')(require('md5')(secretKey + loginPass));

    if (user['loginPassword'] !== encryptedPassword)
      return res.status(400).json({
        status: 400,
        code: 'AUTH.ERR006',
        error: '가입되지 않은 [이메일주소]이거나 [비밀번호]가 올바르지 않습니다.',
      });

    // 회원상태가 정상이 아닌경우
    if (user['status'] !== 'Y')
      return res.status(400).json({
        status: 400,
        code: 'AUTH.ERR007',
        error: '가입되지 않은 [이메일주소]이거나 [비밀번호]가 올바르지 않습니다.',
      });

    // 권한 목록 조회
    let result = await UserModel.GetPermission(user.id);

    const permission = result;
    result = {};

    for (let i in permission) {
      result[permission[i].key] = permission[i].isAuth === 'Y';
    }

    user.permission = result;

    // 새로운 accessToken 과 refreshToken 을 발급한다.
    return await ResponseToken(user).then((json) => {
      return res.status(200).json(json);
    });
  },

  /** 사용자 JWT 토큰 리프레시 **/
  async tokenRefresh(req, res) {
    const config = require('../config');
    const refreshToken = req.body.hasOwnProperty('refreshToken') ? req.body.refreshToken : null;

    // 넘어온 refreshToken이 없다면
    if (!refreshToken)
      return res.status(401).json({
        code: 'AUTH.ERR002',
        error: '사용자 로그인 정보가 유효하지 않습니다',
      });

    // 리프레시 토큰의 유효성을 검증하고, 정상적일 경우 AccessToken 을 재발급 한다.
    await jwt.verify(refreshToken, config.secretKey, async (error, decoded) => {
      if (error) {
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            code: 'AUTH.ERR002',
            error: '사용자 로그인 정보가 유효하지 않습니다',
          });
        }
        return res.status(401).json({
          code: 'AUTH.ERR002',
          error: '사용자 로그인 정보가 유효하지 않습니다',
        });
      }

      let user = {};
      try {
        await userModel.GetUser(decoded.id, 'id').then((res) => {
          user = res;
        });
      } catch {
        user = null;
      }

      // 회원상태가 정상이 아닌경우
      if (user === {} || user === null || user.status !== 'Y')
        return res.status(400).json({
          code: 'AUTH.ERR007',
          error: '가입되지 않은 [이메일주소]이거나 [비밀번호]가 올바르지 않습니다.',
        });

      // 새로운 accessToken 과 refreshToken 을 발급한다.
      return await ResponseToken(user).then((json) => {
        return res.status(200).json(json);
      });
    });
  },

  async LoginCheck(req, res, next) {
    let accessToken = req.headers['Authorization'] || req.headers['authorization'];
    if (!accessToken) {
      return res.status(401).json({
        status: 401,
        code: 'AUTH0002',
        error: '사용자 로그인 정보가 유효하지 않습니다.',
      });
    }

    accessToken = accessToken.replace('Bearer ', '');

    await jwt.verify(accessToken, secretKey, (error, decoded) => {
      if (error) {
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            status: 401,
            code: 'AUTH0001',
            error: '사용자 로그인 정보가 만료되었습니다.',
          });
        }
        return res.status(401).json({
          status: 401,
          code: 'AUTH0002',
          error: '사용자 로그인 정보가 유효하지 않습니다.',
        });
      }

      req.loginUserID = decoded.id;
      return next();
    });
  },

  async nonLoginCheck(req, res, next) {
    let accessToken = req.headers['Authorization'] || req.headers['authorization'];
    req.loginUserID = 0;

    if (!accessToken) {
      return next();
    }
    accessToken = accessToken.replace('Bearer ', '');

    await jwt.verify(accessToken, secretKey, (error, decoded) => {
      if (error) {
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            status: 401,
            code: 'AUTH0001',
            error: '사용자 로그인 정보가 만료되었습니다.',
          });
        }
        return res.status(401).json({
          status: 401,
          code: 'AUTH0002',
          error: '사용자 로그인 정보가 유효하지 않습니다.',
        });
      }

      req.loginUserID = decoded.id;
      return next();
    });
  },

  // 카카오 로그인
  async kakaoLogin(req, res, next) {
    const code = req.query.code;
    const client_id = '04952820fce97af932ecbbc49dcab5d4';
    const redirect_uri = 'https://weddinglog.co.kr/social';
    
    let authOptions = {
      url: 'https://kauth.kakao.com/oauth/token',
      form: {
        client_id: client_id,
        code: code,
        redirect_uri: encodeURI(redirect_uri),
        grant_type: 'authorization_code',
      },
      json: true,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    };

    const authResult = await doRequest(authOptions);

    let infoOptions = {
      url: 'https://kapi.kakao.com/v2/user/me',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${authResult.access_token}`,
      },
    };

    const infoResult = await doRequest(infoOptions);
    const infoResultJson = JSON.parse(infoResult);

    // 회원 진위여부 확인
    let sql = `SELECT socialId FROM users_social WHERE socialId = ?`;

    let result = (await db.raw(sql, [infoResultJson.id]))[0];

    if (result.length !== 0) {
      console.log('로그인 성공');
      // 로그인
      let joinSQL = `SELECT u.loginId, u.id as userId FROM users_social AS us
                        LEFT JOIN users AS u ON u.id = us.userId
                        WHERE us.socialId = '${infoResultJson.id}'`;

      let joinResult = (await db.raw(joinSQL))[0][0];

      let user = await userModel.GetUser(joinResult.loginId, 'loginId');

      // 권한 목록 조회
      let result = await UserModel.GetPermission(joinResult.userId);

      const permission = result;
      result = {};

      for (let i in permission) {
        result[permission[i].key] = permission[i].isAuth === 'Y';
      }

      user.permission = result;

      // 로그인 로그 테이블에 로그인 정보 저장
      const ua = useragent.parse(req.headers['user-agent']);
      const loginIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      const browser = ua.browser;
      const version = ua.version;
      const os = ua.os;
      const mobile = ua.isMobile;
      const ip = await ipModel.ip2long(loginIp);

      try {
        await db.raw(`INSERT INTO \`logs_login\` (log_type, user_id, ip, browser, version, os, mobile) VALUES (?,?,?,?,?,?,?)`, ['사용자/로그인', joinResult.userId, ip, browser, version, os, mobile]);
      } catch (e) {
        return res.status(500).json('데이터베이스 오류가 발생하였습니다');
      }

      return await ResponseToken(user).then((json) => {
        return res.status(200).json(json);
      });

      // 회원가입 진행
    } else {
      return res.status(200).json(infoResultJson);
    }
  },

  /**
   * 인증번호를 가져오는 컨트롤러
   * 필수 패러미터
   * phone 핸드폰번호
   */
  async getPincode(req, res) {
    const phone = req.body.hasOwnProperty('phone') ? req.body.phone : null;

    if (!phone) {
      return res.status(400).json({ error: '인증번호를 전송할 휴대폰번호가 입력되지 않았습니다.' });
    }

    const ncloudLibrary = require('../Libraries/ncloud.library');
    const pinCode = generateRandomCode(6);

    const params = {
      phone: phone,
      content: `본인확인을 위한 인증번호 [${pinCode}]를 화면에 입력해주세요`,
      code: 'PINCODE',
    };

    await ncloudLibrary.sendAlimtalk(params);

    return res.status(200).json({ pincode: pinCode });
  },
};
