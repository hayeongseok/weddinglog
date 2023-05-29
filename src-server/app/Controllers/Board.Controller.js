const db = require('../Core/Database.core')
const BoardModel  = require('../Models/board.model')
const Enums = require("../Helpers/Enums");
const UserModel = require('../Models/users.model');
const AWS = require("aws-sdk");
const config = require("../config");
const {secretKey} = require("../config");

/**
 * 게시판의 권한을 확인한다.
 */
   const  CheckBoardAuthorize = async(req) =>
    {
        let returnAuth = {
            INSERT: false,
            UPDATE: false,
            DELETE: false,
            POSTS: false
        }

        // 1. 로그인 여부 확인
        if(typeof req.loginUserID === 'undefined' || ! req.loginUserID || req.loginUserID <= 0) {
            return returnAuth
        }

        // 2.로그인한 사용자가 슈퍼관리자이거나 게시판관리 권한이 있는지 확인한다.
        // /v1/users/permission 에서 사용한 컨트롤러/모델을 이용
        const permission = await UserModel.GetPermission(req.loginUserID)

        const MasterAuth = permission.find(item => item.key === 'MASTER')
        const isMaster = (MasterAuth !== null && MasterAuth["isAuth"] === 'Y')

        let returnAuthorize = {}
        for(let i in permission) {
            returnAuthorize[  permission[i].key] = isMaster || permission[i].isAuth === 'Y'
        }


        returnAuth.INSERT = (returnAuthorize.hasOwnProperty('BOARD/MODIFY') && returnAuthorize["BOARD/MODIFY"] === true)
        returnAuth.UPDATE = (returnAuthorize.hasOwnProperty('BOARD/MODIFY') && returnAuthorize["BOARD/MODIFY"] === true)
        returnAuth.DELETE = (returnAuthorize.hasOwnProperty('BOARD/REMOVE') && returnAuthorize["BOARD/REMOVE"] === true)

        // @todo: 3. 해당게시판 관리자 여부를 체크, 게시판 관리자는 게시글/댓글의 수정/삭제만 처리할수 있는 권한이다.
        return returnAuth
    }
/*
 *---------------------------------------------------------------
 * 게시판용 컨트롤러
 *---------------------------------------------------------------
 *
 * GetBoard         게시판의 목록 또는 게시판 한개의 정보를 가져온다.
 * PostBoard        게시판을 신규로 등록하거나 기존 게시판의 정보를 수정한다.
 * DeleteBoard      게시판을 삭제한다.
 * GetBoardPost     특정게시판의 게시글 목록 또는 댓글 목록을 가져온다. (type : POST / COMMENT )
 * PostBoardPosts   특정게시판에 신규 게시글 / 신규 댓글 을 작성하거나 기존에 작성된 게시글/댓글을 수정한다. (type : POST / COMMENT )
 * DeleteBoardPosts 특정게시판에 등록된 게시글/댓글을 삭제한다. (type : POST / COMMENT )
 */
module.exports = {
    /**
     * 게시판 목록 / 한개의 정보 가져오기
     * @constructor
     */
    async GetBoard (req, res)
    {
        // 게시판 고유 KEY가 넘어왔는지 확인하고, 해당 키를 변수로 저장한다.
        const key = req.params.hasOwnProperty('key') ? req.params.key : null
        const returnType = !key ? Enums.ListType.LIST : Enums.ListType.ONE ;

        // 페이징 처리를 위한 쿼리패러미터 가져오기
        let params = {}
        params.page = req.query.hasOwnProperty('page') ? req.params.page : 1
        params.pageRows = req.query.hasOwnProperty('pageRows') ? req.params.page : 10

        // 필터를 위한 쿼리 패러미터 가져오기
        params.query = req.query.hasOwnProperty('query') ? req.query.query : ""

        // 쿼리문 작성 시작
        let returnObject = await BoardModel.GetBoard(key, returnType, params )

        req.loginUserID = 1
        let permission = {} 
        await CheckBoardAuthorize(req).then(res => permission = res)

        return res.status(200).json(returnObject)
    },

    /**
     * 신규 게시판 등록 / 수정
     */
    async PostBoard (req, res)
    {
        // 게시판 고유 KEY가 넘어왔는지 확인하고, 해당 키를 변수로 저장한다.
        let key = req.params.hasOwnProperty('key') ? req.params.key : null
        const isUpdate = key !== null && key.length > 0

        // 게시판의 KEY 존재 여부에 따라  INSERT / UPDATE 모드를 결정한다.
        const PostType = key === null ? Enums.FormMode.INSERT : Enums.FormMode.UPDATE

        // 수정 모드일 경우 기존 게시판이 존재하는지 확인한다.
        if(PostType === Enums.FormMode.UPDATE) {
            const board = await BoardModel.GetBoard(key, Enums.ListType.ONE)

            // 게시판이 존재하지 않을 경우 처리
            if(! board || board.status !== 'Y' ) {
                return res.status(400).json({error:'존재하지 않는 게시판이거나, 이미 삭제된 게시판입니다.'})
            }
        }

        // 게시판 등록/수정 권한 체크
        const isAuth = await CheckBoardAuthorize(req)

        if( ( PostType === Enums.FormMode.INSERT && ! isAuth.INSERT ) ) {
            return res.status(403).json({error: '게시판을 신규 생성할 권한이 없습니다'})
        } else if  (PostType === Enums.FormMode.UPDATE && ! isAuth.UPDATE)  {
            return res.status(403).json({error: '게시판을 수정할 권한이 없습니다'})
        }

        // @todo : 넘어온 패러미터를 정리한다.
        const title = req.body.hasOwnProperty('title') ? req.body.title.trim() : ''
        let skins = req.body.hasOwnProperty('skins') ? req.body.skins : {}
        let authorize = req.body.hasOwnProperty('authorize') ? req.body.authorize : {}
        let options = req.body.hasOwnProperty('options') ? req.body.options: {}
        let extraFields = req.body.hasOwnProperty('extraFields') ? req.body.extraFields : []
        let categoryList = req.body.hasOwnProperty('categoryList') ? req.body.categoryList : []

        // JSON 형식의 경우 stringfy
        authorize = JSON.stringify(authorize)
        options = JSON.stringify(options)
        extraFields = JSON.stringify(extraFields)
        categoryList = JSON.stringify(categoryList)
        skins = JSON.stringify(skins)

        // 신규일경우키 값도 받아오고, KEY 값이 중복되는지 확인한다.
        if(!isUpdate) {
            key = req.body.hasOwnProperty('key') ? req.body.key : ''

            // 입력가능한 문자만 있는지 확인
            const keyRegex = /^[a-z]+[a-z0-9_]{3,19}$/;
            if(! keyRegex.test(key)) {
                return res.status(400).json({error:'게시판 고유키는 4~20자리의 영어소문자, 숫자, 언더바(_)만 사용가능합니다.'})
            }

            // 기존에 이미 사용중인 KEY 인지 확인한다.
            const checkBoard = await BoardModel.GetBoard(key, Enums.ListType.ONE)
            if(checkBoard !== null && typeof checkBoard.key !== 'undefined' && checkBoard.key) {
                return res.status(400).json({error:'이미 사용중인 게시판 KEY 입니다'})
            }
        }

        // 폼검증 시작
        if(title.trim().length === 0) {
            return res.status(400).json({error:'게시판 이름을 입력하셔야 합니다.'})
        }

        // 등록시작, 쿼리문 작성
        let bindingList = [title, skins, authorize, options, extraFields, categoryList, req.loginUserID]
        let query = " SET `title`=?, `skin` = ?, `authorize` = ?, `options` = ?, `extraFields` = ?, `categoryList` = ?, `updUser` = ?, `updDt`=NOW() "

        // 수정모드일경우
        if(isUpdate) {
            query = "UPDATE board " + query + " WHERE `key` = ? "
            bindingList.push(key)
        }
        // 신규작성일경우
        else {
            query = "INSERT INTO board " + query + ", `key` = ?, regUser= ?, regDt = NOW()"
            bindingList.push(key)
            bindingList.push(req.loginUserID)
        }

        // 쿼리 실행
        try {
            await db.raw(query, bindingList)

            return res.status(200).json({"result":"OK"})
        } catch (e) {
            return res.status(500).json({error:e.message})
        }
    },


    /**
     * 게시판 삭제
     */
    async DeleteBoard (req, res, type) {

        // 게시판 고유 KEY가 넘어왔는지 확인하고, 해당 키를 변수로 저장한다.
        const key = req.params.hasOwnProperty('key') ? req.params.key : null

        // 키가 넘어오지 않은 경우, 에러 처리
        if(! key) {
            return res.status(400).json({error:'잘못된 접근입니다'})
        }

        // 게시판 삭제 권한 체크
        const isAuth = await CheckBoardAuthorize(req)
        if(! isAuth.DELETE) {
            return res.status(403).json({error: '해당 게시판을 삭제할 권한이 없습니다'})
        }

        // 게시판 정보 가져오기
        const board = await BoardModel.GetBoard(key, Enums.ListType.ONE)

        // 게시판이 존재하지 않을 경우 처리
        if(! board || board.status !== 'Y' ) {
            return res.status(400).json({error:'존재하지 않는 게시판이거나, 이미 삭제된 게시판입니다.'})
        }

        // 게시판의 삭제처리
        const result = await BoardModel.DeleteBoard(key, req.loginUserID)
        if(result !== true) {
            return res.status(500).json({error:'데이터베이스 오류가 발생하였습니다'})
        }
        else {
            return res.status(200).json({result:'SUCCESS'})
        }
    },

    /**
     * 게시글/댓글의 목록/한개의 정보 가져오기
     */
    async GetBoardPost(req, res, type) {

    },

    /**
     * 게시글/댓글 작성
     */
    async PostBoardPosts(req, res, type) {

    },

    /**
     * 게시글/댓글 삭제
     */
    async DeleteBoardPosts(req, res, type) {

    },

    /**
     * 게시판 첨부파일/이미지 업로드
     */
    async UploadAttaches(req, res) {
        // 필요 라이브러리 로드
        const AWS = require('aws-sdk')
        const config = require('../config')
        const endpoint = new AWS.Endpoint('https://kr.object.ncloudstorage.com');
        const region = 'kr-standard'
        const path = require('path')

        // 게시판 고유키
        const key = req.params.key

        // 업로드한 파일을 가져온다.
        let files = req.files

        // 업로드된 파일이 없다면 리턴
        if(files === undefined || files.length === 0) {
            return res.status(400).json({error: '파일이 제대로 업로드 되지 않았습니다'})
        }
        let file = files.userfile

        // NCloud 객체 초기화
        const S3 = new AWS.S3({
            endpoint,
            region,
            credentials: {
                accessKeyId: config.s3.access_key,
                secretAccessKey: config.s3.secret_key
            }
        });

        // 리턴할 데이터 초기화
        let returnObject = {
            originalName : '',
            uploadedName: '',
            filePath: '',
            bucketName: '',
            fullUrl: '',
            ext: '',
            size: 0
        }

        // 업로드될 버킷경로를 설정한다
        const now = new Date()
        const year = now.getFullYear();	// 연도
        let month = now.getMonth() + 1
        if(month < 10) month = "0" + month
        const bucketName = config.s3.uploadBucketName + "/board/" + key + "/" + year + "/" + month + "/"
        const time = Math.floor(new Date().getTime() / 1000)

        // 리턴데이터 입력
        returnObject.originalName = file.name
        returnObject.size = file.size

        // 파일이름을 변경한다.
        const ext = path.extname( file.name )
        const newFileName = (require('md5')(config.secretKey + file.originalname + time )) + ext
        returnObject.ext = ext
        returnObject.uploadedName = newFileName
        returnObject.filePath = bucketName + newFileName
        returnObject.bucketName = bucketName
        returnObject.fullUrl = 'https://kr.object.ncloudstorage.com/' + returnObject.filePath

        // 파일 업로드 실행
        try {
            await S3.putObject({
                Bucket: bucketName,
                Key: newFileName,
                ACL: 'public-read',
                Body: file.buffer
            }).promise()

            return res.status(200).json(returnObject)
        }
        catch (e) {
            return res.status(500).json({error: '이미지 업로드에 실패하였습니다'})
        }
    }
}