/* ============================================
   SATOSHI'S VISION — App Core
   Shared initialization, navigation, utilities
   ============================================ */

const App = {
    state: {
        menuOpen: false,
        scrolled: false,
        currentPage: '',
        prices: {},
        priceHistory: {},
    },

    init() {
        this.detectCurrentPage();
        this.initNav();
        this.initScrollAnimations();
        this.initScrollSpy();
        this.initPriceTicker();
        document.body.classList.add('has-ticker');
    },

    detectCurrentPage() {
        const path = window.location.pathname;
        const file = path.split('/').pop().replace('.html', '') || 'index';
        this.state.currentPage = file;
    },

    /* === Navigation === */
    initNav() {
        const nav = document.querySelector('.nav');
        if (!nav) return;

        // Scroll detection
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const scrolled = window.scrollY > 20;
                    if (scrolled !== this.state.scrolled) {
                        this.state.scrolled = scrolled;
                        nav.classList.toggle('scrolled', scrolled);
                    }
                    ticking = false;
                });
                ticking = true;
            }
        });

        // Active link highlighting
        const links = nav.querySelectorAll('.nav__link');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;
            const page = href.replace('.html', '').replace('./', '').replace('/', '');
            const target = page === '' ? 'index' : page;
            if (target === this.state.currentPage) {
                link.classList.add('nav__link--active');
            }
        });
    },

    toggleMenu() {
        this.state.menuOpen = !this.state.menuOpen;
        const mobile = document.querySelector('.nav__mobile');
        const hamburger = document.querySelector('.nav__hamburger');
        if (mobile) mobile.classList.toggle('active', this.state.menuOpen);
        if (hamburger) hamburger.classList.toggle('active', this.state.menuOpen);
        document.body.style.overflow = this.state.menuOpen ? 'hidden' : '';
    },

    closeMenu() {
        this.state.menuOpen = false;
        const mobile = document.querySelector('.nav__mobile');
        const hamburger = document.querySelector('.nav__hamburger');
        if (mobile) mobile.classList.remove('active');
        if (hamburger) hamburger.classList.remove('active');
        document.body.style.overflow = '';
    },

    /* === Scroll Animations (Intersection Observer) === */
    initScrollAnimations() {
        const elements = document.querySelectorAll('[data-animate]');
        if (!elements.length) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const delay = entry.target.dataset.delay || 0;
                    setTimeout(() => {
                        entry.target.classList.add('visible');
                    }, parseInt(delay));
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        elements.forEach(el => observer.observe(el));
    },

    /* === Scroll Spy === */
    initScrollSpy() {
        const sections = document.querySelectorAll('section[id]');
        if (!sections.length) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    document.querySelectorAll('.nav__link').forEach(link => {
                        link.classList.toggle('nav__link--active',
                            link.getAttribute('href') === `#${id}`);
                    });
                }
            });
        }, { threshold: 0.3 });

        sections.forEach(s => observer.observe(s));
    },

    /* === Price Ticker === */
    async initPriceTicker() {
        await this.fetchPrices();
        this.renderTicker();
        // Refresh every 60 seconds
        setInterval(() => this.fetchPrices().then(() => this.updateTickerPrices()), 60000);
    },

    async fetchPrices() {
        try {
            const res = await fetch(
                'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,monero,tether,usd-coin,ethereum&vs_currencies=usd&include_24hr_change=true&include_market_cap=true'
            );
            if (!res.ok) throw new Error('Price fetch failed');
            this.state.prices = await res.json();
        } catch (e) {
            console.warn('Price fetch error:', e);
            // Fallback static prices
            this.state.prices = {
                bitcoin: { usd: 0, usd_24h_change: 0 },
                monero: { usd: 0, usd_24h_change: 0 },
                tether: { usd: 1.00, usd_24h_change: 0 },
                'usd-coin': { usd: 1.00, usd_24h_change: 0 },
                ethereum: { usd: 0, usd_24h_change: 0 },
            };
        }
    },

    renderTicker() {
        const ticker = document.querySelector('.ticker');
        if (!ticker) return;

        const coins = [
            { id: 'bitcoin', symbol: 'BTC', icon: '\u20BF' },
            { id: 'monero', symbol: 'XMR', icon: '\u0271' },
            { id: 'ethereum', symbol: 'ETH', icon: '\u039E' },
            { id: 'tether', symbol: 'USDT', icon: '$' },
            { id: 'usd-coin', symbol: 'USDC', icon: '$' },
        ];

        const buildItems = () => coins.map(coin => {
            const data = this.state.prices[coin.id] || {};
            const price = data.usd ? `$${data.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '...';
            const change = data.usd_24h_change || 0;
            const changeStr = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
            const changeClass = change >= 0 ? 'ticker__change--up' : 'ticker__change--down';

            return `
                <div class="ticker__item" data-coin="${coin.id}">
                    <span class="ticker__symbol">${coin.symbol}</span>
                    <span class="ticker__price" data-price="${coin.id}">${price}</span>
                    <span class="ticker__change ${changeClass}" data-change="${coin.id}">${changeStr}</span>
                </div>
            `;
        }).join('');

        // Duplicate for seamless scroll
        const track = ticker.querySelector('.ticker__track');
        if (track) {
            track.innerHTML = buildItems() + buildItems();
        }
    },

    updateTickerPrices() {
        const coins = ['bitcoin', 'monero', 'ethereum', 'tether', 'usd-coin'];
        coins.forEach(id => {
            const data = this.state.prices[id] || {};
            const priceEls = document.querySelectorAll(`[data-price="${id}"]`);
            const changeEls = document.querySelectorAll(`[data-change="${id}"]`);
            const price = data.usd ? `$${data.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '...';
            const change = data.usd_24h_change || 0;
            const changeStr = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
            priceEls.forEach(el => el.textContent = price);
            changeEls.forEach(el => {
                el.textContent = changeStr;
                el.className = `ticker__change ${change >= 0 ? 'ticker__change--up' : 'ticker__change--down'}`;
            });
        });
    },

    /* === Utilities === */
    formatNumber(n, decimals = 2) {
        if (n >= 1e12) return (n / 1e12).toFixed(decimals) + 'T';
        if (n >= 1e9) return (n / 1e9).toFixed(decimals) + 'B';
        if (n >= 1e6) return (n / 1e6).toFixed(decimals) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(decimals) + 'K';
        return n.toFixed(decimals);
    },

    formatPrice(n) {
        return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    debounce(fn, delay = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    },

    throttle(fn, limit = 100) {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                fn(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
};

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
