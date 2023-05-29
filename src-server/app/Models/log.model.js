const db = require('../Core/Database.core');
const ipModel = require('../Models/ip.model')

/**
 * 로그 관련
 */
module.exports = {
  // 사용 로그
  async postLog(log_type, user_id, ip, ip_description) {
    try {
      await db.raw(`INSERT INTO \`logs\` (log_type, user_id, ip, ip_description) VALUES (?,?,?,?)`, [log_type, user_id, ip, ip_description]);
    } catch (e) {
      return '데이터베이스 오류가 발생하였습니다';
    }
  }
};
