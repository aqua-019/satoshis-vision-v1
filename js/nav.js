/* ═══════════════════════════════════════════════════════════════
   Shared Navigation — xmr.irish C.3.3
   Injects the full nav bar with shamrock, dropdowns, block counter,
   and price ticker on every page. Call NavComponent.inject() on DOMContentLoaded.
   ═══════════════════════════════════════════════════════════════ */

const NavComponent = {

    shamrockSVG: `<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="sh-la" cx="45%" cy="40%" r="55%"><stop offset="0%" stop-color="#2EA84E"/><stop offset="60%" stop-color="#177A34"/><stop offset="100%" stop-color="#0D5A24"/></radialGradient><clipPath id="sh-mc"><circle cx="0" cy="0" r="68"/></clipPath></defs><g transform="translate(200,200)"><g transform="scale(1.06)"><path d="M0,-8 C-30,-8 -58,-40 -72,-78 C-88,-120 -82,-170 -50,-185 C-18,-200 12,-180 0,-140 C-12,-180 18,-200 50,-185 C82,-170 88,-120 72,-78 C58,-40 30,-8 0,-8Z" fill="#999"/><path d="M8,0 C8,-30 40,-58 78,-72 C120,-88 170,-82 185,-50 C200,-18 180,12 140,0 C180,-12 200,18 185,50 C170,82 120,88 78,72 C40,58 8,30 8,0Z" fill="#999"/><path d="M0,8 C30,8 58,40 72,78 C88,120 82,170 50,185 C18,200 -12,180 0,140 C12,180 -18,200 -50,185 C-82,170 -88,120 -72,78 C-58,40 -30,8 0,8Z" fill="#999"/><path d="M-8,0 C-8,30 -40,58 -78,72 C-120,88 -170,82 -185,50 C-200,18 -180,-12 -140,0 C-180,12 -200,-18 -185,-50 C-170,-82 -120,-88 -78,-72 C-40,-58 -8,-30 -8,0Z" fill="#999"/></g><path d="M0,-6 C-28,-6 -54,-36 -68,-72 C-84,-112 -78,-158 -48,-172 C-16,-186 14,-168 0,-132 C-14,-168 16,-186 48,-172 C78,-158 84,-112 68,-72 C54,-36 28,-6 0,-6Z" fill="url(#sh-la)"/><path d="M6,0 C6,-28 36,-54 72,-68 C112,-84 158,-78 172,-48 C186,-16 168,14 132,0 C168,-14 186,16 172,48 C158,78 112,84 72,68 C36,54 6,28 6,0Z" fill="url(#sh-la)"/><path d="M0,6 C28,6 54,36 68,72 C84,112 78,158 48,172 C16,186 -14,168 0,132 C14,168 -16,186 -48,172 C-78,158 -84,112 -68,72 C-54,36 -28,6 0,6Z" fill="url(#sh-la)"/><path d="M-6,0 C-6,28 -36,54 -72,68 C-112,84 -158,78 -172,48 C-186,16 -168,-14 -132,0 C-168,14 -186,-16 -172,-48 C-158,-78 -112,-84 -72,-68 C-36,-54 -6,-28 -6,0Z" fill="url(#sh-la)"/><g clip-path="url(#sh-mc)"><circle cx="0" cy="0" r="68" fill="#FF6600"/><path d="M-68,4 Q-68,68 0,68 Q68,68 68,4Z" fill="#4C4C4C"/><polyline points="-36,34 -36,-32 0,12 36,-32 36,34" fill="none" stroke="#FFF" stroke-width="11" stroke-linejoin="miter"/></g></g></svg>`,

    getActivePage() {
        const path = window.location.pathname;
        const file = path.split('/').pop().replace('.html', '') || 'index';
        return file;
    },

    inject(targetId) {
        const target = document.getElementById(targetId) || document.body;
        const active = this.getActivePage();

        const isActive = (page) => active === page ? 'active' : '';
        const isDropdownActive = (pages) => pages.includes(active) ? 'active' : '';
        const mempoolActive = window.location.pathname.startsWith('/mempool') ? 'active' : '';

        const html = `
        <nav class="nav">
            <a href="https://x.com/aquaticXCP" class="shamrock-link" title="@AquaticXCP" target="_blank">
                ${this.shamrockSVG}
            </a>
            <a href="/" class="nav-logo"><span>xmr</span>.irish</a>

            <!-- Always-visible search (PROMPT C) -->
            <div class="nav-search" role="search">
                <span class="nav-search-icon" aria-hidden="true">⌕</span>
                <input type="text" id="nav-search-input"
                       class="nav-search-input"
                       placeholder="Search block / tx hash…"
                       spellcheck="false"
                       autocomplete="off"
                       aria-label="Search block height, block hash, or transaction hash">
                <button type="button" class="nav-search-btn" id="nav-search-btn" aria-label="Submit search">→</button>
                <div class="nav-search-hint" id="nav-search-hint" hidden>
                    enter a block height or 64-char hex hash
                </div>
            </div>

            <div class="nav-links">
                <a href="/" class="nav-link ${isActive('index')}">Home</a>
                <a href="/mempool-explorer" class="nav-link ${mempoolActive}">Mempool</a>
                <div class="dd-wrap">
                    <span class="nav-link ${isDropdownActive(['btc-xmr-education','timeline','quotes','secrets','future-outlook','privacy-architecture','protocol-simulations'])}">Education</span>
                    <div class="dd-menu">
                        <a class="dd-item" href="/protocol-simulations">Protocol simulations</a>
                        <a class="dd-item" href="/privacy-architecture">Protocol visualizations</a>
                        <a class="dd-item" href="/btc-xmr-education">BTC vs XMR education</a>
                        <a class="dd-item" href="/timeline">Timeline</a>
                        <a class="dd-item" href="/quotes">Quote explorer</a>
                        <a class="dd-item" href="/secrets">Secret threads</a>
                        <a class="dd-item" href="/future-outlook">2027+ outlook</a>
                    </div>
                </div>
                <div class="dd-wrap">
                    <span class="nav-link ${isDropdownActive(['dashboard','markets','network','mining','legal']) || mempoolActive}">Dashboard</span>
                    <div class="dd-menu">
                        <a class="dd-item" href="/markets">Market dashboard</a>
                        <a class="dd-item" href="/network">Network statistics</a>
                        <a class="dd-item" href="/mining">Mining</a>
                        <a class="dd-item" href="/mempool-explorer">Monero mempool</a>
                        <a class="dd-item" href="/legal">Legal status</a>
                    </div>
                </div>
                <div class="dd-wrap">
                    <span class="nav-link ${isDropdownActive(['hold-monero','bottom-line','community','ecosystem'])}">Monero</span>
                    <div class="dd-menu">
                        <a class="dd-item" href="/hold-monero">Hold XMR</a>
                        <a class="dd-item" href="/mining">Mine XMR</a>
                        <a class="dd-item" href="/bottom-line">XMR bottom line</a>
                        <a class="dd-item" href="/community">Community</a>
                        <a class="dd-item" href="/ecosystem">Ecosystem map</a>
                    </div>
                </div>
            </div>
            <div class="nav-block">
                <div class="nb-dot"></div>
                <span class="nb-val" id="nav-block-height">—</span>
                <span class="nb-label">block</span>
            </div>
            <div class="nav-price">
                <div class="np">
                    <span class="sym">BTC</span>
                    <span class="val" id="nav-btc-price">—</span>
                    <span class="chg-dn" id="nav-btc-change"></span>
                </div>
                <div class="np">
                    <span class="sym">XMR</span>
                    <span class="val" id="nav-xmr-price">—</span>
                    <span class="chg-up" id="nav-xmr-change"></span>
                </div>
                <div class="np">
                    <span class="sym">BTC/XMR</span>
                    <span class="val" id="nav-ratio-val">—</span>
                </div>
            </div>
            <button type="button" class="nav-search-toggle" id="nav-search-toggle" aria-label="Open search">⌕</button>
            <button class="hamburger" id="nav-hamburger" aria-label="Menu">
                <span></span><span></span><span></span>
            </button>
        </nav>
        <div class="mobile-menu" id="mobile-menu">
            <a href="/" class="mm-link ${isActive('index')}">Home</a>
            <a href="/mempool-explorer" class="mm-link ${mempoolActive}">Mempool</a>
            <div class="mm-group">
                <span class="mm-label">Education</span>
                <a href="/protocol-simulations" class="mm-link ${isActive('protocol-simulations')}">Protocol simulations</a>
                <a href="/privacy-architecture" class="mm-link ${isActive('privacy-architecture')}">Protocol visualizations</a>
                <a href="/btc-xmr-education" class="mm-link ${isActive('btc-xmr-education')}">BTC vs XMR</a>
                <a href="/timeline" class="mm-link ${isActive('timeline')}">Timeline</a>
                <a href="/quotes" class="mm-link ${isActive('quotes')}">Quote explorer</a>
                <a href="/secrets" class="mm-link ${isActive('secrets')}">Secret threads</a>
                <a href="/future-outlook" class="mm-link ${isActive('future-outlook')}">2027+ outlook</a>
            </div>
            <div class="mm-group">
                <span class="mm-label">Dashboard</span>
                <a href="/markets" class="mm-link ${isActive('markets')}">Markets</a>
                <a href="/network" class="mm-link ${isActive('network')}">Network</a>
                <a href="/mining" class="mm-link ${isActive('mining')}">Mining</a>
                <a href="/mempool-explorer" class="mm-link ${mempoolActive}">Mempool</a>
                <a href="/legal" class="mm-link ${isActive('legal')}">Legal status</a>
            </div>
            <div class="mm-group">
                <span class="mm-label">Monero</span>
                <a href="/hold-monero" class="mm-link ${isActive('hold-monero')}">Hold XMR</a>
                <a href="/bottom-line" class="mm-link ${isActive('bottom-line')}">XMR bottom line</a>
                <a href="/community" class="mm-link ${isActive('community')}">Community</a>
                <a href="/ecosystem" class="mm-link ${isActive('ecosystem')}">Ecosystem map</a>
            </div>
        </div>`;

        if (targetId) {
            target.innerHTML = html;
        } else {
            document.body.insertAdjacentHTML('afterbegin', html);
        }

        // Skip-to-content link for keyboard / screen-reader users (WCAG 2.4.1)
        if (!document.querySelector('.skip-link')) {
            const skip = document.createElement('a');
            skip.className = 'skip-link';
            skip.href = '#main';
            skip.textContent = 'Skip to main content';
            document.body.insertAdjacentElement('afterbegin', skip);
        }
        // Tag the page-offset wrapper as the main landmark target
        const pageOffset = document.querySelector('.page-offset');
        if (pageOffset && !pageOffset.id) pageOffset.id = 'main';

        // Wire up hamburger toggle
        const hamburger = document.getElementById('nav-hamburger');
        const mobileMenu = document.getElementById('mobile-menu');
        if (hamburger && mobileMenu) {
            hamburger.addEventListener('click', () => {
                hamburger.classList.toggle('open');
                mobileMenu.classList.toggle('open');
            });
            // Close menu when a link is tapped
            mobileMenu.querySelectorAll('.mm-link').forEach(link => {
                link.addEventListener('click', () => {
                    hamburger.classList.remove('open');
                    mobileMenu.classList.remove('open');
                });
            });
        }
        this._wireSearch();

        /* Bake price service start into nav inject so every page with the nav
           has a live price ticker without needing per-page boot code. start()
           is idempotent — safe to call here even if a page also calls it. */
        if (window.PriceService && typeof window.PriceService.start === 'function') {
            window.PriceService.start();
        }
    },

    _wireSearch() {
        const input = document.getElementById('nav-search-input');
        const btn = document.getElementById('nav-search-btn');
        const toggle = document.getElementById('nav-search-toggle');
        const hint = document.getElementById('nav-search-hint');
        const wrap = input && input.closest('.nav-search');
        if (!input || !btn || !wrap) return;

        const isValid = (q) => {
            const s = (q || '').trim();
            if (!s) return false;
            if (/^\d+$/.test(s) && parseInt(s, 10) < 10000000) return true;
            if (/^[0-9a-fA-F]{64}$/.test(s)) return true;
            return false;
        };

        const submit = () => {
            const q = input.value.trim();
            if (!isValid(q)) {
                wrap.classList.add('is-invalid');
                if (hint) hint.hidden = false;
                setTimeout(() => {
                    wrap.classList.remove('is-invalid');
                    if (hint) hint.hidden = true;
                }, 2200);
                return;
            }
            const target = '/mempool-explorer?search=' + encodeURIComponent(q);
            if (window.location.pathname === '/mempool-explorer' || window.location.pathname.endsWith('mempool-explorer.html')) {
                if (window.MempoolExplorer && window.MempoolExplorer.routeSearch) {
                    const explorerBtn = document.querySelector('.mp-mode-btn[data-mode="explorer"]');
                    if (explorerBtn) explorerBtn.click();
                    setTimeout(() => window.MempoolExplorer.routeSearch(q), 50);
                    input.blur();
                    return;
                }
            }
            window.location.href = target;
        };

        btn.addEventListener('click', submit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); submit(); }
            if (e.key === 'Escape') { input.value = ''; input.blur(); wrap.classList.remove('is-open'); }
        });
        input.addEventListener('input', () => {
            wrap.classList.remove('is-invalid');
            if (hint) hint.hidden = true;
        });

        if (toggle) {
            toggle.addEventListener('click', () => {
                wrap.classList.toggle('is-open');
                if (wrap.classList.contains('is-open')) {
                    setTimeout(() => input.focus(), 80);
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                e.preventDefault();
                input.focus();
                input.select();
            }
        });
    }
};
