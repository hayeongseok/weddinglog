const db = require('../Core/Database.core');
const Enums = require('../Helpers/Enums');

/**
 * 맞춤추천 관련 API
 */
module.exports = {
  // 맞춤 추천 목록 및 정보 가져오기
  async GetCustomized(req, res) {
    const query = req.query.hasOwnProperty('query') ? req.query.query.trim() : '',
      pageRows = req.query.hasOwnProperty('pageRows') ? req.query.pageRows.trim() * 1 : 10, // 한 페이지에 출력될 항목 갯수
      page = req.query.hasOwnProperty('page') ? (req.query.page.trim() - 1) * pageRows : 0;

    // 경로 패러미터에서 사용자 권한 id를 가져온다.
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;
    const returnType = id === null ? Enums.ListType.LIST : Enums.ListType.ONE;

    // 쿼리문을 작성한다.
    let dbQuery = '';
    let bindingList = []; // 바인딩할 배열

    dbQuery += 'SELECT * FROM customized ';

    // 상품 정보 가져오기
    if (returnType === Enums.ListType.ONE) {
      dbQuery += 'WHERE id = ?';
      bindingList.push(id);
      // 조건 및 필터에 따른 WHERE 절 추가
    } else {
      dbQuery += 'WHERE CONCAT(id, contents, `name`, phone) REGEXP ? ORDER BY id DESC LIMIT ?, ?';
      bindingList.push(query, page, pageRows);
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

  // 맞춤 추천 생성 및 수정하기
  async PostCustomized(req, res) {
    const status = req.body.hasOwnProperty('status') ? req.body.status.trim() : '',
      name = req.body.hasOwnProperty('name') ? req.body.name.trim() : '',
      phone = req.body.hasOwnProperty('phone') ? req.body.phone.trim() : '',
      dDay = req.body.hasOwnProperty('dDay') ? req.body.dDay : '',
      contents = req.body.hasOwnProperty('contents') ? req.body.contents : '',
      note = req.body.hasOwnProperty('note') ? req.body.note.trim() : '';

    let result = '';

    // 경로 패러미터에서 사용자 권한 id를 가져온다.
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;

    // id 존재 여부에 따라  INSERT / UPDATE 모드를 결정한다.
    const PostType = id === null ? Enums.FormMode.INSERT : Enums.FormMode.UPDATE;

    // 맞춤 추천 생성하기 진행
    if (PostType === 'INSERT') {
      // customized 테이블 insert 쿼리 실행
      try {
        result = (await db.raw('INSERT INTO customized (`status`, userId, `name`, dDay, phone, contents, note) VALUES (?, ?, ?, ?, ?, ?, ?)', [status, req.loginUserID, name, dDay, phone, JSON.stringify(contents), note]))[0].insertId;
      } catch (e) {
        return res.status(500).json('데이터베이스 오류가 발생하였습니다');
      }

      // 쿼리문을 작성한다.
      let dbQuery = '';
      let bindingList = []; // 바인딩할 배열

      for (let i in contents) {
        // 배열의 length 값이 1일 경우
        if (contents.length == 1) {
          dbQuery += 'INSERT INTO customized_contents (id, contents) VALUES (?, ?);';
          bindingList.push(result, Object.values(contents[i])[0]);
        } else if (i == contents.length - 1) {
          dbQuery += '(?, ?);';
          bindingList.push(result, Object.values(contents[i])[0]);
        } else if (i * 1 >= 1) {
          dbQuery += '(?, ?), ';
          bindingList.push(result, Object.values(contents[i])[0]);
        } else {
          dbQuery += 'INSERT INTO customized_contents (id, contents) VALUES (?, ?), ';
          bindingList.push(result, Object.values(contents[i])[0]);
        }
      }

      // customized_contents 테이블 insert 쿼리 실행
      try {
        await db.raw(dbQuery, bindingList);
        return res.status(200).json({ result: 'OK' });
      } catch (e) {
        return res.status(500).json('데이터베이스 오류가 발생하였습니다');
      }

      // 맞춤 추천 수정하기 진행
    } else if (PostType === 'UPDATE') {
      // customized 테이블 update 쿼리 실행
      try {
        await db.raw('UPDATE customized SET `status` = ?, userId = ?, `name` = ?, dDay = ?, phone = ?, contents = ?, note = ? WHERE id = ?', [status, req.loginUserID, name, dDay, phone, JSON.stringify(contents), note, id]);
      } catch (e) {
        return res.status(500).json('데이터베이스 오류가 발생하였습니다');
      }

      // customized_contents 테이블 delete 쿼리로 삭제 후 insert 진행
      try {
        await db.raw('DELETE FROM customized_contents WHERE id = ?', [id]);

        // 쿼리문을 작성한다.
        let dbQuery = '';
        let bindingList = []; // 바인딩할 배열

        for (let j in contents) {
          // 배열의 length 값이 1일 경우
          if (contents.length == 1) {
            dbQuery += 'INSERT INTO customized_contents (id, contents) VALUES (?, ?);';
            bindingList.push(id, Object.values(contents[j])[0]);
          } else if (j == contents.length - 1) {
            dbQuery += '(?, ?);';
            bindingList.push(id, Object.values(contents[j])[0]);
          } else if (j * 1 >= 1) {
            dbQuery += '(?, ?), ';
            bindingList.push(id, Object.values(contents[j])[0]);
          } else {
            dbQuery += 'INSERT INTO customized_contents (id, contents) VALUES (?, ?), ';
            bindingList.push(id, Object.values(contents[j])[0]);
          }
        }

        // 쿼리 실행
        await db.raw(dbQuery, bindingList);
        return res.status(200).json({ result: 'OK' });
      } catch (e) {
        return res.status(500).json('데이터베이스 오류가 발생하였습니다');
      }
    }
  },

  // 맞춤 추천 삭제하기
  async DeleteCustomized(req, res) {
    const status = req.body.hasOwnProperty('status') ? req.body.status.trim() : '',
      id = req.params.hasOwnProperty('id') ? req.params.id : null;

    try {
      await db.raw('UPDATE customized SET `status` = ? WHERE id = ?', [status, id]);
      return res.status(200).json({ result: 'OK' });
    } catch (e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다');
    }
  },
};
