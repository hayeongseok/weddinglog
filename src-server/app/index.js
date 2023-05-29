/** 서버 실행할 포트 설정 **/
const port = 3300;

/** 필요한 의존성 모듈 로드 **/
const express = require('express'),
  bodyParser = require('body-parser'),
  cors = require('cors'),
  routes = require('./Routes'),
  fileUpload = require('express-fileupload'),
  cookieParser = require('cookie-parser');

/** Helper Load **/
require('./Helpers/DateFormat.helper');

/** 메인 객체 생성 **/
const app = express();

/*
// 소캣 관련
const http = require('http').createServer(app)
const io = require('socket.io')(http)

io.on('connection', (socket) => {
    console.log('a user connected');
    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});

http.listen(port, () => {
    console.log(`서버가 작동되었습니다 : PORT ${port}`);
})
*/

/** CORS 처리 **/
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);


/** 방문자 기록 **/
app.use(cookieParser());


/** Rest API 사용을 위한 설정  **/
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  fileUpload({
    uriDecodeFileNames: true,
  })
);


/** 라우터 설정 불러오기 **/
app.use(routes);

/** 서버 실행 IPV6 **/
app.listen(port, '0.0.0.0', () => {
  console.log(`서버가 작동되었습니다 : PORT ${port}`);
});
