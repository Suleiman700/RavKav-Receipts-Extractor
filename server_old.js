const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const Scraper = require('./Scraper');

const app = express();
const PORT = process.env.PORT || 8083;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}


// API endpoint
app.post('/api/scrape', async (req, res) => {
    try {
        const { id, password, code, mode = 'json' } = req.body;

        // Validate input
        if (!id || !password || !code) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: id, password, code'
            });
        }

        // Pass credentials directly to the scraper
        const scraper = new Scraper({
            debug: true,
            headless: true,
            credentials: { id, password, code }
        });

        // // Initialize and run the scraper
        // const scraper = new Scraper({
        //     debug: true,
        //     headless: true
        // });

        try {
            await scraper.initialize();
            await scraper.login();
            const data = await scraper.grabData();

            if (mode === 'save') {
                // Save data to file
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `scrape-${timestamp}.json`;
                const filepath = path.join(dataDir, filename);
                fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

                return res.json({
                    success: true,
                    message: 'Data saved successfully',
                    filename
                });
            } else {
                // Return data in response
                return res.json({
                    success: true,
                    data
                });
            }
        } finally {
            // Always close the browser when done
            await scraper.close();
        }
    } catch (error) {
        console.error('Scraping error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'An error occurred during scraping'
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});

module.exports = app;
