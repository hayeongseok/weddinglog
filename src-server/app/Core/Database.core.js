const config = require('../config')
const Enums = require('../Helpers/Enums')
// require('dotenv').config();
// require("dotenv").config({ path: "./" })

// console.log(process.env.DB_HOST);


// console.log("DB_node:", process.env.NODE_ENV);
// console.log("DB_HOST:", process.env.DB_HOST);
// console.log("DB_USER:", process.env.DB_USER);
// console.log("DB_PASS:", process.env.DB_PASS);

const knex = require('knex')({
    client: 'mysql2',
    connection: {
        host: config.database.host,
        user: config.database.user,
        password: config.database.pass,
        database: config.database.db,
        port: config.database.port
        // host:process.env.DB_HOST,
        // user: process.env.DB_USER,
        // password: process.env.DB_PASS,
        // database: process.env.DB_DB,
        // port: process.env.DB_PORT
    }
})

/**
 * 마지막 실행한 SQL_CALC_FOUND_ROWS 의 행수를 계산하여 행 개수를 반환한다.
 * @returns {Promise<number>}
 */
knex.getFoundRows = async () => {
    let returnValue = 0

    try {
        let t = await this.db.raw('SELECT FOUND_ROWS() AS cnt')
        returnValue = t.length > 0 && t[0].length > 0 ? t[0][0]["cnt"] * 1 : 0

    }
    catch {
        returnValue = 0
    }

    return returnValue
}

/**
 * 쿼리 결과 리스트를 리스트/1행반환 여부에 따라 반환하기 좋은 형태로 변환한다.
 * @param isList 리스트반환인지/1행 반환이지 여부
 * @param result 쿼리결과 목록
 * @param totalRows 총행수 (optional)
 * @returns {*}
 */
knex.getReturnObject = (isList = Enums.ListType.LIST, result = [], totalRows = 0 ) => {
    let returnObject = {}

    if(isList === Enums.ListType.LIST) {
        // 리스트일경우, PageInfo 와 리스트 데이타를 함께 넘겨준다.
        returnObject = {
            result: result,
            pageInfo: {
                totalRows: totalRows
            }
        }
    }
    else {
        // 한행만 반환일경우 리턴 데이타 자체를 한행의 데이타로 채운다.
        returnObject = result.length > 0 ? result[0] : {}
    }

    return returnObject
}

module.exports = knex