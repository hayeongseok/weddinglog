const db = require('../Core/Database.core');
const Enums = require('../Helpers/Enums');
const userModel = require('../Models/users.model');
const bucket = require('../Models/bucket.model');
const config = require('../config');
const md5 = require('md5');
const time = Math.floor(new Date().getTime() / 1000);

/**
 * 사용자 관련 API 사용 권한을 확인한다.
 */
const CheckBasecodeAuthorize = async (req) => {
  let returnAuth = {
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

  returnAuth.INSERT = isMaster;
  returnAuth.UPDATE = isMaster;
  returnAuth.DELETE = isMaster;

  // @todo: 3. 해당게시판 관리자 여부를 체크, 게시판 관리자는 게시글/댓글의 수정/삭제만 처리할수 있는 권한이다.
  return returnAuth;
};

module.exports = {
  async ChangeSort(req, res) {
    const table = req.body.hasOwnProperty('table') ? req.body.table : null;
    const pkColumn = req.body.hasOwnProperty('pkColumn') ? req.body.pkColumn : 'id';
    const sortColumn = req.body.hasOwnProperty('sortColumn') ? req.body.sortColumn : 'sort';
    const sortData = req.body.hasOwnProperty('sortData') ? req.body.sortData : [];

    if (!table) {
      return res.status(400).json({ error: '잘못된 접근입니다.' });
    }

    if (sortData.length === 0) {
      return res.json({});
    }

    for (let i in sortData) {
      await db.raw(`UPDATE ${table} SET \`${sortColumn}\`=${sortData[i][sortColumn]} WHERE \`${pkColumn}\`='${sortData[i][pkColumn]}'`);
    }
    return res.json({});
  },

  /**
   * 기초코드 목록 가져오기
   */
  async GetBaseCode(req, res) {
    // 경로 패러미터에서 기초코드 구분을 가져온다.
    const type = req.params.hasOwnProperty('type') ? req.params.type : null;
    const ext1 = req.query.hasOwnProperty('ext1') ? req.query.ext1 : null;

    // type 이 제대로 선언되지 않은경우
    if (type === null) {
      return res.status(400).json({ error: '잘못된 접근입니다' });
    }

    // ID값이 혹시 넘어왔는지 체크한다.
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;
    const returnType = id === null ? Enums.ListType.LIST : Enums.ListType.ONE;

    // 필터용 패러미터 받아오기
    const searchQuery = req.query.hasOwnProperty('query') ? req.query.query : '';

    // 쿼리문을 작성한다.
    let query = '';
    let bindingList = []; // 바인딩할 배열

    query += ' SELECT SQL_CALC_FOUND_ROWS B.*, U1.nickname AS regUserName, U2.nickname AS updUserName ';
    query += ' FROM basecode AS B ';
    query += ' LEFT JOIN users AS U1 ON U1.id = B.regUser ';
    query += ' LEFT JOIN users AS U2 ON U2.id = B.updUser ';
    query += ' WHERE 1 ';

    if (ext1) {
      query += ' AND `ext1` = ? ';
      bindingList.push(ext1);
    }

    // 기본 WHERE 조건 추가
    query += " AND B.`status` = 'Y' ";
    query += ' AND B.`key` = ? ';
    bindingList.push(type);

    // 조건 및 필터에 따른 WHERE 절 추가
    if (returnType === Enums.ListType.ONE) { 
      query += ' AND B.`id` = ?';
      bindingList.push(id);
    }
    if (searchQuery.length > 0) {
      query += ' AND B.`name` LIKE "%?%" ';
      bindingList.push(searchQuery);
    }

    // 정렬
    query += ' ORDER BY `sort` ASC';

    // ID 값이 넘어온 경우 Limit 1
    if (returnType === Enums.ListType.ONE) query += ' LIMIT 1 ';

    let result = [];
    let totalRows = 0;

    // 쿼리 실행
    try {
      result = await db.raw(query, bindingList);
      result = result[0];
    } catch {
      result = [];
    }

    // 총 Rows 가져오기
    if (returnType === Enums.ListType.LIST) {
      totalRows = await db.getFoundRows();
    }

    // 리턴 데이타를 만든다
    let returnObject = db.getReturnObject(returnType, result, totalRows);
    return res.status(200).json(returnObject);
  },

  /**
   * 기초코드 상품 등록 전용 목록 가져오기
   */
  async GetProductBaseCode(req, res) {
    // 필터용 패러미터 받아오기
    const searchQuery = req.query.hasOwnProperty('query') ? req.query.query : '';

    try {
      // 쿼리 실행
      let result = (await db.raw(`SELECT id, \`key\`, \`status\`, \`name\` FROM basecode WHERE \`key\` LIKE "${searchQuery}%" ORDER BY sort ASC`))[0];
      return res.status(200).json({ result });
    } catch (e) {
      return res.status(500).json({ error: '데이터베이스 오류가 발생하였습니다' });
    }
  },

  /**
   * 기초코드 등록/수정하기
   */
  async PostBaseCode(req, res) {
    // 경로 패러미터에서 기초코드 구분을 가져온다.
    const type = req.params.hasOwnProperty('type') ? req.params.type : '';
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;
    const status = req.body.hasOwnProperty('status') ? req.body.status : 'Y';
    const name = req.body.hasOwnProperty('name') ? req.body.name.trim() : '';
    const sort = req.body.hasOwnProperty('sort') ? req.body.sort : '';
    let imgUrl = '';
    let bucketName = config.s3.uploadBucketName + 'basecode';

    // type 이 제대로 선언되지 않은경우
    if (type === null) {
      return res.status(400).json({ error: '잘못된 접근입니다' });
    }

    // 넘어온 id가 없다면
    if (!id) {
      // 기초코드 정보 신규 등록하기 진행
      try {
        // 이미지 있을 경우 업로드 진행, 없을 경우 빈값으로 값 변경
        if (req.files !== null && req.files !== undefined) {
          let files = req.files.files;
          fileName = `${md5(files.name + time)}.jpg`

          if (files.length == undefined) {
            //@ todo : sharp 모듈 이용해서 이미지 크기 변경

            bucket.CreateUploadFile(bucketName, fileName, files.data); // upload file
            imgUrl = `https://kr.object.ncloudstorage.com/${bucketName}/${fileName}`;
          }
        } else {
          imgUrl = '';
        }

        await db.raw('INSERT INTO basecode (`key`, `status`, `name`, sort, regUser, icon) VALUES (?,?,?,?,?,?)', [type, status, name, sort, req.loginUserID, imgUrl]);

        return res.status(200).json({ result: 'OK' });
      } catch (e) {
        return res.status(500).json({ error: '데이터베이스 오류가 발생하였습니다' });
      }
    }

    // 기초코드 수정하기
    // 쿼리 실행
    try {
      // 이미지 업로드 여부 확인을 위해 SELECT 쿼리 실행
      let result = (await db.raw('SELECT id, icon FROM basecode WHERE id = ?', [id]))[0][0];

      if (req.files !== null && req.files !== undefined) {
        let files = req.files.files;
        fileName = `${md5(files.name + time)}.jpg`

        if (files.length == undefined) {
          if (result.icon === '') {
            bucket.CreateUploadFile(bucketName, files.name, files.data); // upload file
            imgUrl = `https://kr.object.ncloudstorage.com/${bucketName}/${fileName}`;
          } else {
            // 이미지 있을 경우 업로드 진행, 없을 경우 빈값으로 값 변경
            bucket.UpdateUploadFile(result.icon, bucketName, files.name, files.data); // upload file
            imgUrl = `https://kr.object.ncloudstorage.com/${bucketName}/${fileName}`;
          }
        }
      } else {
        imgUrl = '';
      }

      await db.raw(
        'UPDATE basecode SET `key` = ?, `status` = ?, `name` = ?, updUser = ?, sort = ?, icon = ? WHERE id = ?',
        [type, status, name, req.loginUserID, sort, imgUrl, id]
      );

      return res.status(200).json({ result: 'OK' });
    } catch (e) {
      return res.status(500).json({ error: '데이터베이스 오류가 발생하였습니다' });
    }
  },

  /**
   * 기초코드 삭제하기 
   */
  async DeleteBaseCode(req, res) {
    // 경로 패러미터에서 기초코드 구분을 가져온다.
    const type = req.params.hasOwnProperty('type') ? req.params.type : null;
    let url = '';

    // type 이 제대로 선언되지 않은경우
    if (type === null) {
      return res.status(400).json({ error: '잘못된 접근입니다' });
    }

    // ID값이 혹시 넘어왔는지 체크한다.
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;
    if (id === null) {
      return res.status(400).json({
        error: '존재하지 않는 기초코드이거나, 이미 삭제된 기초코드 입니다.',
      });
    }

    // 기초코드 icon 이미지 여부 확인
    try {
      let icon = (await db.raw('SELECT id, icon FROM basecode WHERE id = ?', [id]))[0][0]

      // icon 이미지 있으면 ncloud 삭제 진행
      if (icon.icon !== '') {
        url = icon.icon;
        bucket.DeleteFile(url);
      }

    } catch(e) {
      return res.status(500).json({ error: '데이터베이스 오류가 발생하였습니다' });
    }

    // 쿼리 실행
    try {
      await db('basecode')
        .where('id', id)
        .update({ status: 'N' })
        .then(() => {});

      return res.status(200).json({});
    } catch (e){
      return res.status(500).json({ error: '데이터베이스 오류가 발생하였습니다' });
    }
  },
};
