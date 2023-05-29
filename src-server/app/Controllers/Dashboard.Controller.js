const db = require('../Core/Database.core');
const Enums = require('../Helpers/Enums');
const logModel = require('../Models/log.model');
const ipModel = require('../Models/ip.model');

/**
 * 대시보드 이미지 리스트 관련 API
 */
module.exports = {
  // 대시보드 이미지 리스트 목록 및 정보 가져오기
  async GetDashboard(req, res) {
    // 경로 패러미터에서 사용자 권한 id를 가져온다.
    const id = req.params.hasOwnProperty('typeId') ? req.params.typeId : null;
    const returnType = id === null ? Enums.ListType.LIST : Enums.ListType.ONE;
    const loginUserId = req.query.hasOwnProperty('userId') ? req.query.userId : 0;
    const ext1 = req.query.hasOwnProperty('ext1') ? req.query.ext1 : 18;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // 쿼리문을 작성한다.
    let query = '';
    let dbQuery = '';
    let dbQuery2 = '';

    // 회원일 경우
    try {
      if (loginUserId !== 0) {
        // 상품 정보 가져오기
        // 5 ~ 1등
        if (returnType === Enums.ListType.ONE) {
          query = `SELECT  D.id AS dashboardId, P.id, D.status, D.productId, P.type, P.name, imgUrl, P.wish, P.like, (CASE WHEN PL.id IS NULL THEN 0 ELSE 1 END) AS \`isLike\`, (CASE WHEN PW.id IS NULL THEN 0 ELSE 1 END) AS \`isWish\`, C.companyName, C.logoImg, P.regDt
            FROM dashboard D LEFT JOIN products P ON D.productId = P.id
              LEFT JOIN products_wish AS PW ON PW.userId=${loginUserId} AND PW.productId=P.id AND PW.status = 'Y'
              LEFT JOIN products_like AS PL ON PL.userId=${loginUserId} AND PL.productId=P.id AND PL.status = 'Y'
              LEFT JOIN company AS C ON P.companyId = C.id
            WHERE D.typeId = ${id} AND D.status = "Y" AND P.status = 'Y'`;

          dbQuery = `SELECT * FROM (${query} ORDER BY P.wish DESC, regDt ASC LIMIT 5)t ORDER BY wish ASC`;
          result = (await db.raw(dbQuery))[0];

          for (let k in result) {
            result[k].rank = result.length - k * 1;
          }

          // 6 ~ 25등
          dbQuery2 = `${query} ORDER BY wish DESC, regDt ASC LIMIT 5, 50`;
          result2 = (await db.raw(dbQuery2))[0];

          for (let k in result2) {
            result2[k].rank = 6 + k * 1;
          }

          // concat으로 result 결과값 합치기
          const newResult = result.concat(result2);

          // 사용 로그 추가
          await logModel.postLog('대시보드/조회', loginUserId, await ipModel.ip2long(ip), `회원 조회 / typeId : ${id}`);
          return res.status(200).json({ result: newResult });
        }

        // 비회원일 경우
        // 댓글 left join 해서 넣기
      } else if (loginUserId == 0) {
        query = `SELECT D.id AS dashboardId, P.id, D.status, D.productId, P.type, imgUrl, P.wish, P.like, C.companyName, C.logoImg, P.regDt\
        FROM dashboard D LEFT JOIN products P ON D.productId = P.id \
          LEFT JOIN company AS C ON P.companyId = C.id \
        WHERE D.status = "Y" AND typeId = ${id} ORDER BY P.wish DESC, regDt ASC`;

        // 5 ~ 1 등 까지 표시
        let dbQuery = `SELECT * FROM (${query} LIMIT 5)t ORDER BY wish ASC, regDt DESC`;
        result = (await db.raw(dbQuery))[0];
        for (let k in result) {
          result[k].rank = result.length - k * 1;
        }
        // 6 ~ 25 등 까지 표시
        let dbQuery2 = `${query} LIMIT 5, 50`;
        result2 = (await db.raw(dbQuery2))[0];
        for (let k in result2) {
          result2[k].rank = 6 + k * 1;
        }

        // concat으로 result 결과값 합치기
        const newResult = result.concat(result2);

        // 사용 로그 추가
        await logModel.postLog('대시보드/조회', loginUserId, await ipModel.ip2long(ip), `비회원 조회 / typeId : ${id}`);
        return res.status(200).json({ result: newResult });
      }
    } catch (e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다');
    }
  },

  // 대시보드 이미지 리스트 생성 및 수정하기
  async PostDashboard(req, res) {
    const productId = req.body.hasOwnProperty('productId') ? req.body.productId : '';
    const status = req.body.hasOwnProperty('status') ? req.body.status : '';
    const typeId = req.body.hasOwnProperty('typeId') ? req.body.typeId : '';
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // 경로 패러미터에서 사용자 권한 id를 가져온다.
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;

    // id 존재 여부에 따라  INSERT / UPDATE 모드를 결정한다.
    const PostType = id === null ? Enums.FormMode.INSERT : Enums.FormMode.UPDATE;

    // 대시보드 이미지 리스트 생성하기 진행
    if (PostType === 'INSERT') {
      // dashboard 테이블 insert 쿼리 실행
      try {
        // 중복 업로드 확인하는 쿼리문
        let uploadCheck = (await db.raw('SELECT * FROM dashboard WHERE typeId = ? AND `status` = "Y" AND productId = ?', [typeId, productId,]))[0][0];

        if (uploadCheck === undefined) {
          let insert = await db.raw('INSERT INTO dashboard (`status`, userId, typeId, productId) VALUES (?, ?, ?, ?)', [status, req.loginUserID, typeId, productId]);

          // 사용 로그 추가
          await logModel.postLog('대시보드/등록', req.loginUserID, await ipModel.ip2long(ip), `대시보드 등록 / typeId : ${typeId} / dashboardId : ${insert[0].insertId} / productId : ${productId}`);
          return res.status(200).json({ result: 'OK' });

          // 중복 업로드일 경우
        } else {
          return res.status(500).json('이미지 중복 업로드 ');
        }
      } catch (e) {
        return res.status(500).json('데이터베이스 오류가 발생하였습니다');
      }

      // 대시보드 이미지 리스트 수정하기 진행
    } else if (PostType === 'UPDATE') {
      // dashboard 테이블 update 쿼리 실행
      try {
        await db.raw('UPDATE dashboard SET `status` = ?, updUser = ?, typeId = ?, productId = ? WHERE id = ?', [status, req.loginUserID, typeId, productId, id]);

        // 사용 로그 추가
        await logModel.postLog('대시보드/수정', req.loginUserID, await ipModel.ip2long(ip), `대시보드 수정 / typeId : ${typeId} / dashboardId : ${id} / productId : ${productId}`);
        return res.status(200).json({ result: 'OK' });
      } catch (e) {
        return res.status(500).json('데이터베이스 오류가 발생하였습니다');
      }
    }
  },

  // 대시보드 이미지 리스트 삭제하기
  async DeleteDashboard(req, res) {
    const dashboardId = req.params.hasOwnProperty('dashboardId') ? req.params.dashboardId : null;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    try {
      await db.raw('UPDATE dashboard SET `status` = "N" WHERE id = ?', [dashboardId]);

      // 사용 로그 추가
      await logModel.postLog('대시보드/삭제', req.loginUserID, await ipModel.ip2long(ip), `대시보드 삭제 / dashboardId : ${dashboardId}`);
      return res.status(200).json({ result: 'OK' });
    } catch (e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다');
    }
  },

  // 대시보드 비로그인 및 찜 비활성화 시 찜 리스트
  async GetDashboardWishList(req, res) {
    const userId = req.query.hasOwnProperty('userId') ? req.query.userId : 0;
    const typeId = req.query.hasOwnProperty('typeId') ? req.query.typeId : 18;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    let result;

    try {
      // 드레스
      if (typeId == 18) {
        result = (await db.raw(
          `SELECT products.id AS productId, wish, products.like, products.type, imgUrl, logoImg, companyName, (CASE WHEN t.productId IS NULL THEN 0 ELSE 1 END) AS isLike, (CASE WHEN i.productId IS NULL THEN 0 ELSE 1 END) AS isWish
            FROM products LEFT JOIN company ON products.companyId = company.id \
              LEFT JOIN (SELECT id, userId, productId FROM products_like WHERE userId = ${userId} AND \`status\` = 'Y' AND (productId = 246 OR productId = 204 OR productId = 14 OR productId = 216))t ON t.productId = products.id
              LEFT JOIN (SELECT id, userId, productId FROM products_wish WHERE userId = ${userId} AND \`status\` = 'Y' AND (productId = 246 OR productId = 204 OR productId = 14 OR productId = 216))i ON i.productId = products.id
            WHERE products.id IN (246,204,14,216) ORDER BY CASE WHEN products.id = 246 THEN 1 WHEN products.id != 246 THEN 2 ELSE 0 END, products.id ASC`))[0];
        // 웨딩홀
      } else if (typeId == 19) {
        // 한복
      } else if (typeId == 20) {
        result = (await db.raw(
          `SELECT products.id AS productId, wish, products.like, products.type, imgUrl, logoImg, companyName, (CASE WHEN t.productId IS NULL THEN 0 ELSE 1 END) AS isLike, (CASE WHEN i.productId IS NULL THEN 0 ELSE 1 END) AS isWish
            FROM products LEFT JOIN company ON products.companyId = company.id
              LEFT JOIN (SELECT id, userId, productId FROM products_like WHERE userId = ${userId} AND \`status\` = 'Y' AND (productId = 513 OR productId = 514 OR productId = 512 OR productId = 493 OR productId = 286))t ON t.productId = products.id
              LEFT JOIN (SELECT id, userId, productId FROM products_wish WHERE userId = ${userId} AND \`status\` = 'Y' AND (productId = 513 OR productId = 514 OR productId = 512 OR productId = 493 OR productId = 286))i ON i.productId = products.id
            WHERE products.id IN (513,514,512,493,286)`))[0];
        // 예물
      } else if (typeId == 21) {
        result = (await db.raw(
          `SELECT products.id AS productId, wish, products.like, products.type, imgUrl, logoImg, companyName, (CASE WHEN t.productId IS NULL THEN 0 ELSE 1 END) AS isLike, (CASE WHEN i.productId IS NULL THEN 0 ELSE 1 END) AS isWish
            FROM products LEFT JOIN company ON products.companyId = company.id
              LEFT JOIN (SELECT id, userId, productId FROM products_like WHERE userId = ${userId} AND \`status\` = 'Y' AND (productId = 311 OR productId = 382 OR productId = 321 OR productId = 336 OR productId = 484))t ON t.productId = products.id
              LEFT JOIN (SELECT id, userId, productId FROM products_wish WHERE userId = ${userId} AND \`status\` = 'Y' AND (productId = 311 OR productId = 382 OR productId = 321 OR productId = 336 OR productId = 484))i ON i.productId = products.id
            WHERE products.id IN (311,382,321,336,484)`))[0];
        // 예복
      } else if (typeId == 22) {
        result = (await db.raw(
            `SELECT products.id AS productId, wish, products.like, products.type, imgUrl, logoImg, companyName, (CASE WHEN t.productId IS NULL THEN 0 ELSE 1 END) AS isLike, (CASE WHEN i.productId IS NULL THEN 0 ELSE 1 END) AS isWish
            FROM products LEFT JOIN company ON products.companyId = company.id
              LEFT JOIN (SELECT id, userId, productId FROM products_like WHERE userId = ${userId} AND \`status\` = 'Y' AND (productId = 492 OR productId = 342 OR productId = 332 OR productId = 317 OR productId = 361))t ON t.productId = products.id
              LEFT JOIN (SELECT id, userId, productId FROM products_wish WHERE userId = ${userId} AND \`status\` = 'Y' AND (productId = 492 OR productId = 342 OR productId = 332 OR productId = 317 OR productId = 361))i ON i.productId = products.id
            WHERE products.id IN (492,342,332,317,361)`))[0];
      }

      // 사용 로그 추가
      await logModel.postLog('대시보드/조회', userId, await ipModel.ip2long(ip), `대시보드 비회원, 찜 비활성화 멤버 찜 리스트 조회`);
      return res.status(200).json({ result: result });
    } catch (e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다');
    }
  },
};