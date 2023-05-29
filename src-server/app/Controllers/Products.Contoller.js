const db = require('../Core/Database.core');
const Enums = require('../Helpers/Enums');
const AWS = require('aws-sdk');
const config = require('../config');
const endpoint = new AWS.Endpoint('https://kr.object.ncloudstorage.com');
const region = 'kr-standard';
const bucket = require('../Models/bucket.model');
const md5 = require('md5');
const logModel = require('../Models/log.model');
const ipModel = require('../Models/ip.model');

// n cloud 연결
const S3 = new AWS.S3({
  endpoint,
  region,
  credentials: {
    accessKeyId: config.s3.access_key,
    secretAccessKey: config.s3.secret_key,
  },
});

const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, prettyPrint } = format;

const logger = createLogger({
  format: combine(label({ label: 'right meow!' }), timestamp(), prettyPrint()),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: 'logging',
    }),
  ],
});

/**
 * 상품 정보 관련 api
 */

module.exports = {
  // 상품 정보 및 목록 가져오기
  async getProducts(req, res) {
    const query = req.query.hasOwnProperty('query') ? req.query.query.trim() : '';
    const pageRows = req.query.hasOwnProperty('pageRows') ? req.query.pageRows.trim() * 1 : 10; // 한 페이지에 출력될 항목 갯수
    const page = req.query.hasOwnProperty('page') ? (req.query.page.trim() - 1) * pageRows : 0;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    let approval = req.query.approval !== undefined ? req.query.approval : null;
    let status = req.query.hasOwnProperty('status') ? req.query.status : ['Y', 'N', 'H'];
    let saleType = req.query.hasOwnProperty('saleType') ? req.query.saleType : [0];

    for (let i in status) {
      status[i] = JSON.stringify(status[i]);
    }

    let type = req.query.hasOwnProperty('type') ? req.query.type : [18, 19, 20, 21, 22];
    for (let i in type) {
      type[i] = JSON.stringify(type[i]);
    }

    for (let i in saleType) {
      saleType[i] = JSON.stringify(saleType[i]);
    }

    for (let i in approval) {
      approval[i] = JSON.stringify(approval[i]);
    }

    // 경로 패러미터에서 사용자 권한 id를 가져온다.
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;
    const returnType = id === null ? Enums.ListType.LIST : Enums.ListType.ONE;

    // 쿼리문을 작성한다.
    let dbQuery = '';
    let bindingList = []; // 바인딩할 배열

    // SELECT
    dbQuery += `SELECT SQL_CALC_FOUND_ROWS products.id, products.companyId, products.status, products.name, products.type, basecode.name AS typeName, products.saleType, t.name AS saleTypeName, content, products.rating, products.wish, products.like, imgUrl, imgSideUrl, price, companyName,`;
    dbQuery += ` approval, t.name AS saleTypeName, content, products.rating, products.wish, products.like, imgUrl, imgSideUrl, price, discountPrice, companyName, approval,`;
    dbQuery += ` products.option1 ,products.option2 ,products.option3 ,products.option4 ,products.option5`;

    // FROM
    dbQuery += ' FROM products LEFT JOIN basecode ON products.type = basecode.id LEFT JOIN company ON companyId = company.id LEFT JOIN (SELECT id, `name` FROM basecode)t ON products.saleType = t.id';
    dbQuery += ' WHERE 1 ';

    // Status 필터 적용
    dbQuery += ' AND products.status IN (' + status + ') ';

    // 상품 정보 가져오기
    if (returnType === Enums.ListType.ONE) {
      dbQuery += ' AND products.id = ?';
      bindingList.push(id);
      // 조건 및 필터에 따른 WHERE 절 추가
    } else {
      // 승인여부
      if (approval !== undefined && approval !== null) {
        dbQuery += ' AND products.approval IN  (' + approval + ')';
      }

      // 검색 필터
      if (query.length > 0) {
        dbQuery += `AND (products.id LIKE '%${query}%' OR price LIKE '%${query}%' OR products.content LIKE '%${query}%' OR basecode.name LIKE '%${query}%') `;
      }

      if (type.length > 0) {
        dbQuery += `AND products.type IN (${type}) `;
      }

      if (saleType.length > 0) {
        dbQuery += `AND saleType IN (${saleType}) `;
      }

      dbQuery += 'ORDER BY products.id DESC LIMIT ?, ? ';
      bindingList.push(page, pageRows);
    }

    
    try {
      // 쿼리 실행
      let result = [];
      result = (await db.raw(dbQuery, bindingList))[0];

      // 원가, 할인가 퍼센트 계산
      if(result.price > 0 && result.discountPrice > 0) {
        percent = (result.discountPrice / result.price -1) * 100
        result.percent = percent.toFixed(2)
      }

      // Limit을 제외하고 count를 저장할 수 있는 역할
      const totalCountResult = (await db.raw('SELECT FOUND_ROWS() AS cnt'))[0][0].cnt * 1;

      // 사용 로그 추가
      if (id === null) {
        await logModel.postLog('상품/조회', req.loginUserID, await ipModel.ip2long(ip), `상품 리스트 조회 / typeId : ${type}`);
      } else if (id > 0) {
        await logModel.postLog('상품/조회', req.loginUserID, await ipModel.ip2long(ip), `상품 조회 / productId : ${id}`);
      }

      return res.status(200).json(db.getReturnObject(returnType, result, totalCountResult));
    } catch (e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다');
    }
  },

  // 상품 정보 등록 및 수정하기
  async postProducts(req, res) {
    const status = req.body.hasOwnProperty('status') ? req.body.status : 'H';
    const type = req.body.hasOwnProperty('type') ? req.body.type : '';
    const saleType = req.body.hasOwnProperty('saleType') ? req.body.saleType : '';
    const price = req.body.hasOwnProperty('price') ? req.body.price : 0;
    const discountPrice = req.body.hasOwnProperty('discountPrice') ? req.body.discountPrice : 0;
    const companyId = req.body.hasOwnProperty('companyId') ? req.body.companyId : '';
    const name = req.body.hasOwnProperty('name') ? req.body.name : '';
    const content = req.body.hasOwnProperty('content') ? req.body.content : '';
    const option1 = req.body.hasOwnProperty('option1') ? req.body.option1 : 0;
    const option2 = req.body.hasOwnProperty('option2') ? req.body.option2 : 0;
    const option3 = req.body.hasOwnProperty('option3') ? req.body.option3 : 0;
    const option4 = req.body.hasOwnProperty('option4') ? req.body.option4 : 0;
    const option5 = req.body.hasOwnProperty('option5') ? req.body.option5 : 0;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const wish = req.body.hasOwnProperty('wish') ? req.body.wish : 0;

    // 드레스 세부 내용
    let companyName = '';
    let imgUrl;
    let imgSideUrl = {};
    let url = '';
    let time = Math.floor(new Date().getTime() / 1000);

    // 경로 패러미터에서 사용자 권한 id를 가져온다.
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;
    const FormMode = id === null ? Enums.FormMode.INSERT : Enums.FormMode.UPDATE;

    // 컴퍼니 명 검색
    try {
      let result = await db.raw('SELECT companyName FROM company WHERE id = ?', [companyId]);
      companyName = result[0][0].companyName;
    } catch (e) {
      res.status(500).json('데이터베이스 오류가 발생하였습니다.');
    }

    // 이미지 있을 경우 파일 업로드 진행
    if (req.files !== null && req.files !== undefined) {
      let bucketName = config.s3.uploadBucketName + companyName + '/' + type;
      let files = req.files.files;

      // 이미지 있을 경우 업로드 진행, 없을 경우 빈값으로 값 변경
      if (files.length == undefined) {
        //@ todo : sharp 모듈 이용해서 이미지 크기 변경
        fileName = `${md5(files.name + time)}.jpg`;

        await bucket.CreateUploadFile(bucketName, fileName, files.data); // upload file

        imgUrl = `https://kr.object.ncloudstorage.com/${bucketName}/${fileName}`;
        imgSideUrl = '';
      } else {
        if (id == null) {
          url = '';
        } else {
          // 기존 url 파일 링크 확인하기
          url = (await db.raw('SELECT id, imgUrl FROM products WHERE id = ?', [id]))[0][0].imgUrl; // 이미지 에러
        }

        for (let i = 0; i < files.length; i++) {
          fileName = `${md5(files[i].name + time)}.jpg`;
          await bucket.UpdateUploadFile(url, bucketName, fileName, files[i].data); // upload file

          // 다수 이미지 등록을 위해 사용
          if (i == 0) {
            imgUrl = `https://kr.object.ncloudstorage.com/${bucketName}/${fileName}`;
          } else {
            imgSideUrl[`url${i}`] = `https://kr.object.ncloudstorage.com/${bucketName}/${fileName}`;
          }
        }

        imgSideUrl = JSON.stringify(imgSideUrl);
      }

      // 이미지 없을 경우 null 값으로 변경
    } else {
      imgSideUrl = '';
    }

    // SetQuery 만들기
    let setQuery = '';
    let bindList = [];

    setQuery =
      '`status`=?, `imgSideUrl`=?, `price`=?, `discountPrice` = ?, `companyId`=?, `name`=?, `saleType`=?, `content`=?, `option1`=?, `option2`=?, `option3`=?, `option4`=?,`option5`=?, `updDt`=NOW(), `updUser`=?';
    bindList = [status, imgSideUrl, price, discountPrice, companyId, name, saleType, content, option1, option2, option3, option4, option5, req.loginUserID];

    if (imgUrl) {
      setQuery += ',`imgUrl`=? ';
      bindList.push(imgUrl);
    }

    let query = '';

    if (FormMode === Enums.FormMode.UPDATE || id !== null) {
      query = 'UPDATE products SET ' + setQuery + ' , wish = ? WHERE id = ? ';
      bindList.push(wish, id);
    } else {
      query = 'INSERT INTO products SET ' + setQuery + ',`type`=?, `regUser`=?, `regDt`=NOW() ';
      bindList.push(type, req.loginUserID);
    }

    try {
      // 쿼리 실행
      let insert = await db.raw(query, bindList);

      // 사용 로그 추가
      if (FormMode === Enums.FormMode.UPDATE || id !== null) {
        await logModel.postLog('상품/수정', req.loginUserID, await ipModel.ip2long(ip), `상품 수정 / productId : ${id} / productType : ${type} / companyId : ${companyId}`);
      } else {
        await logModel.postLog('상품/등록', req.loginUserID, await ipModel.ip2long(ip), `상품 등록 / productId : ${insert[0].insertId} / productType : ${type} / companyId : ${companyId}`);
      }

      return res.status(200).json({ result: 'OK' });
    } catch (e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다.');
    }
  },

  // DB 테이블에서는 Status = "N" 으로, Ncloud 에서는 이미지 삭제 진행
  async deleteProducts(req, res) {
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;
    const status = req.body.hasOwnProperty('status') ? req.body.status : 'N';
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const arr = [];

    try {
      let deleteImgArr = (await db.raw(`SELECT id, imgUrl, imgSideUrl FROM products WHERE id = ? AND \`status\` in ('Y', 'H')`, [id]))[0];

      // 이미지 확인 후 삭제 진행
      if (deleteImgArr[0].imgUrl != null) {
        if (deleteImgArr[0].imgUrl !== '') {
          arr.push(deleteImgArr[0].imgUrl);
        }

        if (deleteImgArr[0].imgSideUrl !== '') {
          let json = JSON.parse(deleteImgArr[0].imgSideUrl);

          for (let i = 0; i < Object.keys(json).length; i++) {
            values = Object.values(json)[i];
            arr.push(values);
          }
        }

        for (j of arr) {
          await bucket.DeleteFile(j);
        }
      }
    } catch (e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다.');
    }

    try {
      // 쿼리 실행
      await db.raw(`UPDATE products SET \`status\` = ?, imgUrl = "", imgSideUrl = "" WHERE id = ?`, [status, id]);
      await db.raw(`UPDATE dashboard SET \`status\` = ? WHERE productId = ?`, [status, id]);

      // 사용 로그 추가
      await logModel.postLog('상품/삭제', req.loginUserID, await ipModel.ip2long(ip), `상품 삭제 / productId : ${id}`);

      return res.status(200).json({ result: 'OK' });
    } catch (e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다.');
    }
  },

  // 상품 승인하기
  async approvalProduct(req, res) {
    const id = req.params.id ? req.params.id : null;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    let sql = `UPDATE products SET approval = approval ^ 1 WHERE id = ?;`;

    try {
      // 쿼리 실행
      await db.raw(sql, [id]);

      // 사용 로그 추가
      await logModel.postLog('상품/승인', req.loginUserID, await ipModel.ip2long(ip), `상품 승인 / productId : ${id}`);
      return res.status(200).json({ result: 'OK' });
    } catch (e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다.');
    }
  },

  // 상품 댓글 가져오기
  async getComment(req, res) {
    const query = req.query.hasOwnProperty('query') ? req.query.query.trim() : '';
    const pageRows = req.query.hasOwnProperty('pageRows') ? req.query.pageRows.trim() * 1 : 10; // 한 페이지에 출력될 항목 갯수
    const page = req.query.hasOwnProperty('page') ? (req.query.page.trim() - 1) * pageRows : 0;
    const productId = req.query.hasOwnProperty('productId') ? req.query.productId : null;

    let option = req.query.hasOwnProperty('option') ? req.query.option : null;

    // ID값이 혹시 넘어왔는지 체크한다.
    const productPt = req.query.hasOwnProperty('productPt') ? req.query.productPt : null;
    const returnType = productPt == '-1' ? Enums.ListType.ONE : Enums.ListType.LIST;

    // 쿼리문을 작성한다.
    let dbQuery = '';
    let bindingList = []; // 바인딩할 배열

    // 상품 댓글 가져오기
    if (returnType === Enums.ListType.ONE) {
      dbQuery += `SELECT SQL_CALC_FOUND_ROWS C.*, P.name, IFNULL(count.count, 0) AS \`count\`\
      FROM products_post C LEFT JOIN products P ON C.productId = P.id \
        LEFT JOIN (SELECT productPt, COUNT(*) AS \`count\` FROM products_post WHERE productId = ${productId} AND depth != 0 GROUP BY productPt) AS \`count\` ON count.productPt = C.id \
      WHERE C.status = "Y" AND C.productId = ${productId} AND depth = 0 AND (C.comment LIKE "%${query}%" OR \`name\` LIKE "%${query}%" OR C.productId LIKE "%${query}%") `;

      // 최신순
      if (option === 1) {
        dbQuery += `ORDER BY C.regDt DESC LIMIT ${page}, ${pageRows}`;

        // 등록순
      } else if (option === 2) {
        dbQuery += `ORDER BY C.regDt ASC LIMIT ${page}, ${pageRows}`;

        // 도움순
      } else if (option === 3) {
        dbQuery += `ORDER BY \`like\` DESC LIMIT ${page}, ${pageRows}`;
      }

      // 상품 댓글의 답글 가져오기
    } else if (returnType === Enums.ListType.LIST) {
      dbQuery += `SELECT * FROM products_post WHERE productId = ${productId} AND productPt = ${productPt} AND depth != 0`;
    }

    try {
      let result = (await db.raw(dbQuery))[0];

      // Limit을 제외하고 count를 저장할 수 있는 역할
      const totalCountResult = (await db.raw('SELECT FOUND_ROWS() AS cnt'))[0][0].cnt * 1;

      return res.status(200).json({ pageInfo: { page: req.query.page * 1, totalRows: totalCountResult, pageRows: pageRows }, result });
    } catch (e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다');
    }
  },

  // 상품 댓글 생성 및 수정
  async postComment(req, res) {
    const productId = req.body.hasOwnProperty('productId') ? req.body.productId : '';
    const productsPt = req.body.hasOwnProperty('productsPt') ? req.body.productsPt : '';
    const depth = req.body.hasOwnProperty('depth') ? req.body.depth : '';
    const comment = req.body.hasOwnProperty('comment') ? req.body.comment : '';

    // 경로 패러미터에서 사용자 권한 id를 가져온다.
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;

    // id 존재 여부에 따라  INSERT / UPDATE 모드를 결정한다.
    const PostType = id === null ? Enums.FormMode.INSERT : Enums.FormMode.UPDATE;

    if (PostType === 'INSERT') {
      try {
        // 댓글 생성 쿼리 실행
        await db.raw(`INSERT INTO products_post (productId, productPt, depth, \`comment\`, regUser) VALUES (${productId}, ${productsPt}, ${depth}, '${comment}', ${req.loginUserID})`);

        // 댓글 count +1 쿼리 실행
        await db.raw(`UPDATE products SET \`comment\` = \`comment\` + 1 WHERE id = ${productId}`);

        return res.status(200).json({ result: 'OK' });
      } catch (e) {
        return res.status(500).json('데이터베이스 오류가 발생하였습니다');
      }
    } else if (PostType === 'UPDATE') {
      try {
        // 댓글 수정 쿼리 실행
        await db.raw(`UPDATE products_post SET \`comment\` = '${comment}', updUser = ${req.loginUserID} WHERE productId = ${productId} AND productPt = ${productsPt} AND depth = ${depth} AND regUser = ${req.loginUserID} AND id = ${id}`);
        return res.status(200).json({ result: 'OK' });
      } catch (e) {
        return res.status(500).json('데이터베이스 오류가 발생하였습니다');
      }
    }
  },

  // 상품 댓글 삭제, 밴
  async deleteComment(req, res) {
    const id = req.params.hasOwnProperty('id') ? req.params.id : '';
    const productId = req.body.hasOwnProperty('productId') ? req.body.productId : 0;
    const status = req.body.hasOwnProperty('status') ? req.body.status : 'N';

    
    // 쿼리 실행
    try {
      if (status === 'N') {
        // 댓글 삭제 쿼리 실행
        await db.raw(`UPDATE products_post SET \`status\` = '${status}', updUser = ${req.loginUserID} WHERE id = ${id} AND regUser = ${req.loginUserID}`);
      } else if (status === 'B') {
        // 댓글 밴 쿼리 실행
        await db.raw(`UPDATE products_post SET \`status\` = '${status}', updUser = ${req.loginUserID} WHERE id = ${id} AND regUser = ${req.loginUserID}`);
      }

      // 댓글 count -1 쿼리 실행
      await db.raw(`UPDATE products SET \`comment\` = \`comment\` - 1 WHERE id = ${productId}`);
      return res.status(200).json({ result: 'OK' });
    } catch (e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다');
    }
  },

  // 상품 댓글 좋아요, 싫어요 기능
  async postCommentLike(req, res) {
    const status = req.body.hasOwnProperty('status') ? req.body.status : 'D';
    const productPostId = req.body.hasOwnProperty('productPostId') ? req.body.productPostId : 0;
    const userId = req.body.hasOwnProperty('userId') ? req.body.userId : 0;

    try {
      let check = (
        await db.raw(`SELECT id, \`status\` FROM products_post_like WHERE productPostId = ? AND userId = ?`, [productPostId, userId]))[0];

      // 좋아요/싫어요 처음일 경우
      if (check.length === 0) {
        await db.raw(`INSERT INTO \`products_post_like\` (\`status\`, productPostId, userId) VALUES (?, ?, ?)`, [status, productPostId, userId]);
        if (status === 'like') {
          await db.raw(`UPDATE products_post SET \`like\` = \`like\` + 1 WHERE id = ?`, [productPostId]);
        } else if (status === 'dislike') {
          await db.raw(`UPDATE products_post SET \`like\` = \`like\` - 1 WHERE id = ?`, [productPostId]);
        }
      }

      // 좋아요/싫어요 처음이 아닐 경우
      else if (check.length === 1) {
        await db.raw(`UPDATE products_post_like SET \`status\` = ?, updUser = ? WHERE id = ?`, [status, userId, check[0].id]);
        if (check[0].status === 'like' && status === 'N') {
          await db.raw(`UPDATE products_post SET \`like\` = \`like\` - 1 WHERE id = ?`, [productPostId]);
        } else if (check[0].status === 'like' && status === 'disLike') {
          await db.raw(`UPDATE products_post SET \`like\` = \`like\` - 1, dislike = dislike + 1 WHERE id = ?`, [productPostId]);
        } else if (check[0].status === 'N' && status === 'disLike') {
          await db.raw(`UPDATE products_post SET dislike = dislike + 1 WHERE id = ?`, [productPostId]);
        } else if (check[0].status === 'N' && status === 'like') {
          await db.raw(`UPDATE products_post SET \`like\` = \`like\` + 1 WHERE id = ?`, [productPostId]);
        } else if (check[0].status === 'disLike' && status === 'N') {
          await db.raw(`UPDATE products_post SET dislike = dislike - 1 WHERE id = ?`, [productPostId]);
        } else if (check[0].status === 'disLike' && status === 'like') {
          await db.raw(`UPDATE products_post SET \`like\` = \`like\` + 1, dislike = dislike - 1 WHERE id = ?`, [productPostId]);
        }
      }
    } catch (e) {
      return res.status(500).json({ error: '데이터베이스 오류가 발생하였습니다' });
    }
  },

  // 좋아요 유저 가져오기
  async getUserProductsLike(req, res) {
    const pageRows = req.query.hasOwnProperty('pageRows') ? req.query.pageRows.trim() * 1 : 10; // 한 페이지에 출력될 항목 갯수
    const page = req.query.hasOwnProperty('page') ? (req.query.page.trim() - 1) * pageRows : 0;
    const userId = req.params.hasOwnProperty('userId') ? req.params.userId : null;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    try {
      let result = (await db.raw(
        'SELECT SQL_CALC_FOUND_ROWS P.id, userId, productId, products.name, imgUrl, price\
        FROM products_like AS P \
          LEFT JOIN products ON P.productId = products.id \
        WHERE P.status = "Y" AND userId = ? LIMIT ?, ?', [userId, page, pageRows]))[0];

      // Limit을 제외하고 count를 저장할 수 있는 역할
      const totalCountResult = (await db.raw('SELECT FOUND_ROWS() AS cnt'))[0][0].cnt * 1;

      // 사용 로그 추가
      await logModel.postLog('좋아요/조회', userId, await ipModel.ip2long(ip), `회원 좋아요 목록 조회 / userId : ${userId}`);
      return res.status(200).json({ pageInfo: { page: req.query.page * 1, totalRows: totalCountResult }, result }); 
    } catch (e) {
      return res.status(500).json({ error: '데이터베이스 오류가 발생하였습니다' });
    }
  },

  // 좋아요 신규 등록
  async postUserProductsLike(req, res) {
    const productId = req.body.hasOwnProperty('productId') ? req.body.productId : '';
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // 좋아요 생성하기 진행
    try {
      let start = (await db.raw('SELECT id, userId, productId, status FROM products_like WHERE productId = ? AND userId = ?', [productId, req.loginUserID,]))[0][0];
      let result = await db.raw('INSERT INTO products_like SET productId = ?, userId = ? ON DUPLICATE KEY UPDATE status = CASE WHEN status = "Y" THEN "N" ELSE "Y" END, updDt = now();',[productId, req.loginUserID]);

      let end = (
        await db.raw('SELECT id, userId, productId, status FROM products_like WHERE productId = ? AND userId = ?', [productId, req.loginUserID,]))[0][0];

      if ((start == undefined || start.status == 'N') && end.status == 'Y') {
        // 1. products 테이블 wish 칼럼 +1 진행
        await db.raw('UPDATE products SET `like` = `like` + 1 WHERE id = ?', [productId]);
        // 사용 로그 추가
        await logModel.postLog('좋아요/등록', req.loginUserID, await ipModel.ip2long(ip), `좋아요 등록 / productLikeId : ${result[0].insertId}`);
      } else if (start.status == 'Y' && end.status == 'N') {
        // 1. products 테이블 like 칼럼 -1 진행
        await db.raw('UPDATE products SET `like` = `like` - 1 WHERE id = ?', [productId]);
        // 사용 로그 추가
        await logModel.postLog('좋아요/해제', req.loginUserID, await ipModel.ip2long(ip), `좋아요 해제 / productLikeId : ${result[0].insertId}`);
      }

      // 2. products 테이블 wish 불러오기
      let count = (await db.raw('SELECT id, `status`, `like` FROM products WHERE id = ?', [productId]))[0][0];

      // 결과값 출력
      return res.status(200).json({ likeCount: count.like });
    } catch (e) {
      return res.status(500).json({ error: '데이터베이스 오류가 발생하였습니다' });
    }
  },

  // 찜 목록 가져오기
  async GetWish(req, res) {
    // 경로 패러미터에서 사용자 권한 id를 가져온다.
    const id = req.loginUserID;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // 쿼리 실행
    try {
      result = (await db.raw(
          `SELECT P.id AS id, U.nickname, P.type, B.name, P.name, C.companyName, C.logoImg, P.wish, P.like, imgUrl, W.regDt, W.updDt, W.updUser, P.id AS productId, (CASE WHEN PL.id IS NULL THEN 0 ELSE 1 END) AS 'isLike', (CASE WHEN PW.id IS NULL THEN 0 ELSE 1 END) AS 'isWish' 
            FROM products_wish AS W 
                LEFT JOIN users U ON U.id = W.userId
                LEFT JOIN products P ON W.productId = P.id
                LEFT JOIN company C ON P.companyId = C.id 
                LEFT JOIN basecode B ON P.type = B.id
                LEFT JOIN products_wish AS PW ON PW.userId= ? AND PW.productId=P.id AND PW.status = 'Y'
                LEFT JOIN products_like AS PL ON PL.userId= ? AND PL.productId=P.id AND PL.status = 'Y'
            WHERE W.status = "Y" AND W.userId = ? ORDER BY id DESC`, [id, id, id]))[0];

      // 사용 로그 추가
      await logModel.postLog('찜/조회', id, await ipModel.ip2long(ip), `찜 목록 조회 / userId : ${id}`);
      return res.status(200).json({ result });
    } catch (e) {
      return res.status(500).json({ error: '데이터베이스 오류가 발생하였습니다.' });
    }
  },

  // 찜 생성
  async PostWish(req, res) {
    const productId = req.body.hasOwnProperty('productId') ? req.body.productId : '';
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // 찜하기 생성하기 진행
    try {
      // 찜하기 테이블에 insert, update 진행 후 products 테이블 wish 칼럼 +1/-1 진행
      let start = (
        await db.raw('SELECT id, userId, productId, status FROM products_wish WHERE productId = ? AND userId = ?', [productId, req.loginUserID]))[0][0];

      let result = await db.raw('INSERT INTO products_wish SET productId = ?, userId = ? ON DUPLICATE KEY UPDATE status = CASE WHEN status = "Y" THEN "N" ELSE "Y" END, updDt = now()', [productId, req.loginUserID]);

      let end = (await db.raw('SELECT id, userId, productId, status FROM products_wish WHERE productId = ? AND userId = ?', [productId, req.loginUserID,]))[0][0];

      if ((start == undefined || start.status == 'N') && end.status == 'Y') {
        // 1. products 테이블 wish 칼럼 +1 진행
        await db.raw('UPDATE products SET wish = wish + 1 WHERE id = ?', [productId]);
        // 사용 로그 추가
        await logModel.postLog('찜/등록', req.loginUserID, await ipModel.ip2long(ip), `찜 등록 / productWishId : ${result[0].insertId}`);

      } else if (start.status == 'Y' && end.status == 'N') {
        // 1. products 테이블 like 칼럼 -1 진행
        await db.raw('UPDATE products SET `wish` = `wish` - 1 WHERE id = ?', [productId]);
        // 사용 로그 추가
        await logModel.postLog('찜/해제', req.loginUserID, await ipModel.ip2long(ip), `찜 해제 / productWishId : ${result[0].insertId}`);
      }

      // 2. products 테이블 wish 불러오기
      let count = (await db.raw('SELECT id, `status`, `wish` FROM products WHERE id = ?', [productId]))[0][0];

      // 결과값 출력
      return res.status(200).json({ wishCount: count.wish });
    } catch (e) {
      return res.status(500).json({ error: '데이터베이스 오류가 발생하였습니다' });
    }
  },

  async changeStatus(req, res) {
    const userLibrary = require('../Libraries/users.library');
    const isPermission = await userLibrary.isPermission(req.loginUserID, 'PRODUCTS/MODIFY');

    if (!isPermission) {
      return res.status(403).json({ error: '상품 노출상태를 변경할 수 있는 권한이 없습니다.' });
    }

    const productId = req.params.hasOwnProperty('id') ? req.params.id : null;
    const status = req.body.hasOwnProperty('status') ? req.body.status : null;

    if (!productId) {
      return res.status(400).json({ error: '상품 고유번호가 지정되지 않았습니다.' });
    }
    if (!status) {
      return res.status(400).json({ error: '노출 상태가 지정되지 않았습니다.' });
    }

    if (status !== 'Y' && status !== 'H') {
      return res.status(400).json({ error: '노출 상태가 지정되지 않았습니다.' });
    }

    await db('products').where('id', productId).update({
      status: status,
    });

    return res.status(200).json({});
  },
};
