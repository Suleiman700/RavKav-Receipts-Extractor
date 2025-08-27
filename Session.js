
export class Session {
    sessionId = null;
    email = null;
    password = null;
    verification_code = null;
    loginStatuses = {
        'NO': 'NO',
        'WAITING_OTP': 'WAITING_OTP',
        'YES': 'YES'
    };
    loginStatus = null; // NO, WAITING_OTP, YES
    loginResult = {
        state: null,
        access_token: null,
        refresh_token: null,
        errors: [],
    };

    /**
     * Create a new session
     * @param {object} credentials
     * @param {string} credentials.email
     * @param {string} credentials.password
     */
    constructor(credentials = {}) {
        const { email, password } = credentials;
        this.sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        this.email = email;
        this.password = password;
        this.loginStatus = this.loginStatuses.NO;
    }

    setEmail(email) {
        this.email = email;
        return {state: true}
    }
    getEmail() {
        return this.email;
    }

    setPassword(password) {
        this.password = password;
        return {state: true}
    }
    getPassword() {
        return this.password;
    }

    setVerificationCode(verification_code) {
        this.verification_code = verification_code;
        return {state: true}
    }
    getVerificationCode() {
        return this.verification_code;
    }

    setLoginStatus(loginStatus) {
        // Check if loginStatus is valid
        if (!Object.values(this.loginStatuses).includes(loginStatus)) {
            return {
                state: false,
                errors: ['Invalid login status'],
            }
        }
        this.loginStatus = loginStatus;
        return {state: true}
    }
    getLoginStatus() {
        return this.loginStatus;
    }

    setIsLogged(isLogged) {
        this.isLogged = isLogged;
        return {state: true}
    }
    getIsLogged() {
        return this.isLogged;
    }

    setLoginResult(loginResult) {
        this.loginResult = loginResult;
        return {state: true}
    }
    getLoginResult() {
        return this.loginResult;
    }
}
