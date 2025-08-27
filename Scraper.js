const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
//
// // Load credentials from environment variables
// const credentials = {
//     id: process.env.CREDENTIALS_ID,
//     password: process.env.CREDENTIALS_PASSWORD,
//     code: process.env.CREDENTIALS_CODE
// };
//
// console.log(process.env.CREDENTIALS_ID)
//
// // Validate that all required environment variables are set
// const requiredEnvVars = ['CREDENTIALS_ID', 'CREDENTIALS_PASSWORD', 'CREDENTIALS_CODE'];
// const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
//
// if (missingVars.length > 0) {
//     console.error('Error: Missing required environment variables:');
//     missingVars.forEach(varName => console.error(`- ${varName}`));
//     console.error('\nPlease copy .env.example to .env and fill in your credentials');
//     process.exit(1);
// }

class Scraper {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.debug = options.debug || false;
        this.headless = options.headless !== false; // default to true if not specified
        this.dataDir = path.join(__dirname, 'data');
        this.accountNumber = null; // Will be set after login
        this.credentials = options.credentials || {};

        if (this.debug) {
            this.log('Debug mode enabled');
        }
    }

    log(...args) {
        if (this.debug) {
            console.log('[DEBUG]', ...args);
        }
    }

    async initialize() {
        this.log('Initializing browser...');
        const launchOptions = {
            // normal
            headless: true,
            defaultViewport: null,
            args: ['--no-sandbox'],
            // rpi4
            // headless: true,
            // defaultViewport: null,
            // executablePath: '/usr/bin/chromium',
            // args: ['--no-sandbox', '--disable-setuid-sandbox'],
        };

        // Create a directory for saved data if it doesn't exist
        this.dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
            this.log(`Created data directory at: ${this.dataDir}`);
        } else {
            this.log(`Using existing data directory at: ${this.dataDir}`);
        }

        this.log('Launch options:', JSON.stringify(launchOptions, null, 2));

        try {
            this.browser = await puppeteer.launch(launchOptions);
            this.log('Browser launched successfully');

            // Create a new page
            this.page = await this.browser.newPage();
            this.log('New page created');

            // Set a default timeout for page actions
            this.page.setDefaultTimeout(30000);

            // Store captured responses
            this.capturedResponses = {};

            // Listen for API responses
            this.page.on('response', async (response) => {
                const url = response.url();

                try {
                    // Handle account details
                    if (url.includes('accountDetails/infoAndBalance')) {
                        const data = await response.json();
                        this.capturedResponses.accountDetails = data;
                        this.log('Captured account details response');
                    }
                    // Handle dashboard balances
                    else if (url.includes('dashboard/dashboardBalances')) {
                        const data = await response.json();
                        this.capturedResponses.dashboardBalances = data;
                        this.log('Captured dashboard balances response');
                    }
                } catch (error) {
                    this.log(`Error processing API response (${url}): ${error.message}`);
                }
            });

            await this.page.setRequestInterception(true);
            this.page.on('request', request => request.continue());

            // Enable debugging features if debug is on
            if (this.debug) {
                // Log console messages from the page
                this.page.on('console', msg => {
                    console.log(`[CONSOLE] ${msg.text()}`);
                });

                // Log page errors
                this.page.on('pageerror', error => {
                    console.error(`[PAGE ERROR] ${error.message}`);
                });

                // Log unhandled promise rejections
                this.page.on('error', error => {
                    console.error(`[ERROR] ${error.message}`);
                });

                // Log unhandled promise rejections
                this.page.on('unhandledrejection', (reason, promise) => {
                    console.error(`[UNHANDLED REJECTION] ${reason}`);
                });
            }
        } catch (error) {
            const errorMsg = `Error during initialization: ${error instanceof Error ? error.message : String(error)}`;
            this.log(errorMsg);

            throw error;
        }
    }

    async login() {
        if (!this.page) {
            const errorMsg = 'Page not initialized. Call initialize() first.';
            this.log(errorMsg);
            throw new Error(errorMsg);
        }

        try {
            this.log('Navigating to login page...');
            await this.page.goto('https://start.telebank.co.il/login/?bank=m', { waitUntil: 'networkidle2' });

            this.log('Entering credentials...');

            // Enter credentials using direct DOM manipulation for speed
            await this.page.evaluate(({id, password, code}) => {
                document.querySelector('input#tzId').value = id;
                document.querySelector('input#tzPassword').value = password;
                document.querySelector('input#aidnum').value = code;

                // Trigger input events
                ['input', 'change'].forEach(eventType => {
                    document.querySelector('input#tzId').dispatchEvent(new Event(eventType, { bubbles: true }));
                    document.querySelector('input#tzPassword').dispatchEvent(new Event(eventType, { bubbles: true }));
                    document.querySelector('input#aidnum').dispatchEvent(new Event(eventType, { bubbles: true }));
                });
            }, this.credentials);

            this.log('Clicking login button...');
            await Promise.all([
                this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
                this.page.click('.login-form button[type="submit"]')
            ]);

            this.log('Successfully logged in');
        } catch (error) {
            const errorMsg = `Error during login: ${error instanceof Error ? error.message : String(error)}`;
            this.log(errorMsg);

            // Take a screenshot on error if debug is enabled
            if (this.debug && this.page) {
                await this.page.screenshot({ path: 'debug-error.png' });
                this.log('Error screenshot saved as debug-error.png');
            }

            throw error;
        }
    }

    async getDebitAuthorizationsList(accountNumber) {
        if (!this.page) {
            throw new Error('Page not initialized');
        }

        try {
            this.log('Fetching debit authorizations list...');

            // Make the API request directly
            const response = await this.page.evaluate(async () => {
                const response = await fetch(`/Titan/gatewayAPI/debitAuthorizations/list/${this.accountNumber}/NotRequired`, {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    method: 'GET',
                    credentials: 'include'
                });
                return response.json();
            });

            this.log('Successfully fetched debit authorizations list');
            return response;

        } catch (error) {
            const errorMsg = `Error fetching debit authorizations: ${error.message}`;
            this.log(errorMsg);
            throw new Error(errorMsg);
        }
    }

    async getAccountDetails(accountNumber) {
        this.log('Triggering account details request...');

        // Trigger the request
        await this.page.evaluate((accNum) => {
            fetch(`/Titan/gatewayAPI/accountDetails/infoAndBalance/${accNum}`, {
                method: 'GET',
                credentials: 'include'
            });
        }, accountNumber);

        // Wait for the response to be captured
        const maxWaitTime = 10000; // 10 seconds
        const startTime = Date.now();

        while (!this.capturedResponses.accountDetails && (Date.now() - startTime) < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!this.capturedResponses.accountDetails) {
            throw new Error('Timeout waiting for account details response');
        }

        return this.capturedResponses.accountDetails;
    }

    async getLoanAndSavingBalance(accountNumber) {
        this.log('Fetching dashboard balances...');

        // Reset the captured response
        this.capturedResponses.dashboardBalances = null;

        // Use page.evaluate to make the request and return the response
        const response = await this.page.evaluate(async (accNum) => {
            try {
                const response = await fetch('https://start.telebank.co.il/Titan/gatewayAPI/dashboard/dashboardBalances', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({
                        AccountNumber: accNum
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                console.error('Error in fetch:', error);
                throw error;
            }
        }, accountNumber);

        // Store the response
        this.capturedResponses.dashboardBalances = response;
        this.log('Successfully fetched dashboard balances');

        return response;
    }

    async getLoansData(accountNumber) {
        this.log('Fetching loans data...');

        // Reset the captured response
        this.capturedResponses.loansData = null;

        // Use page.evaluate to make the request and return the response
        const response = await this.page.evaluate(async (accNum) => {
            try {
                const response = await fetch(`/Titan/gatewayAPI/onlineLoans/loansQuery/${accNum}`, {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                console.error('Error fetching loans data:', error);
                throw error;
            }
        }, accountNumber);

        // Store the response
        this.capturedResponses.loansData = response;
        this.log('Successfully fetched loans data');

        return response;
    }

    async getUserAccountsData() {
        this.log('Fetching user accounts data...');

        // Make the request to get user accounts data
        const response = await this.page.evaluate(async () => {
            try {
                const response = await fetch('/Titan/gatewayAPI/userAccountsData?FetchAccountsNickName=true&FirstTimeEntry=false', {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                console.error('Error fetching user accounts data:', error);
                throw error;
            }
        });

        // Set the account number from the response
        if (response?.UserAccountsData?.DefaultAccountNumber) {
            this.accountNumber = response.UserAccountsData.DefaultAccountNumber;
            this.log(`Found account number: ${this.accountNumber}`);
        } else {
            throw new Error('Could not determine account number from user accounts data');
        }

        return response;
    }

    async grabData() {
        try {
            this.log('Starting data grab...');
            const data = {};

            // First get user accounts data to set the account number
            data.userAccounts = await this.getUserAccountsData();

            // Get other data in parallel
            const [accountDetails, debitAuthorizations, dashboardBalances, loansData] = await Promise.all([
                this.getAccountDetails(this.accountNumber),
                this.getDebitAuthorizationsList(this.accountNumber),
                this.getLoanAndSavingBalance(this.accountNumber),
                this.getLoansData(this.accountNumber)
            ]);

            data.accountDetails = accountDetails;
            data.debitAuthorizations = debitAuthorizations;
            data.dashboardBalances = dashboardBalances;
            data.loansData = loansData;

            // Create data directory if it doesn't exist
            if (!fs.existsSync(this.dataDir)) {
                fs.mkdirSync(this.dataDir, { recursive: true });
            }

            // Save combined data to data.json
            const dataPath = path.join(this.dataDir, 'data.json');
            fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
            this.log(`Saved data to ${dataPath}`);

            return data;

        }
        catch (error) {
            this.log(`Error in grabData: ${error.message}`);
            throw error;
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.log('Browser closed');
        }
    }
}

// Export the Scraper class
module.exports = { Scraper };

// Example usage
async function main() {
    // Enable debug mode and show browser window
    const scraper = new Scraper({
        debug: true,
        headless: false
    });

    try {
        await scraper.initialize();
        await scraper.login();

        // Grab the data
        const data = await scraper.grabData();
        console.log('Successfully grabbed data:', Object.keys(data));

        // Show where data was saved
        const dataPath = path.join(__dirname, 'data', 'data.json');
        console.log(`\nData saved to: ${dataPath}`);

        // Keep the browser open for 5 seconds for demonstration
        console.log('Keeping browser open for 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    catch (error) {
        console.error('An error occurred:', error);
        process.exit(1);
    }
    finally {
        console.log('Closing browser...');
        await scraper.close();
        console.log('Browser closed');
    }
}

// Run the example
// main();

module.exports = Scraper;
