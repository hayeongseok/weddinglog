const userModel = require('../Models/users.model')
module.exports= {
    /**
     * 현재 로그인한 사용자가 특정한 권한을 갖고있는지 확인한다.
     */
    async isPermission (loginUserId, checkKey)
    {
        // 무조건 대문자로 변환
        checkKey = checkKey.toUpperCase()
        
        // 로그인 User PK 가 0 이하면 false 리턴
        if(loginUserId <= 0 ) {
            return false;
        }

        // UserModel 에서 사용자 권한 목록을 가져온다.
        let authList = await userModel.GetPermission(loginUserId)
        let auth = {}

        for(let i in authList) {
            auth[authList[i].key.toUpperCase()] = authList[i].isAuth === 'Y'
        }

        // 사용자가 마스터 권한이면 무조건 TRUE 반환
        if(auth["MASTER"] === true) {
            return true;
        }

        return (typeof auth[checkKey] !== 'undefined' ) && auth[checkKey] === true
    }
}