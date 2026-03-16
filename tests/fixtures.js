const { test: base, expect } = require('@playwright/test');

// Block external requests that can't be reached in CI/sandbox environments
// Google Fonts stylesheets are render-blocking and will hang DOMContentLoaded
const test = base.extend({
    page: async ({ page }, use) => {
        // Block all external requests — fonts, scripts, iframes, APIs
        // that can't be reached in CI/sandbox and block page parsing
        await page.route(url => {
            const hostname = new URL(url).hostname;
            return hostname !== 'localhost' && hostname !== '127.0.0.1';
        }, route => {
            const url = route.request().url();
            if (url.includes('.css') || url.includes('fonts.googleapis.com')) {
                return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
            }
            if (url.includes('.js')) {
                return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
            }
            return route.abort('blockedbyclient');
        });
        await use(page);
    }
});

module.exports = { test, expect };
