/**
 * 상품 관련 api
 */

const router = require('express').Router();
const AuthorizeController = require('../Controllers/Authorize.Contoller');
const productsController = require('../Controllers/Products.Contoller');
const permissionController = require('../Controllers/Permission.Contoller');
const authorizeController = require('../Controllers/Authorize.Contoller');




// 특정 상품에 좋아요 처리하기
router.post('/like', AuthorizeController.LoginCheck, productsController.postUserProductsLike);

// 특정 사용자의 상품의 좋아요 누른 상품 목록 가져오기
router.get('/like/:userId', AuthorizeController.nonLoginCheck, productsController.getUserProductsLike);

// 찜 생성하기
router.post('/wish', authorizeController.LoginCheck, productsController.PostWish);

// 찜 목록 가져오기
router.get('/wish', authorizeController.LoginCheck, productsController.GetWish);

// 상품 목록 가져오기
router.get('/', AuthorizeController.LoginCheck, permissionController.ChackUserPermission, productsController.getProducts);

// 상품 댓글 생성하기
router.post('/post', AuthorizeController.LoginCheck, productsController.postComment);

// 상품 승인하기
router.post('/approval/:id', AuthorizeController.LoginCheck, permissionController.ChackUserPermission, productsController.approvalProduct);

// 상품 댓글 정보 가져오기
router.get('/post', productsController.getComment);

// 상품 댓글 생성하기
router.post('/post', AuthorizeController.LoginCheck, productsController.postComment);

// 상품 좋아요/싫어요
router.post('/post/like', AuthorizeController.LoginCheck, productsController.postCommentLike);

// 상품 댓글 수정하기
router.post('/post/:id', AuthorizeController.LoginCheck, productsController.postComment);

// 상품 댓글 삭제하기
router.delete('/post/:id', AuthorizeController.LoginCheck, productsController.deleteComment);



// 상품 정보 신규 등록하기
router.post('/', AuthorizeController.LoginCheck, permissionController.ChackUserPermission, productsController.postProducts);

// 상품 정보 수정하기
router.post('/:id', AuthorizeController.LoginCheck, permissionController.ChackUserPermission, productsController.postProducts);

// 상품의 노출 상태 변경
router.post('/:id/status', AuthorizeController.nonLoginCheck, productsController.changeStatus);

// 상품 정보 가져오기
router.get('/:id', AuthorizeController.LoginCheck, permissionController.ChackUserPermission, productsController.getProducts);

// 상품 정보 삭제하기
router.delete('/:id', AuthorizeController.LoginCheck, permissionController.ChackUserPermission, productsController.deleteProducts);

module.exports = router;
