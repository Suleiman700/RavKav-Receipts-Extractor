import axios from "axios";

export class RavKav {
    constructor() {}

    async login(session) {
        let data = JSON.stringify({
            "username": session.getEmail(),
            "password": session.getPassword(),
            "verification_code": session.getVerificationCode(),
        });

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://ravkavonline.co.il/api/o/login/',
            headers: {
                'accept': 'application/json',
                'accept-language': 'he',
                'content-type': 'application/json',
                'origin': 'https://ravkavonline.co.il',
                'priority': 'u=1, i',
                'referer': 'https://ravkavonline.co.il/he/store/login',
                'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                'x-ravkav-version': 'sw=ravkav-web id=null version=null d=87ad43702ce240c8b19cdd79ed677489'
            },
            data: data
        };

        const response = {
            state: false,
            data: [],
            errors: []
        };

        const loginResult = await axios.request(config)
            .then((res) => {
                console.log('res.data', res.data)
                response.state = true;
                response.data = res.data;
                response.errors = [];
            })
            .catch(async (error) => {
                response.state = false;
                response.errors.push(error);
                console.log('error.response.data', error.response.data)

                if (error.response.data.detail == 'verification_required') {
                    const sendVerificationCodeResult = await this.sendVerificationCode(session);
                    console.log('sendVerificationCodeResult', sendVerificationCodeResult)
                    if (sendVerificationCodeResult.state) {
                        response.state = true;
                        response.data = ['verification_code_sent']
                        response.errors = [];
                    }
                    else {
                        response.state = false;
                        response.data = ['verification_required']
                        response.errors = sendVerificationCodeResult.errors;
                    }
                }
            });

        return response;
    }

    async sendVerificationCode(session) {
        let data = JSON.stringify({
            "username": session.getEmail(),
            "password": session.getPassword(),
        });

        let config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'https://ravkavonline.co.il/api/o/issue-verification-code/',
            headers: {
                'accept': 'application/json',
                'accept-language': 'he',
                'content-type': 'application/json',
                'origin': 'https://ravkavonline.co.il',
                'priority': 'u=1, i',
                'referer': 'https://ravkavonline.co.il/he/store/login',
                'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                'x-ravkav-version': 'sw=ravkav-web id=null version=null d=87ad43702ce240c8b19cdd79ed677489'
            },
            data : data
        };

        const response = {
            state: false,
            data: [],
            errors: []
        };

        await axios.request(config)
            .then((res) => {
                response.state = true;
                response.data = res.data;
                response.errors = [];
            })
            .catch((error) => {
                response.state = false;
                response.errors.push(error);
            });


        return response;
    }

    async getTransactions(session) {
        console.log('session.loginResult.access_token', session.loginResult.data.access_token);
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: 'https://ravkavonline.co.il/api/transaction/?billing_status=charged&page_size=50',
            headers: {
                'accept': '*/*',
                'accept-language': 'he',
                'authorization': `Bearer ${session.loginResult.data.access_token}`,
                'content-type': 'application/json',
                'priority': 'u=1, i',
                'referer': 'https://ravkavonline.co.il/he/store/account/transaction-history?billingStatus=charged',
                'sec-ch-ua': '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                'x-ravkav-version': 'sw=ravkav-web id=null version=null d=87ad43702ce240c8b19cdd79ed677489'
            }
        };

        const response = {
            state: false,
            data: [],
            errors: []
        }

        await axios.request(config)
            .then((res) => {
                response.state = true;
                response.data = res.data;
                response.errors = [];
            })
            .catch((error) => {
                response.state = false;
                response.errors.push(error);
            });

        return response;
    }

}