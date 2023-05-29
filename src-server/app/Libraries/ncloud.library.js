const db = require('../Core/Database.core');
const config = require('../config');

function getRandomInt(min, max) {
  //min ~ max 사이의 임의의 정수 반환
  return Math.floor(Math.random() * (max - min)) + min;
}

module.exports = {

    async sendAlimtalk ( params = {}) {
        const phone = params.hasOwnProperty('phone') ? params.phone : null;
        const content = params.hasOwnProperty('content') ? params.content: null;
        const code = params.hasOwnProperty('code') ? params.code : null;

        if(! phone) throw Error('연락처 정보가 없습니다.');
        if(! content) throw Error('전송할 내용이 없습니다.');
        if(! code) throw Error('템플릿 코드가 지정되지 않았습니다');

        // 전송할 데이터 처리
        const postData = {
            plusFriendId: config.ncloud.friendId,
            templateCode: code,
            content:content,
            messages: [
                {
                    to: phone.replace(/-/g,''),
                    content: content
                }
            ]
        }

        const CryptoJS = require('crypto-js');

        const sTime = Date.now().toString();
        const smsUrl = `https://sens.apigw.ntruss.com/alimtalk/v2/services/${config.ncloud.bizSId}/messages`;
        const smsUri = `/alimtalk/v2/services/${config.ncloud.bizSId}/messages`;
        const hashString = `POST ${smsUri}\n${sTime}\n${config.ncloud.accessKeyId}`
        const hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256,config.ncloud.secretKey);
        hmac.update(hashString);
        const hash = hmac.finalize();
        const signature = hash.toString(CryptoJS.enc.Base64);

        const axios = require('axios')

        let result ={};

        await axios.post(smsUrl, postData, {
            headers : {
                'Content-Type': 'application/json; charset=utf-8',
                'x-ncp-apigw-timestamp': sTime,
                "x-ncp-iam-access-key": config.ncloud.accessKeyId,
                "x-ncp-apigw-signature-v2" : signature
            }
        }).then(res => {
            result = res.data;
        })

        return result;
    },
};
