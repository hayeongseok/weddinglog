const db = require('../Core/Database.core');
const Enums = require('../Helpers/Enums');

/**
 * checklist 관련 API
 */

module.exports = {
  async GetChecklist(req, res) {
    // 경로 패러미터에서 사용자 권한 id를 가져온다.
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;
    const returnType = id === null ? Enums.ListType.LIST : Enums.ListType.ONE;

    // 쿼리문을 작성한다.
    let dbQuery = '';
    let bindingList = []; // 바인딩할 배열

    dbQuery += 'SELECT SQL_CALC_FOUND_ROWS id, dDay, `list`, regDt FROM wedding_checklist ';

    // 상품 정보 가져오기
    if (returnType === Enums.ListType.ONE) {
      dbQuery += "WHERE id = ? AND status = 'Y'";
      bindingList.push(id);
      // 조건 및 필터에 따른 WHERE 절 추가
    } else {
      dbQuery += "WHERE `status` = 'Y'";
    }

    // 쿼리 실행
    try {
      let result = [];
      result = (await db.raw(dbQuery, bindingList))[0];

      // Limit을 제외하고 count를 저장할 수 있는 역할
      const totalCountResult = (await db.raw('SELECT FOUND_ROWS() AS cnt'))[0][0].cnt * 1;

      return res.status(200).json({ pageInfo: { page: req.query.page * 1, totalRows: totalCountResult }, result });
    } catch (e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다');
    }
  },

  // checklist 생성 및 수정하기
  async PostChecklist(req, res) {
    const dDay = req.body.hasOwnProperty('dDay') ? req.body.dDay : '';
    const status = req.body.hasOwnProperty('status') ? req.body.status : '';
    const list = req.body.hasOwnProperty('list') ? req.body.list : '';

    // 경로 패러미터에서 사용자 권한 id를 가져온다.
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;

    // id 존재 여부에 따라  INSERT / UPDATE 모드를 결정한다.
    const PostType = id === null ? Enums.FormMode.INSERT : Enums.FormMode.UPDATE;

    // checklist 생성하기 진행
    if (PostType === 'INSERT') {
      try {
        // wedding_checklist 테이블 insert 쿼리 실행
        await db.raw('INSERT INTO wedding_checklist (`status`,dDay, list) VALUES (?, ?, ?)', [status, dDay, list]);
        return res.status(200).json({ result: 'OK' });
      } catch (e) {
        return res.status(500).json('데이터베이스 오류가 발생하였습니다');
      }

      // checklist 수정하기 진행
    } else if (PostType === 'UPDATE') {
      try {
        // dashboard 테이블 update 쿼리 실행
        await db.raw('UPDATE wedding_checklist SET `status` = ?, dDay = ?, list = ?, updUser = ? WHERE id = ?', [status, dDay, list, req.loginUserID, id]);
        return res.status(200).json({ result: 'OK' });
      } catch (e) {
        return res.status(500).json('데이터베이스 오류가 발생하였습니다');
      }
    }
  },

  // checklist 삭제하기
  async DeleteChecklist(req, res) {
    const status = req.body.hasOwnProperty('status') ? req.body.status.trim() : '';
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;

    try {
      // 쿼리 실행
      await db.raw('UPDATE wedding_checklist SET `status` = ? WHERE id = ?', [status, id]);
      return res.status(200).json({ result: 'OK' });
    } catch (e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다');
    }
  },
};
