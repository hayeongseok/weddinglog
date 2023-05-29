const db = require('../Core/Database.core');
const UserModel = require('../Models/users.model');

module.exports = {
  /**
   * 사용자 권한 가져오기
   */
  async GetUserPermission(req, res) {
    try {
      // 경로 패러미터에서 사용자 권한 id를 가져온다.
      let id = req.query.hasOwnProperty('id') ? req.query.id : null;
      let isAdmin = req.query.hasOwnProperty('isAdmin') ? req.query.isAdmin : null;

      let result = await UserModel.GetPermission(id);

      if (!isAdmin || isAdmin === 'N') {
        const permission = result;
        result = {};

        for (let i in permission) {
          result[permission[i].key] = permission[i].isAuth === 'Y';
        }
      }

      // 쿼리 진행한다.
      /*
            let result = (await db.raw('\
            SELECT ATH.*, CASE WHEN UA.userId IS NOT NULL THEN "Y" ELSE "N" END AS isAuth\
            FROM authorize AS ATH\
            LEFT JOIN users_authorize AS UA ON UA.userId = ' + id +' AND ATH.key = UA.authKey'))[0]
            */

      res.status(200).json({ result });
    } catch (e) {
      console.log(e);
      res.status(500).json('데이터베이스 오류가 발생하였습니다');
    }
  },

  /**
   * 사용자 권한 설정하기
   */
  async PostUserPermission(req, res) {
    const userId = req.body.hasOwnProperty('userId') ? req.body.userId : '';
    const key = req.body.hasOwnProperty('key') ? req.body.key : '';

    try {
      // 쿼리 실행
      await db.raw('INSERT INTO users_authorize VALUES (?,?)', [userId, key]);
      res.status(200).json({ result: 'OK' });
    } catch (e) {
      res.status(500).json({ error: '데이터베이스 오류가 발생하였습니다' });
    }
  },

  /**
   * 사용자 권한 삭제하기
   */
  async DeleteUserPermission(req, res) {
    const id = req.body.hasOwnProperty('userId') ? req.body.userId : '';
    const authKay = req.body.hasOwnProperty('authKey') ? req.body.authKey : '';
    
    try {
      // 쿼리 실행
      await db.raw('DELETE FROM users_authorize WHERE userId = ? AND authKey = ?', [id, authKay]);
      res.status(200).json({ result: 'OK' });
    } catch (e) {
      res.status(500).json({ error: '데이터베이스 오류가 발생하였습니다' });
    }
  },

  /**
   * 사용자 권한 체크 미들웨어
   */
  /*관리자인지 아닌지 권한이 있는지 없는지 확인*/
  async ChackUserPermission(req, res, next) {
    // 관리자인지 아닌지 확인
    try {
      let result = await UserModel.GetPermission(req.loginUserID);
      let method;

      if (req.method === 'GET') {
        if (req.route.path === '/') {
          method = 'LIST_ALL';
        } else {
          method = 'LIST';
        }
      } else if (req.method === 'POST') {
        method = 'MODIFY';
      } else if (req.method === 'DELETE') {
        method = 'REMOVE';
      }

      // 관리자일 경우
      if (result[0].key === 'MASTER' && result[0].isAuth === 'Y') {
        return next();

        // 관리자가 아닐 경우
      } else {
        for (let i in result) {
          // 권한이 있을 경우
          if (
            req.baseUrl.substr(4, req.baseUrl.length).toUpperCase() + '/' + method === result[i].key &&
            result[i].isAuth === 'Y'
          ) {
            return next();
          }
        }

        // 권한이 없을 경우
        return res.status(403).json({ error: '권한이 없습니다.' });
      }
    } catch (e) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
  },
};
