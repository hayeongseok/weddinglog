const db    = require('../Core/Database.core')
const Enums = require("../Helpers/Enums");
/*
 *---------------------------------------------------------------
 * 게시판용 모델
 *---------------------------------------------------------------
 *
 * GetBoard ( key , listType, params )      게시판의 목록 또는 한행을 가져온다.
 * DeleteBoard (key, loginUserId)           게시판을 삭제한다.
 * GetBoardCategory (key )                  게시판의 카테고리 목록을 가져온다
 */
module.exports = {

    /**
     * 게시판의 목록/한행 을 가져온다.
     */
    async GetBoard (key, listType = Enums.ListType.LIST,   params = {}) {
        // undefined 를 위한 처리
        params.page = typeof params.page !== 'undefined' && params.page >0 ? params.page: 1
        params.pageRows = typeof params.pageRows !== 'undefined' && params.pageRows > 0 ? params.pageRows: 10

        // 페이징 처리르 위한 값이 잘못넘어왔을 경우 처리
        const offset = (params.page - 1) * params.pageRows

        // 검색필터를 위한 쿼리값 가져오기
        params.query = typeof params.query !== 'undefined' && params ? params : ''

        // 쿼리문 작성시작
        let bindList = [];
        let query = "";
        query += " SELECT SQL_CALC_FOUND_ROWS B.*, U1.`nickname` AS regUserName, U2.`nickname` AS updUserName "
        query += " FROM board AS B "
        query += " LEFT JOIN users AS U1 ON U1.id=B.regUser "
        query += " LEFT JOIN users AS U2 ON U2.id=B.updUser "
        query += " WHERE 1 "

        // 검색어가 있을경우 WHERE절 추가
        if(params.query.length > 0) {
            query += " AND  B.`title` LIKE ? "
            bindList.push('%' + params.query + '%')
        }

        // 게시판 한개만 가져오는 경우
        if( listType === Enums.ListType.ONE) {
            query += " AND B.`key` = ? ";
            bindList.push(key)
        }

        // 정렬 순서
        query += " ORDER BY B.`title` ASC ";

        // 게시판 여러개를 가져오는 경우, 페이징 처리
        if( listType === Enums.ListType.ONE ) query += ` LIMIT ${offset}, ${params.pageRows}`

        // 반환을 위한 변수 세팅
        let result = [], totalRows = 0

        // 쿼리 실행
        try {
            result = await db.raw(query, bindList)
            result = result.length > 0 ? result[0] : []
        }
        catch {
            result = []
        }

        // 게시판의 경우 JSON 형태로 저장된 컬럼은 serialize 해줘야 한다.
        const jsonColumns = ["skin", "authorize", "options", "extraFields","categoryList"]
        for(let i=0; i<result.length; i++) {
            for(let column in jsonColumns) {
                try {
                    result[i][jsonColumns[column]] = JSON.parse( result[i][jsonColumns[column]] )
                }
                catch {
                    result[i][jsonColumns[column]] = {}
                }
            }
        }


        // 리스트 가져오기의 경우, totalCount 가져오기
        if( listType === Enums.ListType.LIST ) {
            totalRows = await db.getFoundRows()
        }

        let returnObject = db.getReturnObject( listType, result, totalRows)

        return  returnObject
    },

    /**
     * 게시판을 삭제한다.
     */
    async DeleteBoard (key, loginUserId = 0) {
        const query = "UPDATE `board` SET `status` = 'N', `updUser` = ?, `updDt` = NOW() WHERE `key` = ? "
        const bindList = [loginUserId, key]

        try {
            await db.raw(query, bindList)
            return true
        }
        catch {
            return false
        }
    }
}