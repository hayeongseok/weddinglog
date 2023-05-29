const db = require('../Core/Database.core');

module.exports = {
  /**
   * 특정 문자열을 특정 필드에서 검색하여 사용자 정보를 리턴합니다.
   * @param {string||number} value 검색할 문자열
   * @param {string} column   검색할 필드
   * @returns {object||null} 유저 정보
   * @constructor
   */
  async GetUser(value, column = 'loginId') {
    let user = null;

    await db
      .select('*')
      .from('users')
      .where(column, value)
      .limit(1)
      .then((rows) => {
        user = rows.length > 0 ? rows[0] : null;
      })
      .catch(() => {
        user = null;
      });

    return user;
  },

  /**
   * 사용자 정보를 DB에 추가한다.
   * @param user
   * @returns {Promise<{status: boolean}>}
   * @constructor
   */
  async AddUser(user) {
    let result = {
      status: true,
    };
    user.regDt = new Date().dateFormat('yyyy-MM-dd HH:mm:ss');

    try {
      await db('users')
        .insert(user)
        .then((res) => {
          result.id = res[0];
        });
    } catch (err) {
      console.log(err);
      result.status = false;
      result.error = '데이타 베이스 오류가 발생하였습니다';
    }

    return result;
  },

  async GetPermission(id) {
    let result = (
      await db.raw(
        '\
            SELECT ATH.*, CASE WHEN UA.userId IS NOT NULL THEN "Y" ELSE "N" END AS isAuth\
            FROM authorize AS ATH\
            LEFT JOIN users_authorize AS UA ON UA.userId = "' +
          id +
          '" AND ATH.key = UA.authKey ORDER BY sort ASC'
      )
    )[0];

    return result;
  },
};
