const { test, expect } = require('./fixtures');

const PAGES = [
    { path: '/', title: 'Privacy Evolution' },
    { path: '/quotes.html', title: 'Satoshi Quote' },
    { path: '/secrets.html', title: 'Secret Threads' },
    { path: '/timeline.html', title: 'Timeline' },
    { path: '/dashboard.html', title: 'Dashboard' },
    { path: '/bottom-line.html', title: 'Bottom Line' },
    { path: '/hold-monero.html', title: 'Hold Monero' },
    { path: '/btc-xmr-education.html', title: 'Genesis of Privacy' },
    { path: '/future-outlook.html', title: 'Future' },
    { path: '/404.html', title: '404' }
];

test.describe('Navigation', () => {
    test('all pages load without errors', async ({ page }) => {
        const errors = [];
        page.on('pageerror', err => errors.push(err.message));

        for (const p of PAGES) {
            await page.goto(p.path, { waitUntil: 'domcontentloaded' });
            await expect(page).toHaveTitle(new RegExp(p.title, 'i'));
        }

        expect(errors).toEqual([]);
    });

    test('nav component renders on all pages', async ({ page }) => {
        for (const p of PAGES) {
            await page.goto(p.path, { waitUntil: 'domcontentloaded' });
            await expect(page.locator('nav.nav')).toBeVisible();
            await expect(page.locator('.nav-logo')).toHaveText('XMR.IRISH');
        }
    });

    test('nav links are present and functional', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await expect(page.locator('.nav-links')).toBeVisible();

        // Check dropdown exists
        await expect(page.locator('.nav-dropdown-toggle')).toBeVisible();

        // Hover dropdown to reveal menu
        await page.locator('.nav-dropdown').hover();
        await expect(page.locator('.nav-dropdown-menu')).toBeVisible();

        // Check dropdown contains expected links
        const dropdownLinks = page.locator('.nav-dropdown-menu a');
        await expect(dropdownLinks).toHaveCount(5);
    });

    test('mobile menu toggle works', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        // Nav links should be hidden on mobile
        await expect(page.locator('.nav-links')).toBeHidden();

        // Hamburger should be visible
        await expect(page.locator('.hamburger')).toBeVisible();

        // Click hamburger to open mobile menu
        await page.locator('.hamburger').click();
        await expect(page.locator('#mobileMenu')).toHaveClass(/active/);

        // Click again to close
        await page.locator('.hamburger').click();
        await expect(page.locator('#mobileMenu')).not.toHaveClass(/active/);
    });

    test('XMR CTA button visible in nav', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        const ctaBtn = page.locator('.nav-links a[href="hold-monero.html"]');
        await expect(ctaBtn).toBeVisible();
        await expect(ctaBtn).toHaveText('XMR');
    });

    test('active page is highlighted in nav', async ({ page }) => {
        await page.goto('/dashboard.html', { waitUntil: 'domcontentloaded' });
        const activeLink = page.locator('.nav-links a.nav-active');
        await expect(activeLink).toHaveText('Dashboard');
    });

    test('clicking nav links navigates correctly', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.locator('.nav-links a[href="dashboard.html"]').click();
        await expect(page).toHaveURL(/dashboard/);
        await expect(page).toHaveTitle(/Dashboard/i);
    });
});
