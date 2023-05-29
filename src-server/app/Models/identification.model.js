const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');
const date = new Date();
const reqNo = (Math.floor(Math.random() * 1000000000)).toString();

const getCurrentDate = () => {
  let date = new Date();
  let year = date.getFullYear().toString();

  let month = date.getMonth() + 1;
  month = month < 10 ? '0' + month.toString() : month.toString();

  let day = date.getDate();
  day = day < 10 ? '0' + day.toString() : day.toString();

  let hour = date.getHours();
  hour = hour < 10 ? '0' + hour.toString() : hour.toString();

  let minites = date.getMinutes();
  minites = minites < 10 ? '0' + minites.toString() : minites.toString();

  let seconds = date.getSeconds();
  seconds = seconds < 10 ? '0' + seconds.toString() : seconds.toString();

  return year + month + day + hour + minites + seconds;
}; 

/**
 * pass, 문자인증 관련
 */
 
module.exports = {
  async identification() {
    let currentTimestamp = (date.getTime() / 1000).toString().replace('.', '');


    // access token 발급
    let accessToken = await axios
      .post(
        'https://svc.niceapi.co.kr:22001/digital/niceid/oauth/oauth/token',
        {
          grant_type: 'client_credentials',
          scope: 'default',
        },
        {
          headers: {
            'Content-Type': `application/x-www-form-urlencoded`,
            Authorization: 'Basic ' + Buffer.from(`${config.nice.clientId}:${config.nice.clientSecret}`).toString('base64'),
          },
        }
      )
      .then(async function (response) {
        return response.data;
      })
      .catch(function (error) {
        console.log(error, 'err');
      });

    // 암호화 token 발급
    let encryptionToken = await axios
      .post(
        'https://svc.niceapi.co.kr:22001/digital/niceid/api/v1.0/common/crypto/token',
        {
          dataheader: { CNTY_CD: 'ko' },
          dataBody: {
            req_dtim: await getCurrentDate(),
            req_no: reqNo,
            enc_mode: '1',
          },
        },
        {
          headers: {
            Authorization:
              'bearer ' +
              Buffer.from(`${accessToken.dataBody.access_token}:${currentTimestamp}:${config.nice.clientId}`).toString('base64'),
            ProductID: config.nice.productID,
          },
        }
      )
      .then(async function (response) {
        return response.data;
      })
      .catch(function (error) {
        console.log(error, 'err');
      });

    // 대칭키 생성
    let value = (await getCurrentDate()).trim() + reqNo.trim() + encryptionToken.dataBody.token_val.trim();
    let resultVal = crypto.createHash('sha256').update(value).digest('base64');

    let key = resultVal.substring(0, 16);
    let iv = resultVal.substring(28, 44);
    let hmac_key = resultVal.substring(0, 32);
 
    // 요청 데이터 암호화
    reqData = {
      requestno: reqNo,
      returnurl: 'http://localhost:8080/pass',
      sitecode: encryptionToken.dataBody.site_code,
      methodtype: 'get',
      popupyn: 'Y',
      receivedata: ''
    };

    // 암호화 진행
    const cipher = crypto.createCipheriv('AES-128-CBC', key, iv);
    const encrypted = cipher.update(JSON.stringify(reqData));
    const enc_data =  Buffer.concat([encrypted, cipher.final()]).toString('base64');
    const hmac = crypto.createHmac("sha256", hmac_key).update(enc_data);
    const integrity_value = hmac.digest('base64');

    return {token_version_id: encryptionToken.dataBody.token_version_id, enc_data: enc_data, integrity_value : integrity_value, key: key, iv: iv };  
  }
};
