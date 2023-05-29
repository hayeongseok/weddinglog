/*
 *---------------------------------------------------------------
 * 게시판용 라우터
 *---------------------------------------------------------------
 *
 * [GET] /v1/board  생성된 게시판 목록 가져오기
 * [GET] /v1/board/:key 게시판 한개의 정보 가져오기
 * [POST] /v1/board 신규 게시판 생성하기
 * [PATCH] /v1/board/:key  게시판 수정하기
 * [DELETE] /v1/board/:key 게시판 삭제하기
 * [GET] /v1/board/:key/posts 게시글 목록 가져오기
 * [GET] /v1/board/:key/posts/:id 게시글 한개 가져오기
 * [POST] /v1/board/:key/posts 게시글 신규 등록
 * [PATCH] /v1/board/:key/posts/:id 게시글 정보 수정
 * [DELETE] /v1/board/:key/posts/:id 게시글 삭제
 * [GET] /v1/board/:key/posts/:id/comments 댓글 목록 가져오기
 * [GET] /v1/board/:key/posts/:id/comments/:cId 댓글 한개의 정보 가져오기
 * [POST] /v1/board/:key/posts/:id/comments 댓글 신규 작성하기
 * [PATCH] /v1/board/:key/posts/:id/comments/:cId 댓글 신규 작성하기
 * [DELETE] /v1/board/:key/posts/:id/comments/:cId 댓글 삭제하기
 *
 */
const router = require('express').Router()
const BoardContoller = require('../Controllers/Board.Controller')
const AuthorizeController = require('../Controllers/Authorize.Contoller')

router.get('/', BoardContoller.GetBoard)
router.get('/:key', BoardContoller.GetBoard)
router.post('/', AuthorizeController.LoginCheck, BoardContoller.PostBoard)
router.post('/:key', AuthorizeController.LoginCheck,BoardContoller.PostBoard)
router.delete('/:key', AuthorizeController.LoginCheck, BoardContoller.DeleteBoard)
router.get('/:key/posts', (req, res) => {
    return BoardContoller.GetBoardPost(req, res, 'POST')
})
router.get('/:key/posts/:id', (req, res)=> {
    return BoardContoller.GetBoardPost(req, req, 'POST')
})
router.post('/:key/posts', (req, res) => {
    return BoardContoller.PostBoardPosts(req, req, 'POST')
})
router.patch('/:key/posts/:id', (req, res) => {
    return BoardContoller.PostBoardPosts(req, req, 'POST')
})
router.delete('/:key/posts/:id', (req, res) => {
    return BoardContoller.DeleteBoardPosts(req, req, 'POST')
})
router.get('/:key/posts/:id/comments', (req, res)=> {
    return BoardContoller.GetBoardPost(req, res, 'COMMENT')
})
router.get('/:key/posts/:id/comments/:cId', (req, res)=> {
    return BoardContoller.GetBoardPost(req, req, 'COMMENT')
})
router.post('/:key/posts/:id/comments', (req, res) => {
    return BoardContoller.PostBoardPosts(req, req, 'COMMENT')
})
router.patch('/:key/posts/:id/comments/:cId', (req, res) => {
    return BoardContoller.PostBoardPosts(req, req, 'COMMENT')
})
router.delete('/:key/posts/:id/comments/:cId', (req, res) => {
    return BoardContoller.DeleteBoardPosts(req, req, 'COMMENT')
})
router.post('/:key/attaches', BoardContoller.UploadAttaches)

module.exports = router