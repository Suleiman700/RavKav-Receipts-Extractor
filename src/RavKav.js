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
                session.setLoginResult(session.loginStatuses.YES)
                response.state = true;
                response.data = res.data;
                response.errors = [];
            })
            .catch(async (error) => {
                session.setLoginResult(session.loginStatuses.NO)
                response.state = false;
                response.errors.push(error);
                console.log('error.response.data', error.response.data)

                if (error.response.data.detail == 'verification_required') {
                    session.setLoginResult(session.loginStatuses.WAITING_OTP)
                    const sendVerificationCodeResult = await this.sendVerificationCode(session);
                    console.log('sendVerificationCodeResult', sendVerificationCodeResult)
                    if (sendVerificationCodeResult.state) {
                        response.state = true;
                        response.data = ['verification_code_sent']
                        response.errors = [];
                    }
                    else {
                        response.state = false;
                        response.data = []
                        response.errors = sendVerificationCodeResult.errors;
                    }
                }
                else if (error.response.data.detail) {
                    response.state = false;
                    response.data = []
                    response.errors = error.response.data.detail;
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

    async getTransactions(session, options = { startDate: null, endDate: null }) {
        let url = 'https://ravkavonline.co.il/api/transaction/?billing_status=charged&page_size=1000';

        // Add date parameters if provided
        if (options.startDate && options.endDate) {
            const startDateStr = options.startDate;
            const endDateStr = options.endDate;
            url += `&created_since=${startDateStr}&created_until=${endDateStr}`;
        }

        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: url,
            headers: {
                'accept': '*/*',
                'accept-language': 'he',
                'authorization': `Bearer ${session.loginResult.data.access_token}`,
                'content-type': 'application/json',
                'referer': 'https://ravkavonline.co.il/he/store/account/transaction-history?billingStatus=charged',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
                'x-ravkav-version': 'sw=ravkav-web id=null version=null d=87ad43702ce240c8b19cdd79ed677489'
            }
        };

        const response = {
            state: false,
            status: null,
            data: [],
            errors: []
        };

        try {
            const res = await axios.request(config);
            response.state = true;
            response.status = res.status;
            response.data = res.data;
        } catch (error) {
            response.state = false;
            response.status = error.response?.status || 500;

            if (error.response?.data?.detail) {
                response.errors = [error.response.data.detail];
            } else {
                response.errors = [error.message || "Unknown error"];
            }
        }

        return response;
    }
}