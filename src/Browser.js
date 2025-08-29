import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

class Browser {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.debug = options.debug || false;
        this.headless = options.headless !== false; // default to true if not specified

        // Set the folder to save PDFs
        this.dataDir = options.dataDir || path.join(__dirname, 'data');
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }

        this.launchOptions = {
            headless: true,
            defaultViewport: null,
            args: ['--no-sandbox'],
            // rpi4
            // headless: true,
            // defaultViewport: null,
            // executablePath: '/usr/bin/chromium',
            // args: ['--no-sandbox', '--disable-setuid-sandbox'],
        };

        if (this.debug) {
            this.log('Debug mode enabled. PDFs will be saved in:', this.dataDir);
        }
    }

    async init() {
        this.browser = await puppeteer.launch(this.launchOptions);
        this.page = await this.browser.newPage();
    }

    async goto(url) {
        if (!this.page) await this.init();
        this.log('Navigating to', url);
        await this.page.goto(url, { waitUntil: 'networkidle2' });
    }

    async savePDF(filename) {
        if (!this.page) throw new Error('Page not initialized');
        const filePath = path.join(this.dataDir, filename);
        await this.page.pdf({ path: filePath, format: 'A4' });
        this.log('PDF saved:', filePath);
        return filePath;
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    log(...args) {
        if (this.debug) {
            console.log('[DEBUG]', ...args);
        }
    }
}

export default Browser;


// Example usage:
// const browser = new Browser({ debug: true, dataDir: path.join('./pdfs') });
// try {
//     const url = 'PUT URL HERE';
//     await browser.goto(url);
//
//     const index = 1; // example index
//     const date = '4-8-2025'; // example period_description
//     const filename = `${index} - ${date}.pdf`;
//
//     await browser.savePDF(filename);
// }
// catch (err) {
//     console.error('Error:', err);
// }
// finally {
//     await browser.close();
// }
