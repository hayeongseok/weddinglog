const AWS = require('aws-sdk');
const config = require('../config');
const endpoint = new AWS.Endpoint('https://kr.object.ncloudstorage.com');
const region = 'kr-standard';
const md5 = require('md5');

// n cloud 연결
const S3 = new AWS.S3({
  endpoint,
  region,
  credentials: {
    accessKeyId: config.s3.access_key,
    secretAccessKey: config.s3.secret_key,
  },
});

/**
 * 파일 업로드 및 삭제 관련
 */ 

module.exports = {
  // 파일 업로드
  async CreateUploadFile(bucketName, fileName, fileData) {
    const time = Math.floor(new Date().getTime() / 1000);

    // upload file
    let set = await S3.putObject({
      Bucket: bucketName,
      Key: fileName, // 업로드 name
      // ACL을 지우면 전체 공개되지 않습니다.
      ACL: 'public-read',
      Body: fileData
    }).promise();
  },

  // 파일 업로드
  // 이전 img가 있을 경우 이전 img 삭제 후 업로드 진행
  async UpdateUploadFile(url, bucketName, fileName, fileData) {
    const time = Math.floor(new Date().getTime() / 1000);

    // 삭제하고 싶은 이미지 key 만들기
    url = url.split('/');
    key = url[url.length - 1];

    // 기존 이미지 삭제 진행
    S3.deleteObject(
      {
        Bucket: bucketName, // 삭제하고 싶은 이미지가 있는 버킷 이름
        Key: key, // 삭제하고 싶은 이미지의 key
      },
      (err, data) => {
        if (err) console.log(err); // 실패 시 에러 메시지
        else console.log(data); // 성공 시 데이터 출력
      }
    );

    // upload file
    let set = await S3.putObject({
      Bucket: bucketName,
      Key: fileName, // 업로드 name
      // ACL을 지우면 전체 공개되지 않습니다.
      ACL: 'public-read',
      Body: fileData,
    }).promise();
  },

  // 파일 삭제
  async DeleteFile(url) {
    let bucketName = '';

    // 삭제하고 싶은 이미지 key 만들기
    url = url.split('/');
    key = url[url.length - 1];

    // 버킷 이름 만들기
    for (let i in url) {
      if (i == url.length - 1) {
        bucketName += '';
      } else if (i == url.length - 2) {
        bucketName += url[i];
      } else if (i >= 3) {
        bucketName += url[i] + '/';
      }
    }

    // 기존 이미지 삭제 진행
    S3.deleteObject(
      {
        Bucket: bucketName, // 삭제하고 싶은 이미지가 있는 버킷 이름
        Key: key, // 삭제하고 싶은 이미지의 key
      },
      (err, data) => {
        if (err) console.log(err); // 실패 시 에러 메시지
        else console.log(data); // 성공 시 데이터 출력
      }
    );
  },
};
