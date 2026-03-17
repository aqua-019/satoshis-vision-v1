/* ═══════════════════════════════════════════════════════════════
   GenUI 6-Step Pipeline — xmr.irish C.3.3
   Step 01: Intent Detection (passive)
   Step 02: Context Assembly (CTX object)
   Step 03: Component Scoring
   Step 04: Token Injection (CSS custom properties)
   Step 05: Progressive Render
   Step 06: Feedback Loop (behavioral refinement)
   ═══════════════════════════════════════════════════════════════ */

const GenUI = {
    VERSION: '3.3',
    ctx: {},
    listeners: [],
    _initialized: false,

    /* ── Step 01: Intent Detection ────────────────────────────── */
    detectIntent() {
        const ref = document.referrer || '';
        const url = new URL(window.location.href);
        const utmSource = url.searchParams.get('utm_source') || '';
        const utmMedium = url.searchParams.get('utm_medium') || '';
        const txParam = url.searchParams.get('tx') || '';

        // Referrer analysis
        let referrerType = 'direct';
        if (ref.includes('google.com') || ref.includes('bing.com') || ref.includes('duckduckgo'))
            referrerType = 'search';
        else if (ref.includes('reddit.com') || ref.includes('twitter.com') || ref.includes('x.com'))
            referrerType = 'social-crypto';
        else if (ref.includes('github.com'))
            referrerType = 'developer';
        else if (ref.includes('coinmarketcap') || ref.includes('coingecko') || ref.includes('tradingview'))
            referrerType = 'trader';
        else if (ref.length > 0)
            referrerType = 'external';

        // Device detection
        const ua = navigator.userAgent.toLowerCase();
        let device = 'desktop';
        if (/mobile|android|iphone|ipad/.test(ua)) device = 'mobile';
        else if (/tablet|ipad/.test(ua)) device = 'tablet';

        // OS detection
        let os = 'unknown';
        if (ua.includes('win')) os = 'windows';
        else if (ua.includes('mac')) os = 'macos';
        else if (ua.includes('linux')) os = 'linux';
        else if (ua.includes('android')) os = 'android';
        else if (ua.includes('iphone') || ua.includes('ipad')) os = 'ios';

        // Wallet detection
        let walletDetected = false;
        let walletType = 'none';
        if (typeof window.ethereum !== 'undefined') { walletDetected = true; walletType = 'metamask'; }
        if (typeof window.solana !== 'undefined') { walletDetected = true; walletType = 'phantom'; }

        // Time of day
        const hour = new Date().getHours();
        let timeOfDay = 'morning';
        if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';
        else if (hour >= 17 && hour < 22) timeOfDay = 'evening';
        else if (hour >= 22 || hour < 6) timeOfDay = 'night';

        // Visit history from localStorage
        const visitCount = parseInt(localStorage.getItem('xmr_visits') || '0') + 1;
        localStorage.setItem('xmr_visits', visitCount.toString());
        const lastPage = localStorage.getItem('xmr_lastpage') || '';
        const lastVisit = localStorage.getItem('xmr_lastvisit') || '';
        const lastTrackedTx = localStorage.getItem('xmr_lasttx') || '';
        localStorage.setItem('xmr_lastvisit', new Date().toISOString());
        localStorage.setItem('xmr_lastpage', window.location.pathname);

        // Scroll velocity tracking
        let scrollDepths = JSON.parse(localStorage.getItem('xmr_scrolldepths') || '{}');

        return {
            referrerType, utmSource, utmMedium, txParam,
            device, os, walletDetected, walletType,
            timeOfDay, hour,
            visitCount, lastPage, lastVisit, lastTrackedTx,
            scrollDepths,
            entryTime: Date.now()
        };
    },

    /* ── Step 02: Context Assembly ────────────────────────────── */
    assembleContext(intent) {
        let fluency = 30; // default: curious newcomer

        // Referrer-based fluency
        if (intent.referrerType === 'developer') fluency += 40;
        else if (intent.referrerType === 'trader') fluency += 30;
        else if (intent.referrerType === 'social-crypto') fluency += 20;
        else if (intent.referrerType === 'search') fluency += 0;

        // Visit history fluency
        if (intent.visitCount > 10) fluency += 25;
        else if (intent.visitCount > 3) fluency += 15;
        else if (intent.visitCount > 1) fluency += 5;

        // Wallet detection fluency
        if (intent.walletDetected) fluency += 20;

        // Page history fluency
        if (intent.lastPage.includes('mining')) fluency += 10;
        if (intent.lastPage.includes('dashboard')) fluency += 5;

        // Clamp 0-100
        fluency = Math.max(0, Math.min(100, fluency));

        // Fluency tier
        let tier = 'newcomer';
        if (fluency > 70) tier = 'advanced';
        else if (fluency > 30) tier = 'intermediate';

        // Locale guess from timezone
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        const isUS = tz.startsWith('America/');
        const isEU = tz.startsWith('Europe/');
        const isAsia = tz.startsWith('Asia/');

        this.ctx = {
            ...intent,
            fluency, tier,
            isUS, isEU, isAsia,
            locale: tz,
            page: window.location.pathname.replace(/.*\//, '').replace('.html', '') || 'index'
        };

        return this.ctx;
    },

    /* ── Step 03: Component Scoring ───────────────────────────── */
    scoreComponents(components) {
        const ctx = this.ctx;
        const scored = components.map(comp => {
            let score = comp.baseScore || 50;

            // Fluency matching
            if (comp.targetTier === ctx.tier) score += 30;
            else if (comp.targetTier === 'all') score += 10;

            // Device matching
            if (comp.preferDevice === ctx.device) score += 15;

            // Time-of-day matching
            if (comp.preferTime === ctx.timeOfDay) score += 10;

            // Returning visitor boost
            if (comp.returningBoost && ctx.visitCount > 1) score += 20;

            // Geolocation matching
            if (comp.usOnly && ctx.isUS) score += 15;

            return { ...comp, score };
        });

        return scored.sort((a, b) => b.score - a.score);
    },

    /* ── Step 04: Token Injection ─────────────────────────────── */
    injectTokens() {
        const ctx = this.ctx;
        const root = document.documentElement;

        // Time-of-day dimming
        if (ctx.timeOfDay === 'night') {
            root.style.setProperty('--genui-accent-alpha', '0.85');
            root.style.setProperty('--genui-blob-opacity', '0.025');
            root.style.setProperty('--genui-ring-speed', '1.2');
            root.style.setProperty('--genui-constellation-dist', '90');
        } else {
            root.style.setProperty('--genui-accent-alpha', '1');
            root.style.setProperty('--genui-blob-opacity', '0.035');
            root.style.setProperty('--genui-ring-speed', '1');
            root.style.setProperty('--genui-constellation-dist', '110');
        }

        // Fluency-based tokens
        root.style.setProperty('--genui-fluency', ctx.fluency);
        root.style.setProperty('--genui-tier', `"${ctx.tier}"`);

        // Device tokens
        root.style.setProperty('--genui-device', `"${ctx.device}"`);
        root.style.setProperty('--genui-os', `"${ctx.os}"`);
    },

    /* ── Step 05: Progressive Render ──────────────────────────── */
    render(page) {
        const ctx = this.ctx;

        // Homepage CTA adaptation
        if (page === 'index' || page === '') {
            this.renderHomepageCTAs(ctx);
        }

        // Mining page OS auto-select
        if (page === 'mining') {
            this.renderMiningOS(ctx);
        }

        // Mempool tx pre-fill
        if (page === 'mempool' && ctx.txParam) {
            const input = document.getElementById('txIn');
            if (input) {
                input.value = ctx.txParam;
                setTimeout(() => {
                    if (typeof doSearch === 'function') doSearch();
                }, 500);
            }
        } else if (page === 'mempool' && ctx.lastTrackedTx) {
            const input = document.getElementById('txIn');
            if (input) input.value = ctx.lastTrackedTx;
        }

        // Markets chart default
        if (page === 'markets') {
            this.renderMarketsDefault(ctx);
        }

        // Network chart range
        if (page === 'network') {
            const defaultRange = ctx.visitCount > 1 ? 180 : 7;
            setTimeout(() => {
                if (typeof setR === 'function') setR(null, defaultRange);
            }, 300);
        }

        // Legal status geolocation
        if (page === 'legal') {
            this.renderLegalGeo(ctx);
        }

        // Ecosystem device ordering
        if (page === 'ecosystem') {
            this.renderEcosystemOrder(ctx);
        }

        // Community referrer sorting
        if (page === 'community') {
            this.renderCommunitySorted(ctx);
        }
    },

    /* ── Page-specific renderers ──────────────────────────────── */

    renderHomepageCTAs(ctx) {
        const cta1 = document.getElementById('cta-primary');
        const cta2 = document.getElementById('cta-secondary');
        const cta3 = document.getElementById('cta-tertiary');
        const heroSub = document.getElementById('hero-sub');

        if (!cta1) return;

        if (ctx.tier === 'newcomer') {
            cta1.textContent = 'What is Monero?';
            cta1.href = 'btc-xmr-education.html';
            cta2.textContent = 'The bottom line thesis';
            cta2.href = 'bottom-line.html';
            if (cta3) cta3.style.display = 'none';
            if (heroSub) heroSub.textContent = 'Monero is digital cash that actually works like cash — the sender, receiver, and amount are hidden from everyone. No company controls it. No government can freeze it. It just works.';
        } else if (ctx.tier === 'advanced') {
            cta1.textContent = 'Mine on this device';
            cta1.href = 'mining.html';
            cta2.textContent = 'FCMP++ upgrade status';
            cta2.href = 'future-outlook.html';
            if (cta3) { cta3.textContent = 'Network stats'; cta3.href = 'network.html'; cta3.style.display = ''; }
            if (heroSub) heroSub.textContent = 'Ring-16, Dandelion++, tail emission at 0.6 XMR/block. FCMP++ incoming with 100M+ anonymity set. Hashrate at ATH. The network has never been stronger.';
        } else {
            // intermediate — default as designed
            if (heroSub) heroSub.textContent = 'The only cryptocurrency where every transaction is private by default. No transparent chain. No tainted coins. No surveillance.';
        }
    },

    renderMiningOS(ctx) {
        const osButtons = document.querySelectorAll('[data-os]');
        osButtons.forEach(btn => {
            btn.classList.remove('os-active');
            if (btn.dataset.os === ctx.os) btn.classList.add('os-active');
        });
        // Auto-show correct setup section
        const setupSections = document.querySelectorAll('[data-os-section]');
        setupSections.forEach(sec => {
            sec.style.display = sec.dataset.osSection === ctx.os ? '' : 'none';
        });
        // Fluency-based section ordering
        if (ctx.tier === 'newcomer') {
            const whatIs = document.getElementById('mining-whatis');
            if (whatIs) whatIs.style.display = '';
        } else {
            const whatIs = document.getElementById('mining-whatis');
            if (whatIs) whatIs.style.display = 'none';
        }
    },

    renderMarketsDefault(ctx) {
        if (ctx.lastPage.includes('markets') || ctx.lastPage.includes('dashboard')) {
            // Returning to markets — show BTC/XMR first if they spent time there
            setTimeout(() => {
                const btcxmrBtn = document.querySelector('[data-chart="btcxmr"]');
                if (btcxmrBtn && typeof setM === 'function') setM(btcxmrBtn, 'btcxmr');
            }, 300);
        }
        if (ctx.timeOfDay === 'evening' || ctx.timeOfDay === 'night') {
            setTimeout(() => {
                const compareBtn = document.querySelector('[data-chart="compare"]');
                if (compareBtn && typeof setM === 'function') setM(compareBtn, 'compare');
            }, 300);
        }
    },

    renderLegalGeo(ctx) {
        if (ctx.isUS) {
            const stateGrid = document.getElementById('state-grid');
            const countryGrid = document.getElementById('country-grid');
            if (stateGrid && countryGrid) {
                stateGrid.parentElement.insertBefore(stateGrid, countryGrid);
            }
            // Detect specific state from timezone if possible
            const tzState = this.tzToState(ctx.locale);
            if (tzState) {
                const stateCell = document.querySelector(`[data-state="${tzState}"]`);
                if (stateCell) stateCell.classList.add('geo-highlight');
            }
            // NY auto-expand
            if (ctx.locale.includes('New_York')) {
                const bitlic = document.getElementById('bitlicense-section');
                if (bitlic) bitlic.classList.add('expanded');
            }
        }
    },

    renderEcosystemOrder(ctx) {
        if (ctx.device === 'mobile') {
            const cakeCard = document.querySelector('[data-eco="cakewallet"]');
            if (cakeCard && cakeCard.parentElement) {
                cakeCard.parentElement.insertBefore(cakeCard, cakeCard.parentElement.firstChild);
            }
        }
        if (ctx.walletDetected) {
            const exchSection = document.getElementById('eco-exchanges');
            const walletSection = document.getElementById('eco-wallets-hot');
            if (exchSection && walletSection) {
                walletSection.parentElement.insertBefore(exchSection, walletSection);
            }
        }
    },

    renderCommunitySorted(ctx) {
        const cards = document.querySelectorAll('[data-community]');
        if (!cards.length) return;
        const parent = cards[0].parentElement;
        const sorted = [...cards].sort((a, b) => {
            const aMatch = ctx.referrerType.includes(a.dataset.community) ? -1 : 0;
            const bMatch = ctx.referrerType.includes(b.dataset.community) ? -1 : 0;
            return aMatch - bMatch;
        });
        sorted.forEach(card => parent.appendChild(card));
    },

    tzToState(tz) {
        const map = {
            'America/New_York': 'NY', 'America/Chicago': 'IL', 'America/Denver': 'CO',
            'America/Los_Angeles': 'CA', 'America/Phoenix': 'AZ', 'America/Anchorage': 'AK',
            'Pacific/Honolulu': 'HI', 'America/Detroit': 'MI', 'America/Indiana/Indianapolis': 'IN',
            'America/Kentucky/Louisville': 'KY', 'America/Boise': 'ID'
        };
        return map[tz] || '';
    },

    /* ── Step 06: Feedback Loop ───────────────────────────────── */
    startFeedbackLoop() {
        const ctx = this.ctx;
        let maxScrollDepth = 0;

        // Track scroll depth
        window.addEventListener('scroll', () => {
            const depth = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
            if (depth > maxScrollDepth) {
                maxScrollDepth = depth;
                let depths = JSON.parse(localStorage.getItem('xmr_scrolldepths') || '{}');
                depths[ctx.page] = maxScrollDepth;
                localStorage.setItem('xmr_scrolldepths', JSON.stringify(depths));
            }
        }, { passive: true });

        // Track section dwell time
        const sections = document.querySelectorAll('[data-genui-section]');
        if (sections.length && 'IntersectionObserver' in window) {
            const dwellTimes = {};
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const id = entry.target.dataset.genuiSection;
                    if (entry.isIntersecting) {
                        dwellTimes[id] = Date.now();
                    } else if (dwellTimes[id]) {
                        const time = Date.now() - dwellTimes[id];
                        // If user dwelt >30s on education section, decrease fluency for next visit
                        if (id === 'pillars' && time > 30000) {
                            const currentFluency = parseInt(localStorage.getItem('xmr_fluency_adj') || '0');
                            localStorage.setItem('xmr_fluency_adj', Math.max(currentFluency - 5, -20).toString());
                        }
                        // If user quickly passes education, increase fluency
                        if (id === 'pillars' && time < 3000) {
                            const currentFluency = parseInt(localStorage.getItem('xmr_fluency_adj') || '0');
                            localStorage.setItem('xmr_fluency_adj', Math.min(currentFluency + 5, 20).toString());
                        }
                        delete dwellTimes[id];
                    }
                });
            }, { threshold: 0.3 });
            sections.forEach(sec => observer.observe(sec));
        }

        // Track hover on metric cells (for network page reordering)
        document.querySelectorAll('[data-metric-id]').forEach(cell => {
            cell.addEventListener('mouseenter', () => {
                let hovered = JSON.parse(localStorage.getItem('xmr_metric_hovers') || '{}');
                const id = cell.dataset.metricId;
                hovered[id] = (hovered[id] || 0) + 1;
                localStorage.setItem('xmr_metric_hovers', JSON.stringify(hovered));
            });
        });
    },

    /* ── 3D Mouse Tracking (global) ───────────────────────────── */
    init3DCards() {
        document.querySelectorAll('.bub, .orb, .mc, .eco-card, .lc, .rt, .ft-c, .inf-c').forEach(el => {
            el.addEventListener('mousemove', (e) => {
                const r = el.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width - 0.5;
                const y = (e.clientY - r.top) / r.height - 0.5;
                el.style.transform = `perspective(500px) rotateY(${(x * 12).toFixed(1)}deg) rotateX(${(-y * 10).toFixed(1)}deg) scale(1.02)`;
            });
            el.addEventListener('mouseleave', () => {
                el.style.transform = '';
            });
        });
    },

    /* ── Canvas Constellation ─────────────────────────────────── */
    initConstellation(canvasId) {
        const c = document.getElementById(canvasId);
        if (!c) return;
        const ctx = c.getContext('2d');
        const dist = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--genui-constellation-dist')) || 110;

        function resize() { c.width = c.parentElement.offsetWidth; c.height = c.parentElement.offsetHeight; }
        resize();
        window.addEventListener('resize', resize);

        const nodes = [];
        for (let i = 0; i < 30; i++) {
            nodes.push({
                x: Math.random() * c.width, y: Math.random() * c.height,
                vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
                r: Math.random() * 1.5 + 0.5
            });
        }

        function draw() {
            ctx.clearRect(0, 0, c.width, c.height);
            for (let i = 0; i < nodes.length; i++) {
                const n = nodes[i];
                n.x += n.vx; n.y += n.vy;
                if (n.x < 0 || n.x > c.width) n.vx *= -1;
                if (n.y < 0 || n.y > c.height) n.vy *= -1;
                ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,102,0,.12)'; ctx.fill();
                for (let j = i + 1; j < nodes.length; j++) {
                    const m = nodes[j];
                    const dx = n.x - m.x, dy = n.y - m.y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < dist) {
                        ctx.beginPath(); ctx.moveTo(n.x, n.y); ctx.lineTo(m.x, m.y);
                        ctx.strokeStyle = `rgba(255,102,0,${(0.04 * (1 - d / dist)).toFixed(3)})`;
                        ctx.lineWidth = 0.5; ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(draw);
        }
        draw();
    },

    /* ── Master Init ──────────────────────────────────────────── */
    init() {
        if (this._initialized) return;
        this._initialized = true;

        // Apply fluency adjustment from feedback loop
        const fluencyAdj = parseInt(localStorage.getItem('xmr_fluency_adj') || '0');

        const intent = this.detectIntent();
        const ctx = this.assembleContext(intent);
        ctx.fluency = Math.max(0, Math.min(100, ctx.fluency + fluencyAdj));

        // Re-tier after adjustment
        if (ctx.fluency > 70) ctx.tier = 'advanced';
        else if (ctx.fluency > 30) ctx.tier = 'intermediate';
        else ctx.tier = 'newcomer';

        this.injectTokens();
        this.render(ctx.page);
        this.startFeedbackLoop();

        // Init 3D cards after DOM settles
        requestAnimationFrame(() => this.init3DCards());

        // Init constellation if canvas exists
        if (document.getElementById('constellation')) {
            this.initConstellation('constellation');
        }

        console.log(`[GenUI ${this.VERSION}] tier=${ctx.tier} fluency=${ctx.fluency} device=${ctx.device} os=${ctx.os} visits=${ctx.visitCount}`);
    }
};

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', () => GenUI.init());
