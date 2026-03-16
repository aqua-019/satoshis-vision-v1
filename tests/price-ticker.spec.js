const { test, expect } = require('./fixtures');

test.describe('Price Ticker', () => {
    test('price ticker elements exist in nav', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('.price-ticker')).toBeVisible();
        await expect(page.locator('.live-dot')).toBeVisible();
        await expect(page.locator('#btc-price')).toBeVisible();
        await expect(page.locator('#xmr-price')).toBeVisible();
        await expect(page.locator('#btc-xmr-ratio')).toBeVisible();
    });

    test('price ticker hidden on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await expect(page.locator('.price-ticker')).toBeHidden();
    });

    test('prices update from CoinGecko API', async ({ page }) => {
        // Mock the CoinGecko API response
        await page.route('**/api.coingecko.com/**', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    bitcoin: { usd: 84500, usd_24h_change: 2.15 },
                    monero: { usd: 215.50, usd_24h_change: -1.32 }
                })
            });
        });

        await page.goto('/', { waitUntil: 'domcontentloaded' });

        // Wait for price to update (scripts.js fetches immediately)
        await expect(page.locator('#btc-price')).not.toHaveText('\u2014', { timeout: 10000 });
        await expect(page.locator('#xmr-price')).not.toHaveText('\u2014', { timeout: 5000 });

        // Verify prices are formatted
        const btcText = await page.locator('#btc-price').textContent();
        expect(btcText).toContain('$');
        expect(btcText).toContain('84');

        const xmrText = await page.locator('#xmr-price').textContent();
        expect(xmrText).toContain('$');
        expect(xmrText).toContain('215');

        // Check BTC/XMR ratio
        const ratioText = await page.locator('#btc-xmr-ratio').textContent();
        expect(parseFloat(ratioText)).toBeGreaterThan(300);
    });

    test('price change indicators show correct class', async ({ page }) => {
        await page.route('**/api.coingecko.com/**', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    bitcoin: { usd: 84500, usd_24h_change: 2.15 },
                    monero: { usd: 215.50, usd_24h_change: -1.32 }
                })
            });
        });

        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('#btc-change')).not.toHaveText('', { timeout: 10000 });

        // BTC is up, should have 'up' class
        await expect(page.locator('#btc-change')).toHaveClass(/up/);

        // XMR is down, should have 'down' class
        await expect(page.locator('#xmr-change')).toHaveClass(/down/);
    });

    test('handles API failure gracefully', async ({ page }) => {
        const errors = [];
        page.on('pageerror', err => errors.push(err.message));

        await page.route('**/api.coingecko.com/**', route => {
            route.abort('connectionrefused');
        });

        await page.goto('/', { waitUntil: 'domcontentloaded' });

        // Should show dash placeholder, no page errors
        await expect(page.locator('#btc-price')).toHaveText('\u2014');

        // console.log errors are fine, but no uncaught exceptions
        expect(errors).toEqual([]);
    });
});
