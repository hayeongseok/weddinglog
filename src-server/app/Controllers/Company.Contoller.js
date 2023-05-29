const db = require('../Core/Database.core');
const Enums = require('../Helpers/Enums');
const logModel = require('../Models/log.model');
const ipModel = require('../Models/ip.model');
const bucket = require('../Models/bucket.model');
const AWS = require('aws-sdk');
const config = require('../config');
const endpoint = new AWS.Endpoint('https://kr.object.ncloudstorage.com');
const region = 'kr-standard';
const md5 = require('md5');

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

module.exports = {
  /**
   * 업체 관련 api
   */

  // 업체 목록 및 정보 가져오기
  async GetCompany(req, res) {
    const query = req.query.hasOwnProperty('query') ? req.query.query.trim() : '';
    const pageRows = req.query.hasOwnProperty('pageRows') ? req.query.pageRows.trim() * 1 : 10; // 한 페이지에 출력될 항목 갯수
    const page = req.query.hasOwnProperty('page') ? (req.query.page.trim() - 1) * pageRows : 0;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    let type = req.query.hasOwnProperty('type') ? req.query.type : [18, 19, 20, 21, 22];
    for (let i in type) {
      type[i] = JSON.stringify(type[i]);
    }

    let status = req.query.hasOwnProperty('status') ? req.query.status : ['Y', 'N'];
    for (let i in status) {
      status[i] = JSON.stringify(status[i]);
    }

    // ID값이 혹시 넘어왔는지 체크한다.
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;
    const returnType = id === null ? Enums.ListType.LIST : Enums.ListType.ONE;

    // 쿼리문을 작성한다.
    let dbQuery = '';
    let bindingList = []; // 바인딩할 배열

    dbQuery += 'SELECT SQL_CALC_FOUND_ROWS C.id, C.status, basecode.id AS typeId, basecode.name AS type, companyName, nickname, C.phone, zipCode, address1, address2, C.like, C.rating, C.`status`, logoImg ';
    dbQuery += 'FROM company AS C LEFT JOIN users ON users.companyId = C.id LEFT JOIN basecode ON C.type = basecode.id ';
    dbQuery += 'WHERE 1 ';

    // 업체 정보 가져오기
    if (returnType === Enums.ListType.ONE) {
      dbQuery += 'AND C.id = ? ';
      bindingList.push(id);

      // 조건 및 필터에 따른 WHERE 절 추가
    } else {
      if (type.length > 0) {
        dbQuery += `AND C.type IN (${type}) `;
      }

      if (status.length > 0) {
        dbQuery += `AND C.status IN (${status}) `;
      }

      if (query.length > 0) {
        dbQuery += `AND (C.id LIKE ? OR companyName LIKE ? OR C.phone LIKE ? OR zipCode LIKE ? OR address1 LIKE ? OR address2 LIKE ? OR C.status LIKE ?) ` 
        bindingList.push('%' + query + '%', '%' + query + '%', '%' + query + '%', '%' + query + '%', '%' + query + '%', '%' + query + '%', '%' + query + '%');
      }

      dbQuery += 'ORDER BY companyName ASC ';

      if (pageRows > 0) {
        dbQuery += 'LIMIT ?, ? ';
        bindingList.push(page, pageRows);
      }
    }

    // 쿼리 실행
    try {
      let result = [];
      result = (await db.raw(dbQuery, bindingList))[0];

      // Limit을 제외하고 count를 저장할 수 있는 역할
      const totalCountResult = (await db.raw('SELECT FOUND_ROWS() AS cnt'))[0][0].cnt * 1;

      // 사용 로그 추가
      if(id === null) {
        await logModel.postLog('업체/조회', req.loginUserID, await ipModel.ip2long(ip), `업체 리스트 조회`);
      } else if (id > 0){
        await logModel.postLog('업체/조회', req.loginUserID, await ipModel.ip2long(ip), `업체 조회 / compnanyId : ${id}`);
      }
      
      return res.status(200).json(db.getReturnObject(returnType, result, totalCountResult));
    } catch (e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다');
    }
  },

  // 업체 등록 및 수정하기
  async PostCompany(req, res) {
    const address1 = req.body.hasOwnProperty('address1') ? req.body.address1.trim() : '';
    const address2 = req.body.hasOwnProperty('address2') ? req.body.address2.trim() : '';
    const zipCode = req.body.hasOwnProperty('zipCode') ? req.body.zipCode : '';
    const companyName = req.body.hasOwnProperty('companyName') ? req.body.companyName.trim() : '';
    const phone = req.body.hasOwnProperty('phone') ? req.body.phone.trim() : '';
    const status = req.body.hasOwnProperty('status') ? req.body.status.trim() : 'Y';
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const type = req.body.hasOwnProperty('type') ? req.body.type : '';

    let logoImg = '';
    let bucketName = '';
    let url = '';

    // ID값이 혹시 넘어왔는지 체크한다.
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;
    const FormMode = id === null ? Enums.FormMode.INSERT : Enums.FormMode.UPDATE;

      // 등록 하기
      if(FormMode == Enums.FormMode.INSERT || id == null) {
        // 파일 업로드 진행
          if (req.files !== null && req.files !== undefined) {
          let bucketName = config.s3.uploadBucketName + 'company/' + companyName;
          let files = req.files.file;
          let fileName = `${md5(files.name + time)}.jpg`
        
          await bucket.CreateUploadFile(bucketName, fileName, files.data); // upload file
          logoImg = `https://kr.object.ncloudstorage.com/${bucketName}/${fileName}`; // 이미지 url
        }

        try {
          // 쿼리 실행
          let insert = await db.raw(
            `INSERT INTO company (companyName, status, type, phone, zipCode, address1, address2, logoImg, regUser) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [companyName, status, type, phone, zipCode, address1, address2, logoImg, req.loginUserID]
          );
  
          // 사용 로그 추가
          await logModel.postLog('업체/등록', req.loginUserID, await ipModel.ip2long(ip), `업체 등록 / compnanyId : ${insert[0].insertId} / companyName : ${companyName}`);
          return res.status(200).json({ result: 'OK' });
        } catch (e) {
          return res.status(500).json('데이터베이스 오류가 발생하였습니다.');
        }
      } 
      
      // 수정하기
      if (FormMode == Enums.FormMode.UPDATE || id !== null) {
        // 기존 url 파일 링크 확인하기
        if (id !== null) {
          url = (await db.raw('SELECT id, logoImg FROM company WHERE id = ?', [id]))[0][0].logoImg; // 이미지 에러
        } else {
          url = '';
        }

        
 
        // 파일 업로드 진행
        if (req.files !== null && req.files !== undefined) {
          let bucketName = config.s3.uploadBucketName + 'company/' + companyName;
          let files = req.files.file;
          let fileName = `${md5(files.name + time)}.jpg`

          // upload file
          await bucket.UpdateUploadFile(url, bucketName, fileName, files.data); // upload file
          logoImg = `https://kr.object.ncloudstorage.com/${bucketName}/${fileName}`; // 이미지 url
        }

        try {
          await db.raw(
            `UPDATE company SET companyName = ?, phone = ?, zipCode = ?, address1 = ?, address2 = ?, \`status\` = ?, \`type\` = ?, logoImg = ?, updUser = ? WHERE id = ?`,
            [companyName, phone, zipCode, address1, address2, status, type, logoImg, req.loginUserID, id]
          );

          // 사용 로그 추가
          await logModel.postLog('업체/수정', req.loginUserID, await ipModel.ip2long(ip), `업체 수정 / compnanyId : ${id} / companyName : ${companyName}`);
          return res.status(200).json({ result: 'OK' });
        } catch (e) {
          return res.status(500).json('데이터베이스 오류가 발생하였습니다.');
        }
      }      
  },

  // 업체 삭제
  async DeleteCompany(req, res) {
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    try {
      // 로고 이미지 여부 확인
      let url = (await db.raw('SELECT id, logoImg FROM company WHERE id = ?', [id]))[0][0];
      
      // 로고 이미지 있으면 ncloud 삭제 진행
      if (url.logoImg !== '') {
        url = url.logoImg;
        bucket.DeleteFile(url);
      }
      
      // 쿼리 실행
      await db.raw('UPDATE company SET logoImg = "", `status` = "N" WHERE id = ?', [id]);

      // 사용 로그 추가
      await logModel.postLog('업체/삭제', req.loginUserID, await ipModel.ip2long(ip), `업체 삭제 / compnanyId : ${id}`);
      return res.status(200).json({ result: 'OK' });
    } catch (e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다.');
    }
  },
};
