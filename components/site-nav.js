/**
 * <site-nav> Web Component
 *
 * Usage:
 *   <site-nav active="home"></site-nav>
 *   <site-nav active="education"></site-nav>
 *   <site-nav active="dashboard" no-ticker></site-nav>
 *
 * Attributes:
 *   active   – page key to highlight (home|education|timeline|quotes|secrets|
 *              future-outlook|dashboard|bottom-line|hold-monero)
 *   no-ticker – if present, hides the price ticker
 */
class SiteNav extends HTMLElement {
    connectedCallback() {
        var active = this.getAttribute('active') || '';
        var showTicker = !this.hasAttribute('no-ticker');

        var navLinks = [
            { href: 'index.html',            label: 'Home',           key: 'home' },
            { href: 'dashboard.html',        label: 'Dashboard',      key: 'dashboard' },
            { href: 'bottom-line.html',      label: 'XMR Bottom Line', key: 'bottom-line' },
            { href: 'future-outlook.html',   label: '2027+',          key: 'future-outlook' },
            { href: 'hold-monero.html',      label: 'XMR',            key: 'hold-monero', cta: true }
        ];

        var dropdownLinks = [
            { href: 'btc-xmr-education.html', label: 'Education',     key: 'education' },
            { href: 'timeline.html',           label: 'Timeline',      key: 'timeline' },
            { href: 'quotes.html',             label: 'Quote Archive', key: 'quotes' },
            { href: 'secrets.html',            label: 'Secrets',       key: 'secrets' },
            { href: 'future-outlook.html',     label: '2027+',         key: 'future-outlook' }
        ];

        var mobileLinks = [
            { href: 'index.html',              label: 'Home' },
            { href: 'btc-xmr-education.html',  label: 'Education' },
            { href: 'timeline.html',            label: 'Timeline' },
            { href: 'quotes.html',              label: 'Quote Archive' },
            { href: 'secrets.html',             label: 'Secrets' },
            { href: 'future-outlook.html',      label: '2027+' },
            { href: 'dashboard.html',           label: 'Dashboard' },
            { href: 'bottom-line.html',          label: 'XMR Bottom Line' },
            { href: 'hold-monero.html',          label: 'XMR', cta: true }
        ];

        var isDropdownActive = dropdownLinks.some(function(l) { return l.key === active; });

        function navLinkHtml(link) {
            if (link.cta) {
                return '<a href="' + link.href + '" style="background:var(--xmr-orange);color:#fff!important;padding:0.25rem 0.75rem;border-radius:99px;font-weight:600;">' + link.label + '</a>';
            }
            var cls = link.key === active ? ' class="nav-active"' : '';
            return '<a href="' + link.href + '"' + cls + '>' + link.label + '</a>';
        }

        function dropdownLinkHtml(link) {
            var style = link.key === active ? ' style="color:var(--xmr-orange);"' : '';
            return '<a href="' + link.href + '"' + style + '>' + link.label + '</a>';
        }

        function mobileLinkHtml(link) {
            if (link.cta) {
                return '<a href="' + link.href + '" onclick="toggleMenu()" style="background:var(--xmr-orange);color:#fff!important;padding:0.25rem 0.75rem;border-radius:99px;font-weight:600;display:inline-block;">' + link.label + '</a>';
            }
            return '<a href="' + link.href + '" onclick="toggleMenu()">' + link.label + '</a>';
        }

        var tickerHtml = '';
        if (showTicker) {
            tickerHtml = '<div class="price-ticker" role="status" aria-live="polite" aria-atomic="true" aria-label="Live cryptocurrency prices">' +
                '<span class="live-dot"></span>' +
                '<div class="price-item"><span class="price-label">BTC</span><span class="price-value" id="btc-price">\u2014</span><span class="price-change" id="btc-change"></span></div>' +
                '<div class="price-item"><span class="price-label">XMR</span><span class="price-value" id="xmr-price">\u2014</span><span class="price-change" id="xmr-change"></span></div>' +
                '<div class="price-item"><span class="price-label">BTC/XMR</span><span class="price-value" id="btc-xmr-ratio">\u2014</span></div>' +
            '</div>';
        }

        var mobilePricesHtml = showTicker ? '<div class="mobile-prices">' +
            '<div>BTC: <span id="btc-price-mobile">\u2014</span></div>' +
            '<div>XMR: <span id="xmr-price-mobile">\u2014</span></div>' +
            '<div>BTC/XMR: <span id="btc-xmr-ratio-mobile">\u2014</span></div>' +
        '</div>' : '';

        this.innerHTML =
            '<nav class="nav">' +
                '<a href="index.html" class="nav-logo" style="text-decoration:none;">XMR.IRISH</a>' +
                '<div class="nav-links">' +
                    navLinks.slice(0, 1).map(navLinkHtml).join('') +
                    '<div class="nav-dropdown">' +
                        '<a href="#" class="nav-dropdown-toggle" onclick="return false">Learn <span class="dropdown-arrow">&#9662;</span></a>' +
                        '<div class="nav-dropdown-menu">' +
                            dropdownLinks.map(dropdownLinkHtml).join('') +
                        '</div>' +
                    '</div>' +
                    navLinks.slice(1).map(navLinkHtml).join('') +
                '</div>' +
                tickerHtml +
                '<div class="hamburger" onclick="toggleMenu()"><span></span><span></span><span></span></div>' +
            '</nav>' +
            '<div class="mobile-menu" id="mobileMenu">' +
                mobileLinks.map(mobileLinkHtml).join('') +
                mobilePricesHtml +
            '</div>';
    }
}

customElements.define('site-nav', SiteNav);
