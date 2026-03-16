const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    timeout: 30000,
    retries: 1,
    use: {
        baseURL: 'http://localhost:3000',
        headless: true,
        navigationTimeout: 15000,
        launchOptions: {
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    },
    webServer: {
        command: 'npx serve . -p 3000 --no-clipboard',
        port: 3000,
        reuseExistingServer: true,
        timeout: 10000
    },
    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium' }
        }
    ]
});
