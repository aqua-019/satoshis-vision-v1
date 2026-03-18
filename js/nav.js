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

        const html = `
        <nav class="nav">
            <a href="https://x.com/aquaticXCP" class="shamrock-link" title="@AquaticXCP" target="_blank">
                ${this.shamrockSVG}
            </a>
            <a href="index.html" class="nav-logo"><span>xmr</span>.irish</a>
            <div class="nav-links">
                <a href="index.html" class="nav-link ${isActive('index')}">Home</a>
                <div class="dd-wrap">
                    <span class="nav-link ${isDropdownActive(['btc-xmr-education','timeline','quotes','secrets','future-outlook'])}">Education</span>
                    <div class="dd-menu">
                        <a class="dd-item" href="btc-xmr-education.html">BTC vs XMR education</a>
                        <a class="dd-item" href="timeline.html">Timeline</a>
                        <a class="dd-item" href="quotes.html">Quote explorer</a>
                        <a class="dd-item" href="secrets.html">Secret threads</a>
                        <a class="dd-item" href="future-outlook.html">2027+ outlook</a>
                    </div>
                </div>
                <div class="dd-wrap">
                    <span class="nav-link ${isDropdownActive(['dashboard','markets','network','mining','mempool','legal'])}">Dashboard</span>
                    <div class="dd-menu">
                        <a class="dd-item" href="markets.html">Market dashboard</a>
                        <a class="dd-item" href="network.html">Network statistics</a>
                        <a class="dd-item" href="mining.html">Mining</a>
                        <a class="dd-item" href="mempool.html">Monero mempool</a>
                        <a class="dd-item" href="legal.html">Legal status</a>
                    </div>
                </div>
                <div class="dd-wrap">
                    <span class="nav-link ${isDropdownActive(['hold-monero','bottom-line','community','ecosystem'])}">Monero</span>
                    <div class="dd-menu">
                        <a class="dd-item" href="hold-monero.html">Hold XMR</a>
                        <a class="dd-item" href="mining.html">Mine XMR</a>
                        <a class="dd-item" href="bottom-line.html">XMR bottom line</a>
                        <a class="dd-item" href="community.html">Community</a>
                        <a class="dd-item" href="ecosystem.html">Ecosystem map</a>
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
            <button class="hamburger" id="nav-hamburger" aria-label="Menu">
                <span></span><span></span><span></span>
            </button>
        </nav>
        <div class="mobile-menu" id="mobile-menu">
            <a href="index.html" class="mm-link ${isActive('index')}">Home</a>
            <div class="mm-group">
                <span class="mm-label">Education</span>
                <a href="btc-xmr-education.html" class="mm-link ${isActive('btc-xmr-education')}">BTC vs XMR</a>
                <a href="timeline.html" class="mm-link ${isActive('timeline')}">Timeline</a>
                <a href="quotes.html" class="mm-link ${isActive('quotes')}">Quote explorer</a>
                <a href="secrets.html" class="mm-link ${isActive('secrets')}">Secret threads</a>
                <a href="future-outlook.html" class="mm-link ${isActive('future-outlook')}">2027+ outlook</a>
            </div>
            <div class="mm-group">
                <span class="mm-label">Dashboard</span>
                <a href="markets.html" class="mm-link ${isActive('markets')}">Markets</a>
                <a href="network.html" class="mm-link ${isActive('network')}">Network</a>
                <a href="mining.html" class="mm-link ${isActive('mining')}">Mining</a>
                <a href="mempool.html" class="mm-link ${isActive('mempool')}">Mempool</a>
                <a href="legal.html" class="mm-link ${isActive('legal')}">Legal status</a>
            </div>
            <div class="mm-group">
                <span class="mm-label">Monero</span>
                <a href="hold-monero.html" class="mm-link ${isActive('hold-monero')}">Hold XMR</a>
                <a href="bottom-line.html" class="mm-link ${isActive('bottom-line')}">XMR bottom line</a>
                <a href="community.html" class="mm-link ${isActive('community')}">Community</a>
                <a href="ecosystem.html" class="mm-link ${isActive('ecosystem')}">Ecosystem map</a>
            </div>
        </div>`;

        if (targetId) {
            target.innerHTML = html;
        } else {
            document.body.insertAdjacentHTML('afterbegin', html);
        }

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
    }
};
