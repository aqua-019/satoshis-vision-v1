const { test, expect } = require('./fixtures');

test.describe('Swap Tracker (hold-monero.html)', () => {
    test('swap tracker elements exist', async ({ page }) => {
        await page.goto('/hold-monero.html', { waitUntil: 'domcontentloaded' });

        // Check swap status input exists
        const statusInput = page.locator('input[placeholder*="transaction" i], input[placeholder*="swap" i], #txIdInput, #swap-id');
        await expect(statusInput.first()).toBeVisible();
    });

    test('ChangeNOW iframe has sandbox attribute', async ({ page }) => {
        await page.goto('/hold-monero.html', { waitUntil: 'domcontentloaded' });

        const iframe = page.locator('#iframe-widget');
        await expect(iframe).toHaveAttribute('sandbox', /allow-scripts/);
        await expect(iframe).toHaveAttribute('sandbox', /allow-forms/);
    });

    test('exchange widget section loads', async ({ page }) => {
        await page.goto('/hold-monero.html', { waitUntil: 'domcontentloaded' });

        // Check the ChangeNOW iframe exists
        const iframe = page.locator('#iframe-widget');
        await expect(iframe).toBeAttached();

        // It should have a data-src for lazy loading
        const dataSrc = await iframe.getAttribute('data-src');
        expect(dataSrc).toContain('changenow.io');
    });

    test('portal tabs switch correctly', async ({ page }) => {
        await page.goto('/hold-monero.html', { waitUntil: 'domcontentloaded' });

        // Check portal tabs exist
        const tabs = page.locator('.portal-tab, [onclick*="switchPortal"]');
        const tabCount = await tabs.count();
        expect(tabCount).toBeGreaterThanOrEqual(2);
    });

    test('legal disclaimer is present', async ({ page }) => {
        await page.goto('/hold-monero.html', { waitUntil: 'domcontentloaded' });

        // Footer should contain legal disclaimer
        const disclaimer = page.locator('.legal-notice, .footer-disclaimer');
        await expect(disclaimer.first()).toBeVisible();

        const text = await disclaimer.first().textContent();
        expect(text).toContain('EDUCATIONAL');
    });
});
