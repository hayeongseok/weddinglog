const db = require('../Core/Database.core');
const Enums = require('../Helpers/Enums');
const nodemailer = require('nodemailer');
const config = require('../config');

const token = config.slack.token;
const channel = config.slack.channel;
const { WebClient } = require('@slack/web-api');
const slackBot = new WebClient(token);

const logModel = require('../Models/log.model');
const ipModel = require('../Models/ip.model');

/**
 * 상담 관련 API
 */
module.exports = {
  // 상담 목록 및 정보 가져오기
  async GetInquiry(req, res) {
    const query = req.query.hasOwnProperty('query') ? req.query.query.trim() : '';
    const pageRows = req.query.hasOwnProperty('pageRows') ? req.query.pageRows.trim() * 1 : 10; // 한 페이지에 출력될 항목 갯수
    const page = req.query.hasOwnProperty('page') ? (req.query.page.trim() - 1) * pageRows : 0;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    let status = req.query.hasOwnProperty('status') ? req.query.status : ['Y', 'N'];
    for (let i in status) {
      status[i] = JSON.stringify(status[i]);
    }

    let type = req.query.hasOwnProperty('type') ? req.query.type : ['completion', 'incomplete'];
    for (let i in type) {
      type[i] = JSON.stringify(type[i]);
    }
    
    // 경로 패러미터에서 사용자 권한 id를 가져온다.
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;
    const returnType = id === null ? Enums.ListType.LIST : Enums.ListType.ONE;

    // 쿼리문을 작성한다.
    let dbQuery = '';
    let bindingList = []; // 바인딩할 배열

    dbQuery += 'SELECT SQL_CALC_FOUND_ROWS * FROM inquiry ';
    dbQuery += `WHERE 1 `;

    // 상담 정보 가져오기
    if (returnType === Enums.ListType.ONE) {
      dbQuery += 'AND id = ?';
      bindingList.push(id);

      // 쿼리 실행
      try {
        result = (await db.raw(dbQuery, bindingList))[0][0];

        const productWish = (
          await db.raw(`SELECT userId, productId, \`name\`, imgUrl FROM products_wish AS W LEFT JOIN products AS P ON W.productId = P.id WHERE userId = ? AND W.status = 'Y' AND P.status ='Y'`, [result.userId]))[0];

        // 사용 로그 추가
        await logModel.postLog('문의/조회', req.loginUserID, await ipModel.ip2long(ip), `문의 조회 / inquiryId : ${id}`);
        return res.status(200).json({ result, productWish });
      } catch (e) {
        return res.status(500).json('데이터베이스 오류가 발생하였습니다');
      }

      // 조건 및 필터에 따른 WHERE 절 추가
    } else {
      if (query.length > 0) {
        dbQuery += ` AND (id LIKE ? OR \`name\` LIKE ? OR phone LIKE ?) `;
        bindingList.push('%' + query + '%', '%' + query + '%', '%' + query + '%');
      }

      if (type.length > 0) {
        dbQuery += `AND \`type\` in (${type}) `;
      }

      if (status.length > 0) {
        dbQuery += `AND \`status\` in (${status}) `;
      }

      dbQuery += `ORDER BY id DESC LIMIT ?, ?`;
      bindingList.push(page, pageRows);

      // 쿼리 실행
      try {
        result = (await db.raw(dbQuery, bindingList))[0];

        // Limit을 제외하고 count를 저장할 수 있는 역할
        const totalCountResult = (await db.raw('SELECT FOUND_ROWS() AS cnt'))[0][0].cnt * 1;

        // 사용 로그 추가
        await logModel.postLog('문의/조회', req.loginUserID, await ipModel.ip2long(ip), `문의 리스트 조회`);
        return res.status(200).json({ pageInfo: { page: req.query.page * 1, totalRows: totalCountResult }, result });
      } catch (e) {
        return res.status(500).json('데이터베이스 오류가 발생하였습니다');
      }
    }
  },

  
  // 문의 생성 및 수정하기
  async PostInquiry(req, res) {
    const status = req.body.hasOwnProperty('status') ? req.body.status.trim() : '';
    const name = req.body.hasOwnProperty('name') ? req.body.name.trim() : '';
    const phone = req.body.hasOwnProperty('phone') ? req.body.phone.trim() : '';
    const dDay = req.body.hasOwnProperty('dDay') ? req.body.dDay : null;
    const note = req.body.hasOwnProperty('note') ? req.body.note.trim() : '';
    const userId = req.body.hasOwnProperty('userId') ? req.body.userId : 0;
    const productId = req.body.hasOwnProperty('productId') ? req.body.productId : 0;
    let typeName;

    
    // UserAgent 분석
    const useragent = require('express-useragent');
    const ua = useragent.parse(req.headers['user-agent']);

    const referrer = req.headers.hasOwnProperty('referrer') ? req.headers.referrer : '';
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const ipInt = await ipModel.ip2long(ip)
    const browser = ua.browser ? ua.browser : '';
    const version = ua.version ? ua.version : '';
    const platform = ua.os ? ua.os : '';
    const is_mobile = ua.isMobile ?? false ? 'Y' : 'N';
    const mobile = ua.platform ? ua.platform : '';

    let referrer_host = '';
    let keyword = '';
    let utm = '';
        
    // UTM
    if(referrer.split("&")[1] == undefined) {
      utm = referrer.split("&")[0]
    } else {
      utm = (referrer.split("&")[1]).split("=")[1];
    }

    if (referrer.trim().length > 0) {
      const url = new URL(referrer);
      referrer_host = url.hostname;
  
      if (url.search.length > 0) {
        const query1 = url.searchParams.get('query');
        const query2 = url.searchParams.get('q');
        const query3 = url.searchParams.get('p');
  
        if (query1 && query1.length > 0) {
          keyword = query1;
        } else if (query2 && query2.length > 0) {
          keyword = query2;
        } else if (query3 && query3.length > 0) {
          keyword = query3;
        } else {
          if (url.searchParams.get('topReferer')) {
            const url2 = new URL(decodeURI(url.searchParams.get('topReferer')));
  
            if (url2.searchParams.get('query')) {
              keyword = url2.searchParams.get('query');
            } else if (url2.searchParams.get('q')) {
              keyword = url2.searchParams.get('q');
            } else if (url2.searchParams.get('p')) {
              keyword = url2.searchParams.get('p');
            }
          }
        }
      }
    }

    // 경로 패러미터에서 사용자 권한 id를 가져온다.
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;

    if (name.length <= 1 || name.lanegh >= 12) {
      throw new Error('이름은 최소 2글자에서 11글자까지 입력하셔야 합니다.');
    }
    if (phone.length === 0) {
      throw new Error('연락처를 입력해주세요.');
    }

    // id 존재 여부에 따라  INSERT / UPDATE 모드를 결정한다.
    const PostType = id === null ? Enums.FormMode.INSERT : Enums.FormMode.UPDATE;

    try {
      typeName = (await db.raw(`SELECT \`type\`, basecode.name FROM products LEFT JOIN basecode ON products.type = basecode.id WHERE products.id = ?`, [productId]))[0]

      if(typeName.length > 0) {
        typeName = typeName[0].name
      }
    } catch (e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다');
    }

    // 문의 생성하기 진행
    if (PostType === 'INSERT') {
      try {
        // email
        const main = async () => {
          let transporter = nodemailer.createTransport({
            service: 'naver',
            port: 587,
            secure: false,
            auth: {
              user: config.email.user,
              pass: config.email.pass,
            },
          });
          let info = await transporter.sendMail({
            from: `"Weddinglog Team" <gusals4742@naver.com>`,
            to: 'gusals4742@naver.com',
            subject: `${typeName} 문의 / 신청자 명 : ${name} / UTM: ${utm}`,
            text: `이름: ${name},\n결혼 예정일: ${dDay},\n연락처: ${phone}\n\nIP 주소: ${ip}\n접속 Browser: ${browser}\nOS: ${platform}\n모바일 여부:${is_mobile}\n리퍼러: ${referrer_host}\n리퍼러상세: ${referrer}\n유입검색어: ${keyword}\n신청페이지: wedddinglog.co.kr`,
          });
        };

        main().catch(console.error);

        // slack bot
        try {
          await slackBot.chat.postMessage({
            channel: channel,
            text: `이름: ${name},\n결혼 예정일: ${dDay},\n연락처: ${phone}\n\nIP 주소: ${ip}\n접속 Browser: ${browser}\nOS: ${platform}\n모바일 여부:${is_mobile}\n리퍼러: ${referrer_host}\n리퍼러상세: ${referrer}\n유입검색어: ${keyword}\n신청페이지: wedddinglog.co.kr`,
          });
        } catch (err) {
          console.log(err.message);
        }

        // inquiry 테이블 insert 쿼리 실행
        let insert = await db.raw(
          `INSERT INTO inquiry (userId, \`name\`, dDay, phone, note, productId, browser, version, platform, is_mobile, mobile, referrer_host, keyword, referrer, ip) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [userId, name, dDay, phone, note, productId, browser, version, platform, is_mobile, mobile, referrer_host, keyword, referrer, ipInt]);

        // 사용 로그 추가
        await logModel.postLog('문의/등록', userId, ipInt, `문의 등록 / inquiryId : ${insert[0].insertId}`);

        return res.status(200).json({ result: 'OK' });
      } catch (e) {
        return res.status(500).json('데이터베이스 오류가 발생하였습니다');
      }

      // 맞춤 추천 수정하기 진행
    } else if (PostType === 'UPDATE') {
      // inquiry 테이블 update 쿼리 실행
      try {
        await db.raw('UPDATE inquiry SET `status` = ?, userId = ?, `name` = ?, dDay = ?, phone = ?, note = ?, updUser = ?, productId = ? WHERE id = ?', [status, userId, name, dDay, phone, note, userId, productId, id]);

        // 사용 로그 추가
        await logModel.postLog('문의/수정', userId, ipInt, `문의 수정 / inquiryId : ${id}`);
        return res.status(200).json({ result: 'OK' });
      } catch (e) {
        return res.status(500).json('데이터베이스 오류가 발생하였습니다');
      }
    }
  },

  // 문의 삭제하기
  async DeleteInquiry(req, res) {
    const status = req.body.hasOwnProperty('status') ? req.body.status.trim() : 'N';
    const id = req.params.hasOwnProperty('id') ? req.params.id : null;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    // 쿼리 실행
    try {
      await db.raw('UPDATE inquiry SET `status` = ?, updUser = ? WHERE id = ?', [status, req.loginUserID, id]);

      // 사용 로그 추가
      await logModel.postLog('문의/삭제', req.loginUserID, await ipModel.ip2long(ip), `문의 삭제 / inquiryId : ${id}`);
      return res.status(200).json({ result: 'OK' });
    } catch (e) {
      return res.status(500).json('데이터베이스 오류가 발생하였습니다');
    }
  },
};
