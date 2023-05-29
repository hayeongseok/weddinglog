const userModel = require('../Models/users.model');
const db = require('../Core/Database.core');
const Enums = require('../Helpers/Enums');
const AWS = require('aws-sdk');
const config = require('../config');
const endpoint = new AWS.Endpoint('https://kr.object.ncloudstorage.com');
const region = 'kr-standard';
const md5 = require('md5');
//const fetch = require("node-fetch");

// n cloud 연결
const S3 = new AWS.S3({
  endpoint,
  region,
  credentials: {
    accessKeyId: config.s3.access_key,
    secretAccessKey: config.s3.secret_key,
  },
});

const time = Math.floor(new Date().getTime() / 1000);

const secretKey = require('../config');

/**
 * 사용자 관련 API 사용 권한을 확인한다.
 */
const CheckUsersAuthorize = async (req) => {
  let returnAuth = {
    GET: false,
    INSERT: false,
    UPDATE: false,
    DELETE: false,
    POSTS: false,
  };

  // 1. 로그인 여부 확인
  if (
    typeof req.loginUserID === 'undefined' ||
    !req.loginUserID ||
    req.loginUserID <= 0
  ) {
    return returnAuth;
  }

  // @todo: 2.로그인한 사용자가 슈퍼관리자이거나 사용자 관리 권한이 있는지 확인한다.
  // @todo: /v1/users/permission 에서 사용한 컨트롤러/모델을 이용
  const permission = await userModel.GetPermission(req.loginUserID);

  let returnAuthorize = {};
  for (let i in permission) {
    returnAuthorize[permission[i].key] = permission[i].isAuth === 'Y';
  }

  // console.log(returnAuthorize.)

  const isMaster =
    returnAuthorize.hasOwnProperty('MASTER') &&
    returnAuthorize['MASTER'] === true;

  returnAuth.GET = isMaster;
  returnAuth.INSERT = isMaster;
  returnAuth.UPDATE = isMaster;
  returnAuth.DELETE = isMaster;

  // @todo: 3. 해당게시판 관리자 여부를 체크, 게시판 관리자는 게시글/댓글의 수정/삭제만 처리할수 있는 권한이다.
  return returnAuth;
};

module.exports = {
  /** 사용자 회원가입 처리 **/
  async signUp(req, res) {
    // 넘어온 변수를 받는다
    // 넘어온 변수를 받는다.
    const nickname = req.body.hasOwnProperty('name') ? req.body.name.trim() : '',
      phone = req.body.hasOwnProperty('phone') ? req.body.phone.trim() : '',
      note = req.body.hasOwnProperty('note') ? req.body.note.trim() : '',
      receiveSms = req.body.hasOwnProperty('receiveSms') ? req.body.receiveSms.trim() : 'N',
      receiveEmail = req.body.hasOwnProperty('receiveEmail') ? req.body.receiveEmail.trim() : 'N',
      gender = req.body.hasOwnProperty('gender') ? req.body.gender.trim() : '',
      socialType = req.body.hasOwnProperty('socialType') ? req.body.socialType.trim() : '',
      socialId = req.body.hasOwnProperty('socialId') ? req.body.socialId : '';

    let loginId = req.body.hasOwnProperty('loginId') ? req.body.loginId.trim() : '';
    let loginPass = req.body.hasOwnProperty('loginPass') ? req.body.loginPass.trim() : '';
    let dDay = req.body.hasOwnProperty('dDay') ? req.body.dDay.trim() : null;
    let userId = '';

    if (dDay !== null) {
      const tempDday = new Date(dDay);
      dDay = tempDday.dateFormat('yyyy-MM-dd');
    }

    if (dDay === '' || dDay.trim() === '' || dDay.length === 0) {
      dDay = null;
    }

    // 소셜 회원가입 시 아이디 비밀번호 수정
    if (socialType !== '') {
      loginId = md5(new Date(dDay)) + '@social.com';
      loginPass = '';
    }

    try {
      if (loginId.length === 0) {
        throw new Error('[이메일주소]를 입력하셔야 합니다.');
      }

      if (!/^[a-z0-9_+.-]+@([a-z0-9-]+\.)+[a-z0-9]{2,4}$/.test(loginId)) {
        throw new Error('올바른 형식의 [이메일주소]를 입력하셔야 합니다.');
      }

      let _tempCheck2 = null;
      await userModel
        .GetUser(loginId, 'loginId')
        .then((res) => {
          _tempCheck2 = res;
        })
        .catch(() => {
          _tempCheck2 = null;
        });

      if (
        _tempCheck2 !== null &&
        _tempCheck2.hasOwnProperty('loginId') !== false
      ) {
        throw new Error('이미 존재하는 아이디 입니다.');
      }

      if (!socialType && loginPass.length === 0) {
        throw new Error('[비밀번호]를 입력하셔야 합니다.');
      }

      if (!socialType && !/^.*(?=^.{8,20}$)(?=.*\d)(?=.*[a-zA-Z])(?=.*[!@#$%^&+=]).*$/.test(loginPass)) {
        throw new Error(
          '[비밀번호]는 8~20자리의 영문,숫자,특수문자를 포함하여야 합니다.'
        );
      }
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    // 파일 업로드
    let userImg;
    if (req.files !== undefined) {
      let bucket_name = config.s3.uploadBucketName + 'users';
      let files = req.files.file;

      // upload file
      let set = await S3.putObject({
        Bucket: bucket_name,
        Key: md5(files.name + time), // 업로드 name
        // ACL을 지우면 전체 공개되지 않습니다.
        ACL: 'public-read',
        Body: files.data,
      }).promise();

      // 이미지 url
      userImg = 'https://kr.object.ncloudstorage.com/' + bucket_name + '/' + md5(files.name + time);
    } else {
      // 이미지 url
      userImg = '';
    }

    try {
      const encryptedPassword = require('sha256')(
        require('md5')(secretKey + loginPass)
      );

      // 실제 사용자 추가 처리
      await userModel
        .AddUser({
          loginId: loginId,
          loginPassword: encryptedPassword,
          nickname: nickname,
          status: 'Y',
          group: '일반',
          phone: phone,
          dDay: dDay,
          note: note,
          receiveSms: receiveSms,
          receiveEmail: receiveEmail,
          gender: gender,
        })
        .then((res) => {
          if (!res.status) {
            throw new Error(res.error);
          } else {
            userId = res.id;
          }
        });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }

    // 카카오 소셜 회원가입 시 user_social 테이블 추가 insert 진행
    if (socialType === 'kakao') {
      console.log(socialType, 'if');
      await db.raw(`INSERT INTO users_social (userId, socialType, socialId) VALUES ('${userId}', '${socialType}', '${socialId}')` );
    }

    // 일반 사용자 권한 설정
    try {
      let userId = (await db.raw('SELECT id FROM users ORDER BY id DESC LIMIT 1'))[0][0].id;
      await db.raw(`INSERT INTO users_authorize VALUES 
      (${userId}, "INQUIRY/MODIFY"), (${userId}, "PRODUCTS/LIST_ALL"), (${userId}, "INQUIRY/LIST"), (${userId}, "INQUIRY/REMOVE"), 
      (${userId}, "COMPANY/LIST_ALL"), (${userId}, "USERS/LIST"), (${userId}, "BASECODE/LIST_ALL"), (${userId}, "LIKE/MODIFY"), 
      (${userId}, "LIKE/LIST"), (${userId}, "WISH/MODIFY"), (${userId}, "WISH/LIST"), (${userId}, "DASHBOARD/LIST_ALL"), (${userId}, "CHECKLIST/LIST"), 
      (${userId}, "COMMENT/LIST"), (${userId}, "COMMENT/LIST_ALL"), (${userId}, "COMMENT/MODIFY"), (${userId}, "COMMENT/REMOVE"), (${userId}, "PRODUCTS/LIST")`);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }

    return res.status(200).json({});
  },

  // 사용자 회원 목록 및 정보 확인 API
  async GetUsers(req, res) {
    try {
      const { group, status } = req.query,
        query = req.query.hasOwnProperty('query') ? req.query.query.trim() : '',
        pageRows = req.query.hasOwnProperty('pageRows') ? req.query.pageRows.trim() * 1 : '', // 한 페이지에 출력될 항목 갯수
        page = req.query.hasOwnProperty('page') ? (req.query.page.trim() - 1) * pageRows : '';
      
      // ID값이 혹시 넘어왔는지 체크한다.
      const id = req.params.hasOwnProperty('id') ? req.params.id : null;
      const returnType = id === null ? Enums.ListType.LIST : Enums.ListType.ONE;

      // 쿼리문을 작성한다.
      let dbQuery = '';
      let bindingList = []; // 바인딩할 배열

      dbQuery +='SELECT SQL_CALC_FOUND_ROWS id, loginId, `status`, `group`, nickname, phone, dDay, LV, receiveSms, receiveEmail, note, img, gender, users.like, rating ';
      dbQuery += 'FROM users ';

      // 조건 및 필터에 따른 WHERE 절 추가
      // 그룹에 따라 left join 실행하기 ex) left join users_company
      if (returnType === Enums.ListType.ONE) {
        dbQuery += 'WHERE id = ? LIMIT 1';
        bindingList.push(id);
      } else {
        // group, status 값 없을경우 에러 문구 표시
        if ((group || status) == undefined) {
          return new Error('그룹 또는 상태 값이 넘어오지 않았습니다.');
        }

        // group, status 문자열 치환
        for (var i in status) {
          status[i] = JSON.stringify(status[i]);
        }
        for (var j in group) {
          group[j] = JSON.stringify(group[j]);
        }

        dbQuery += 'WHERE `status` IN (' + status + ') AND `group` IN (' + group + ') AND ';
        dbQuery += 'CONCAT(id, loginId, nickname, phone) REGEXP ? LIMIT ?, ?';
        bindingList.push(query, page, pageRows);
      }

      // 쿼리 실행
      try {
        let result = (await db.raw(dbQuery, bindingList))[0];

        if (returnType === Enums.ListType.ONE) {
          result = result[0];
          result.dDayNull = typeof result.dDay === 'undefined' || result.dDay === null;
          res.status(200).json({ result });

        } else {
          // Limit을 제외하고 count를 저장할 수 있는 역할

          const totalCountResult =
            (await db.raw('SELECT FOUND_ROWS() AS cnt'))[0][0].cnt * 1;
          res.status(200).json({
            pageInfo: {
              page: req.query.page * 1,
              totalRows: totalCountResult,
            },
            result,
          });
        }
      } catch (e) {
        return res.status(500).json({ error: '데이터베이스 오류가 발생하였습니다' });
      }
    } catch (e) {
      res.status(400).json({ error: '정보가 일치하지 않습니다' });
    }
  },

  // 사용자 정보 수정
  async postUsers(req, res) {
    try {
      const id = req.params.hasOwnProperty('id') ? req.params.id.trim() : '',
        status = req.body.hasOwnProperty('status') ? req.body.status.trim() : '',
        group = req.body.hasOwnProperty('group') ? req.body.group.trim() : '',
        nickname = req.body.hasOwnProperty('nickname') ? req.body.nickname.trim() : '',
        phone = req.body.hasOwnProperty('phone') ? req.body.phone.trim() : '',
        receiveSms = req.body.hasOwnProperty('receiveSms') ? req.body.receiveSms.trim() : '',
        receiveEmail = req.body.hasOwnProperty('receiveEmail') ? req.body.receiveEmail.trim() : '',
        note = req.body.hasOwnProperty('note') ? req.body.note.trim() : '',
        dDay = req.body.hasOwnProperty('dDay') ? req.body.dDay.trim() : null,
        gender = req.body.hasOwnProperty('gender') ? req.body.gender.trim() : null;

      let userImg = '';

      if (req.files !== undefined) {
        // 파일 업로드
        let bucket_name = config.s3.uploadBucketName + 'users';
        let files = req.files.file;

        // upload file
        let set = await S3.putObject({
          Bucket: bucket_name,
          Key: md5(files.name + time), // 업로드 name
          // ACL을 지우면 전체 공개되지 않습니다.
          ACL: 'public-read',
          Body: files.data,
        }).promise();

        // 이미지 url
        userImg = 'https://kr.object.ncloudstorage.com/' + bucket_name + '/' +md5(files.name + time);

        // @todo: 수정일경우 기존에 등록된 이미지가 있으면 삭제처리
      } else {
        // 이미지 url
        // userImg = img
      }

  
      try {
        let query = `UPDATE users SET \`status\` = ?, \`group\` = ?, nickname = ?, phone = ?, receiveSms = ?, receiveEmail = ?, note = ?, dDay = ?, updUser = ?, gender=?`;
        let bindList = [status, group, nickname, phone, receiveSms, receiveEmail, note, dDay, req.loginUserID, gender,];

        if (userImg.length > 0) {
          query += ',`img` = ? ';
          bindList.push(userImg);
        }

        query += ' WHERE id = ? ';
        bindList.push(id);

        //쿼리 실행
        await db.raw(query, bindList);
        res.status(200).json({ result: 'OK' });
      } catch (e) {
        res.status(500).json({ error: '데이터베이스 오류가 발행하였습니다' });
      }
    } catch (e) {
      res.status(400).json({ error: '정보가 일치하지 않습니다' });
    }
  },

  // 사용자 비밀번호 변경
  async postPasswordChange(req, res) {
    try {
      const id = req.params.hasOwnProperty('id') ? req.params.id.trim() : '',
        pw1 = req.body.hasOwnProperty('pw1') ? req.body.pw1.trim() : '',
        pw2 = req.body.hasOwnProperty('pw2') ? req.body.pw2.trim() : '';

      // 비밀번호 검증 진행
      try {
        if (pw1 != pw2) {
          throw new Error('비밀번호가 다릅니다.');
        } else if (pw1.length === 0 || pw2.length === 0) {
          throw new Error('[비밀번호]를 입력하셔야 합니다.');
        } else if (
          !/^.*(?=^.{8,20}$)(?=.*\d)(?=.*[a-zA-Z])(?=.*[!@#$%^&+=]).*$/.test(pw2)
        ) {
          throw new Error('[비밀번호]는 8~20자리의 영문,숫자,특수문자를 포함하여야 합니다.');
        }
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }

      // 암호화 실행
      const encryptedPassword = require('sha256')(
        require('md5')(secretKey + pw2)
      );

      // 쿼리 실행
      await db.raw('UPDATE users SET loginPassword = ? WHERE id = ?', [encryptedPassword, id,]);
      return res.status(200).json({ result: 'OK' });
    } catch (e) {
      return res.status(500).json({ error: '데이타 베이스 오류가 발생하였습니다' });
    }
  },

  // 사용자 상태 변경
  async postStatusChange(req, res) {
    try {
      const id = req.params.hasOwnProperty('id') ? req.params.id.trim() : '',
        status = req.body.hasOwnProperty('status') ? req.body.status.trim() : '';

      // 쿼리 실행
      await db.raw('UPDATE users SET status = ? WHERE id = ?', [status, id]);
      return res.status(200).json({ result: 'OK' });
    } catch (e) {
      return res.status(500).json({ error: '데이타 베이스 오류가 발생하였습니다' });
    }
  },

  // 사용자 관리자 변경
  async postAdminChange(req, res) {
    try {
      const id = req.params.hasOwnProperty('id') ? req.params.id.trim() : '',
        isAdmin = req.body.hasOwnProperty('isAdmin') ? req.body.isAdmin.trim() : '';

      // 사용자 관리자 추가
      if (isAdmin === 'Y') {
        // 일반 사용자가 아닌지 확인
        let check = (await db.raw('SELECT id, `group` FROM users WHERE id = ? AND `status` = "Y" AND isAdmin = "N"', [id]))[0];

        if (check.length === 1) {
          // 쿼리 실행
          await db.raw('UPDATE users SET isAdmin = ? WHERE id = ?', [isAdmin, id,]);
          return res.status(200).json({ result: 'OK' });
        } else {
          return res.status(500).json({ error: '정보가 일치하지 않습니다.' });
        }

        // 사용자 관리자 삭제
      } else {
        // 관리자인지 확인
        let check = (
          await db.raw('SELECT id, `group` FROM users WHERE id = ? AND `status` = "Y" AND isAdmin = "Y"', [id]))[0];

        if (check.length === 1) {
          // 쿼리 실행
          await db.raw('UPDATE users SET isAdmin = ? WHERE id = ?', [isAdmin, id,]);
          return res.status(200).json({ result: 'OK' });
        } else {
          return res.status(500).json({ error: '정보가 일치하지 않습니다.' });
        }
      }
    } catch (e) {
      return res.status(500).json({ error: '데이타 베이스 오류가 발생하였습니다' });
    }
  },

  // 사용자 포인트 목록
  async getUserPoint(req, res) {
    const id = req.params.hasOwnProperty('id') ? req.params.id.trim() : '';

    try {
      // 쿼리 실행
      let result = (
        await db.raw(
            `SELECT c.id, userId, nickname, c.cash, type, content, c.status, c.regDt
            FROM user_cash AS c LEFT JOIN users ON userId = users.id
            WHERE userId = ? ORDER BY c.regDt DESC`, [id]))[0];

      if(result.length === 0) {
        return res.status(400).json({ error : "포인트가 없습니다."});
      } else {
        return res.status(200).json({ result });
      }

    } catch (e) {
      return res
        .status(500)
        .json({ error: '데이타 베이스 오류가 발생하였습니다' });
    }
  },

  // 사용자 포인트 추가
  async postUserPoint(req, res) {
    try {
      const id = req.params.hasOwnProperty('id') ? req.params.id.trim() : '',
        cash = req.body.hasOwnProperty('cash') ? req.body.cash : '',
        content = req.body.hasOwnProperty('content') ? req.body.content.trim() : '',
        status = req.body.hasOwnProperty('status') ? req.body.status.trim() : '';

      // 쿼리 실행
      await db.raw( 'INSERT INTO user_cash (userId, cash, type, content, status) VALUES (?, ?, "포인트 적립", ?, ?)', [id, cash, content, status]);
      return res.status(200).json({ result: 'OK' });
    } catch (e) {
      return res.status(500).json({ error: '데이타 베이스 오류가 발생하였습니다' });
    }
  },

  // 사용자 포인트 차감
  async deleteUserPoint(req, res) {
    const id = req.params.hasOwnProperty('id') ? req.params.id.trim() : '',
      cash = req.body.hasOwnProperty('cash') ? req.body.cash : '',
      content = req.body.hasOwnProperty('content') ? req.body.content.trim() : '',
      status = req.body.hasOwnProperty('status') ? req.body.status.trim() : '';

    try {
      // 쿼리 실행
      await db.raw(
        'INSERT INTO user_cash (userId, cash, type, content, status) VALUES (?, ?, "포인트 차감", ?, ?)', [id, cash, content, status]);
      return res.status(200).json({ result: 'OK' });
    } catch (e) {
      return res.status(500).json({ error: '데이타 베이스 오류가 발생하였습니다' });
    }
  },

  // 사용자 쿠폰 목록
  async getUserCoupon(req, res) {
    const userId = req.params.hasOwnProperty('userId') ? req.params.userId.trim(): '';

    // 쿼리 실행
    try {
      let result = (await db.raw('SELECT id, `status`, `type`, userId, title, content, regDt, regUser, expDt FROM user_coupon WHERE userId = ? AND status = "Y" ORDER BY id DESC', [userId]))[0];

      if(result.length === 0) {
        return res.status(400).json({ error : "쿠폰이 없습니다."});
      } else {
        return res.status(200).json({ result });
      }
    } catch (e) {
      return res.status(500).json({ error: '데이타 베이스 오류가 발생하였습니다' });
    }
  },

  // 사용자 쿠폰 추가
  async postUserCoupon(req, res) {
    const userId = req.params.hasOwnProperty('userId') ? req.params.userId : '',
      status = req.body.hasOwnProperty('status') ? req.body.status.trim() : '',
      note = req.body.hasOwnProperty('note') ? req.body.note.trim() : '',
      expire = req.body.hasOwnProperty('expire') ? req.body.expire : '',
      content = req.body.hasOwnProperty('content')? req.body.content.trim(): '',
      coupon = req.body.hasOwnProperty('coupon') ? req.body.coupon : '',
      title = req.body.hasOwnProperty('title') ? req.body.title.trim() : '',
      type = req.body.hasOwnProperty('type') ? req.body.type.trim() : '';
    
    // 쿼리 실행
    try {
      await db.raw('INSERT INTO user_coupon (`status`, `type`, userId, title, content, coupon, note, regUser, expDt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [status, type, userId, title, content, coupon, note, req.loginUserID, expire]);
      return res.status(200).json({ result: 'OK' });
    } catch (e) {
      return res.status(500).json({ error: '데이타 베이스 오류가 발생하였습니다' });
    }
  },

  // 사용자 쿠폰 삭제
  async deleteUserCoupon(req, res) {
    const id = req.params.hasOwnProperty('id') ? req.params.id.trim() : ''; 

    try {
      // 쿼리 실행
      await db.raw('UPDATE user_coupon SET `status` = "D" WHERE id = ?', [id]);
      return res.status(200).json({ result: 'OK' });
    } catch (e) {
      return res.status(500).json({ error: '데이타 베이스 오류가 발생하였습니다' });
    }
  },

  async checkId (req, res) {
    try {
      const loginId = req.query.hasOwnProperty('loginId') ? req.query.loginId : null
      const id = (await db.raw('SELECT loginId FROM users WHERE loginId = ?', [loginId]))[0]

      if (id.length> 0) {
        return res.status(200).json({result:true})
      } else {
        return res.status(200).json({result:false})
      }
    } catch (e) {
      return res.status(400).json({ error : '데이터베이스 오류가 발생하였습니다.' })
    }
  },

  async findId (req, res) {
    const phone = req.query.hasOwnProperty('phone') ? req.query.phone : null

    if(! phone) {
      return res.status(400).json({error: '인증받은 핸드폰 번호가 넘어오지 않았습니다.'});
    }

    const id = (await db.raw('SELECT loginId FROM users WHERE phone = ?', [phone]))[0]

    if (id.length> 0) {
      let loginId = id[0].loginId
      let idArr =[]
      let at = loginId.indexOf('@')

      for(let i = 0; i < loginId.length; i++) {
        if(i >= 3 && at > i) {
          idArr.push('*')
        } else if (i <= 2 || at <= i){
          idArr.push(loginId[i])
        }
      }
      
      return res.status(200).json({result: idArr.join('') });
    } else {
      return res.status(200).json({result:false})
    }
  },

  async findPass (req, res) {
    const phone = req.query.hasOwnProperty('phone') ? req.query.phone : null
    const email = req.query.hasOwnProperty('loginId') ? req.query.loginId: null

    if(! phone) {
      return res.status(400).json({error: '인증받은 핸드폰 번호가 넘어오지 않았습니다.'});
    }

    if(! email) {
      return res.status(400).json({error: '로그인 아이디가 넘어오지 않았습니다.'});

    }

    const id = (await db.raw('SELECT MD5(id) AS loginId FROM users WHERE phone = ? AND loginId= ?', [phone, email]))[0]

    if (id.length> 0) {
      return res.status(200).json({result:id[0].loginId});
    } else {
      return res.status(200).json({result:false})
    }
  },

  async findPassChange(req, res) {
    const password =  req.body.hasOwnProperty('password') ? req.body.password : null;
    const userId = req.body.hasOwnProperty('userId') ? req.body.userId: null;

    if(! password) {
      return res.status(400).json({error: '비밀번호가 설정되지 않았습니다.'})
    }

    if(! userId) {
      return res.status(400).json({error:'잘못된 접근입니다.'})
    }

    const encryptedPassword = require('sha256')(require('md5')(secretKey + password));

    // 쿼리 실행
    let query = "UPDATE users SET `loginPassword` =? WHERE MD5(id) = ?"
    await db.raw(query, [encryptedPassword, userId]);
    return res.status(200).json({});
  },

  /** 카카오 사용자 회원가입 처리 **/
  async kakaoSignUp(req, res) {
    // 넘어온 변수를 받는다
    // 넘어온 변수를 받는다.
    const nickname = req.body.hasOwnProperty('name') ? req.body.name.trim() : '',
      loginId = req.body.hasOwnProperty('loginId') ? req.body.loginId.trim() : '',
      phone = req.body.hasOwnProperty('phone') ? req.body.phone.trim() : '',
      receiveSms = req.body.hasOwnProperty('receiveSms') ? req.body.receiveSms.trim() : 'N',
      receiveEmail = req.body.hasOwnProperty('receiveEmail') ? req.body.receiveEmail.trim() : 'N',
      gender = req.body.hasOwnProperty('gender') ? req.body.gender.trim() : '',
      loginType = req.body.hasOwnProperty('loginType') ? req.body.loginType.trim() : '';

    let dDay = req.body.hasOwnProperty('dDay') ? req.body.dDay.trim() : null;

    if (dDay !== null) {
      const tempDday = new Date(dDay);
      dDay = tempDday.dateFormat('yyyy-MM-dd');
    }

    if (dDay === '' || dDay.trim() === '' || dDay.length === 0) {
      dDay = null;
    }

    try {
      if (loginId.length === 0) {
        throw new Error('[이메일주소]를 입력하셔야 합니다.');
      }

      if (!/^[a-z0-9_+.-]+@([a-z0-9-]+\.)+[a-z0-9]{2,4}$/.test(loginId)) {
        throw new Error('올바른 형식의 [이메일주소]를 입력하셔야 합니다.');
      }

      let _tempCheck2 = null;
      await userModel
        .GetUser(loginId, 'loginId')
        .then((res) => {
          _tempCheck2 = res;
        })
        .catch(() => {
          _tempCheck2 = null;
        });

      if (_tempCheck2 !== null && _tempCheck2.hasOwnProperty('loginId') !== false) {
        throw new Error('이미 존재하는 아이디 입니다.');
      }

      if (loginPass.length === 0) {
        throw new Error('[비밀번호]를 입력하셔야 합니다.');
      }

      if (!/^.*(?=^.{8,20}$)(?=.*\d)(?=.*[a-zA-Z])(?=.*[!@#$%^&+=]).*$/.test(loginPass)) {
        throw new Error('[비밀번호]는 8~20자리의 영문,숫자,특수문자를 포함하여야 합니다.');
      }
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    // 파일 업로드
    let userImg;
    if (req.files !== undefined) {
      let bucket_name = config.s3.uploadBucketName + 'users';
      let files = req.files.file;

      // upload file
      let set = await S3.putObject({
        Bucket: bucket_name,
        Key: md5(files.name + time), // 업로드 name
        // ACL을 지우면 전체 공개되지 않습니다.
        ACL: 'public-read',
        Body: files.data,
      }).promise();

      // 이미지 url
      userImg = 'https://kr.object.ncloudstorage.com/' + bucket_name + '/' + md5(files.name + time);
    } else {
      // 이미지 url
      userImg = '';
    }

    try {
      const encryptedPassword = require('sha256')(
        require('md5')(secretKey + loginPass)
      );

      // 실제 사용자 추가 처리
      await userModel
        .AddUser({
          loginId: loginId,
          loginPassword: encryptedPassword,
          nickname: nickname,
          status: 'Y',
          group: '일반',
          phone: phone,
          dDay: dDay,
          note: note,
          receiveSms: receiveSms,
          receiveEmail: receiveEmail,
          gender: gender,
          loginType: loginType,
        })
        .then((res) => {
          if (!res.status) {
            throw new Error(res.error);
          }
        });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }

    // 일반 사용자 권한 설정
    try {
      let userId = (await db.raw('SELECT id FROM users ORDER BY id DESC LIMIT 1'))[0][0].id;
      
      // 쿼리 실행
      await db.raw(`INSERT INTO users_authorize VALUES 
      (${userId}, "INQUIRY/MODIFY"), (${userId}, "PRODUCTS/LIST_ALL"), (${userId}, "INQUIRY/LIST"), (${userId}, "INQUIRY/REMOVE"), 
      (${userId}, "COMPANY/LIST_ALL"), (${userId}, "USERS/LIST"), (${userId}, "BASECODE/LIST_ALL"), (${userId}, "LIKE/MODIFY"), 
      (${userId}, "LIKE/LIST"), (${userId}, "WISH/MODIFY"), (${userId}, "WISH/LIST"), (${userId}, "DASHBOARD/LIST_ALL"), (${userId}, "CHECKLIST/LIST"), 
      (${userId}, "COMMENT/LIST"), (${userId}, "COMMENT/LIST_ALL"), (${userId}, "COMMENT/MODIFY"), (${userId}, "COMMENT/REMOVE")`);
      
      return res.status(200).json({});
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  },
};
