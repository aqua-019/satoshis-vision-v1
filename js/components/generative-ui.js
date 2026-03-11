/* ============================================
   SATOSHI'S VISION — Generative UI Engine
   Data-driven, adaptive UI components that
   generate layouts based on live data and context
   ============================================ */

const GenerativeUI = {

    /* === Particle Background === */
    createParticles(canvasId, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const particles = [];
        const config = {
            count: options.count || 60,
            color: options.color || '255, 102, 0',
            maxSize: options.maxSize || 2,
            speed: options.speed || 0.3,
            connectDistance: options.connectDistance || 120,
            ...options
        };

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        class Particle {
            constructor() {
                this.reset();
            }
            reset() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * config.maxSize + 0.5;
                this.vx = (Math.random() - 0.5) * config.speed;
                this.vy = (Math.random() - 0.5) * config.speed;
                this.opacity = Math.random() * 0.5 + 0.2;
            }
            update() {
                this.x += this.vx;
                this.y += this.vy;
                if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
                if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
            }
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${config.color}, ${this.opacity})`;
                ctx.fill();
            }
        }

        for (let i = 0; i < config.count; i++) {
            particles.push(new Particle());
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.update();
                p.draw();
            });

            // Connect nearby particles
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < config.connectDistance) {
                        const opacity = (1 - dist / config.connectDistance) * 0.15;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(${config.color}, ${opacity})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }

            requestAnimationFrame(animate);
        }
        animate();
    },

    /* === Dynamic Price Card Generator === */
    createPriceCard(containerId, coinId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const config = {
            showChart: options.showChart !== false,
            showStats: options.showStats !== false,
            theme: options.theme || 'xmr',
            ...options
        };

        const accentColor = config.theme === 'btc' ? 'var(--btc-orange)' : 'var(--xmr-orange)';

        container.innerHTML = `
            <div class="gen-price-card" data-coin="${coinId}" style="--accent: ${accentColor}">
                <div class="gen-price-card__header">
                    <div class="gen-price-card__info">
                        <h3 class="gen-price-card__name skeleton skeleton--text" data-field="name">Loading...</h3>
                        <span class="gen-price-card__symbol badge badge--${config.theme}" data-field="symbol">...</span>
                    </div>
                    <div class="gen-price-card__price-wrap">
                        <span class="gen-price-card__price" data-field="price">$--</span>
                        <span class="gen-price-card__change" data-field="change">--%</span>
                    </div>
                </div>
                ${config.showChart ? `
                    <div class="gen-price-card__chart">
                        <canvas id="chart-${coinId}" height="120"></canvas>
                    </div>
                ` : ''}
                ${config.showStats ? `
                    <div class="gen-price-card__stats">
                        <div class="gen-price-card__stat">
                            <span class="gen-price-card__stat-label">Market Cap</span>
                            <span class="gen-price-card__stat-value" data-field="market_cap">--</span>
                        </div>
                        <div class="gen-price-card__stat">
                            <span class="gen-price-card__stat-label">24h Volume</span>
                            <span class="gen-price-card__stat-value" data-field="volume">--</span>
                        </div>
                        <div class="gen-price-card__stat">
                            <span class="gen-price-card__stat-label">24h High</span>
                            <span class="gen-price-card__stat-value" data-field="high_24h">--</span>
                        </div>
                        <div class="gen-price-card__stat">
                            <span class="gen-price-card__stat-label">24h Low</span>
                            <span class="gen-price-card__stat-value" data-field="low_24h">--</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        this.fetchCoinData(coinId, container);
    },

    async fetchCoinData(coinId, container) {
        try {
            const res = await fetch(
                `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
            );
            if (!res.ok) throw new Error('fetch failed');
            const data = await res.json();

            const card = container.querySelector('.gen-price-card');
            if (!card) return;

            const setField = (field, value) => {
                const el = card.querySelector(`[data-field="${field}"]`);
                if (el) {
                    el.textContent = value;
                    el.classList.remove('skeleton', 'skeleton--text');
                }
            };

            setField('name', data.name);
            setField('symbol', data.symbol.toUpperCase());
            setField('price', App.formatPrice(data.market_data.current_price.usd));

            const change = data.market_data.price_change_percentage_24h || 0;
            const changeEl = card.querySelector('[data-field="change"]');
            if (changeEl) {
                changeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
                changeEl.className = `gen-price-card__change ${change >= 0 ? 'ticker__change--up' : 'ticker__change--down'}`;
            }

            setField('market_cap', '$' + App.formatNumber(data.market_data.market_cap.usd));
            setField('volume', '$' + App.formatNumber(data.market_data.total_volume.usd));
            setField('high_24h', App.formatPrice(data.market_data.high_24h.usd));
            setField('low_24h', App.formatPrice(data.market_data.low_24h.usd));

            // Fetch sparkline for chart
            this.fetchSparkline(coinId, card);

        } catch (e) {
            console.warn('Coin data fetch error:', e);
        }
    },

    async fetchSparkline(coinId, card) {
        try {
            const res = await fetch(
                `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=7&interval=daily`
            );
            if (!res.ok) throw new Error('sparkline fetch failed');
            const data = await res.json();

            const canvas = card.querySelector(`#chart-${coinId}`);
            if (!canvas || !data.prices?.length) return;

            this.drawSparkline(canvas, data.prices.map(p => p[1]));
        } catch (e) {
            console.warn('Sparkline fetch error:', e);
        }
    },

    drawSparkline(canvas, prices) {
        const ctx = canvas.getContext('2d');
        const width = canvas.parentElement.offsetWidth;
        const height = 120;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min || 1;
        const isUp = prices[prices.length - 1] >= prices[0];

        const color = isUp ? '0, 211, 149' : '255, 71, 87';
        const padding = 4;

        ctx.clearRect(0, 0, width, height);

        // Gradient fill
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, `rgba(${color}, 0.15)`);
        gradient.addColorStop(1, `rgba(${color}, 0)`);

        ctx.beginPath();
        ctx.moveTo(padding, height - padding);

        prices.forEach((price, i) => {
            const x = padding + (i / (prices.length - 1)) * (width - 2 * padding);
            const y = padding + (1 - (price - min) / range) * (height - 2 * padding);
            ctx.lineTo(x, y);
        });

        ctx.lineTo(width - padding, height - padding);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Line
        ctx.beginPath();
        prices.forEach((price, i) => {
            const x = padding + (i / (prices.length - 1)) * (width - 2 * padding);
            const y = padding + (1 - (price - min) / range) * (height - 2 * padding);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = `rgb(${color})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // End dot
        const lastX = width - padding;
        const lastY = padding + (1 - (prices[prices.length - 1] - min) / range) * (height - 2 * padding);
        ctx.beginPath();
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${color})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(lastX, lastY, 7, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${color}, 0.3)`;
        ctx.lineWidth = 2;
        ctx.stroke();
    },

    /* === Comparison Matrix Generator === */
    createComparisonMatrix(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const categories = data.categories || [];
        const items = data.items || [];

        let html = `<div class="gen-matrix">`;
        html += `<div class="gen-matrix__header">`;
        html += `<div class="gen-matrix__label"></div>`;
        items.forEach(item => {
            html += `<div class="gen-matrix__col-header" style="color: ${item.color || 'var(--text-primary)'}">
                <span class="gen-matrix__icon">${item.icon || ''}</span>
                <span>${item.name}</span>
            </div>`;
        });
        html += `</div>`;

        categories.forEach(cat => {
            html += `<div class="gen-matrix__row" data-animate>`;
            html += `<div class="gen-matrix__label">
                <span class="gen-matrix__cat-name">${cat.name}</span>
                <span class="gen-matrix__cat-desc">${cat.description || ''}</span>
            </div>`;
            items.forEach(item => {
                const val = cat.values?.[item.id] || {};
                const statusClass = val.status === 'good' ? 'gen-matrix__cell--good' :
                                   val.status === 'bad' ? 'gen-matrix__cell--bad' :
                                   val.status === 'neutral' ? 'gen-matrix__cell--neutral' : '';
                html += `<div class="gen-matrix__cell ${statusClass}">
                    <span class="gen-matrix__cell-value">${val.text || '—'}</span>
                    ${val.detail ? `<span class="gen-matrix__cell-detail">${val.detail}</span>` : ''}
                </div>`;
            });
            html += `</div>`;
        });

        html += `</div>`;
        container.innerHTML = html;

        // Re-init scroll animations for new elements
        App.initScrollAnimations();
    },

    /* === Ecosystem Grid Generator === */
    createEcosystemGrid(containerId, items, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const filterTags = [...new Set(items.flatMap(i => i.tags || []))];

        let html = `
            <div class="gen-ecosystem">
                <div class="gen-ecosystem__filters">
                    <button class="btn btn--ghost btn--sm active" data-filter="all">All</button>
                    ${filterTags.map(tag =>
                        `<button class="btn btn--ghost btn--sm" data-filter="${tag}">${tag}</button>`
                    ).join('')}
                </div>
                <div class="gen-ecosystem__grid grid grid--auto">
                    ${items.map(item => `
                        <a href="${item.url || '#'}" target="${item.url ? '_blank' : '_self'}"
                           class="gen-ecosystem__item card card--glass" data-tags="${(item.tags || []).join(',')}" data-animate>
                            <div class="gen-ecosystem__item-header">
                                <span class="gen-ecosystem__item-icon">${item.icon || ''}</span>
                                <h4 class="gen-ecosystem__item-name">${item.name}</h4>
                            </div>
                            <p class="gen-ecosystem__item-desc">${item.description || ''}</p>
                            <div class="gen-ecosystem__item-tags">
                                ${(item.tags || []).map(t =>
                                    `<span class="badge badge--outline">${t}</span>`
                                ).join('')}
                            </div>
                        </a>
                    `).join('')}
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Filter functionality
        container.querySelectorAll('[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                container.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                container.querySelectorAll('.gen-ecosystem__item').forEach(item => {
                    const tags = item.dataset.tags.split(',');
                    const show = filter === 'all' || tags.includes(filter);
                    item.style.display = show ? '' : 'none';
                });
            });
        });

        App.initScrollAnimations();
    },

    /* === Live Stats Dashboard Generator === */
    createStatsDashboard(containerId, stats) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="gen-stats grid grid--auto-sm">
                ${stats.map(stat => `
                    <div class="gen-stats__item card" data-animate>
                        <div class="gen-stats__icon" style="color: ${stat.color || 'var(--xmr-orange)'}">${stat.icon || ''}</div>
                        <div class="gen-stats__value" style="color: ${stat.color || 'var(--xmr-orange)'}">${stat.value}</div>
                        <div class="gen-stats__label">${stat.label}</div>
                        ${stat.sublabel ? `<div class="gen-stats__sublabel">${stat.sublabel}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;

        App.initScrollAnimations();
    },

    /* === Adaptive Info Cards === */
    createInfoCards(containerId, cards) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="grid grid--auto">
                ${cards.map((card, i) => `
                    <div class="card card--glass" data-animate data-delay="${i * 100}">
                        <div style="display:flex;align-items:center;gap:var(--space-3);margin-bottom:var(--space-4)">
                            <span style="font-size:1.5rem">${card.icon || ''}</span>
                            <h3 style="font-size:var(--text-lg)">${card.title}</h3>
                        </div>
                        <p style="font-size:var(--text-sm);line-height:var(--leading-relaxed)">${card.text}</p>
                        ${card.highlight ? `
                            <div style="margin-top:var(--space-4);padding:var(--space-3);background:rgba(255,102,0,0.08);border-left:2px solid var(--xmr-orange);font-family:var(--font-mono);font-size:var(--text-xs);color:var(--xmr-orange)">
                                ${card.highlight}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;

        App.initScrollAnimations();
    }
};
