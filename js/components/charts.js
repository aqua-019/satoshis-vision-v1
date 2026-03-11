/* ============================================
   SATOSHI'S VISION — Charts Module
   Lightweight chart rendering using Canvas API
   No external dependencies
   ============================================ */

const Charts = {

    /* === Full Price Chart === */
    async createPriceChart(containerId, coinId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const config = {
            days: options.days || 30,
            height: options.height || 300,
            color: options.color || '255, 102, 0',
            showVolume: options.showVolume !== false,
            showTooltip: options.showTooltip !== false,
            ...options
        };

        // Build UI
        container.innerHTML = `
            <div class="chart-widget">
                <div class="chart-widget__controls">
                    <div class="chart-widget__timeframes">
                        <button class="btn btn--ghost btn--sm" data-days="1">24H</button>
                        <button class="btn btn--ghost btn--sm" data-days="7">7D</button>
                        <button class="btn btn--ghost btn--sm active" data-days="30">30D</button>
                        <button class="btn btn--ghost btn--sm" data-days="90">90D</button>
                        <button class="btn btn--ghost btn--sm" data-days="365">1Y</button>
                        <button class="btn btn--ghost btn--sm" data-days="max">ALL</button>
                    </div>
                </div>
                <div class="chart-widget__canvas-wrap" style="position:relative;height:${config.height}px">
                    <canvas id="chart-main-${coinId}"></canvas>
                    <div class="chart-widget__tooltip" id="tooltip-${coinId}" style="display:none"></div>
                    <div class="chart-widget__loading animate-pulse" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--text-tertiary);font-family:var(--font-mono);font-size:var(--text-xs)">Loading chart data...</div>
                </div>
                ${config.showVolume ? `
                    <div class="chart-widget__volume-wrap" style="height:60px">
                        <canvas id="volume-${coinId}"></canvas>
                    </div>
                ` : ''}
            </div>
        `;

        // Timeframe buttons
        container.querySelectorAll('[data-days]').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('[data-days]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const days = btn.dataset.days;
                this.loadChartData(containerId, coinId, days === 'max' ? 'max' : parseInt(days), config);
            });
        });

        await this.loadChartData(containerId, coinId, config.days, config);
    },

    async loadChartData(containerId, coinId, days, config) {
        const container = document.getElementById(containerId);
        const loading = container?.querySelector('.chart-widget__loading');
        if (loading) loading.style.display = 'flex';

        try {
            const interval = days === 'max' || days > 90 ? 'daily' : days > 1 ? 'hourly' : '';
            const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}${interval ? '&interval=' + interval : ''}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('chart data fetch failed');
            const data = await res.json();

            if (loading) loading.style.display = 'none';

            this.renderPriceCanvas(
                container.querySelector(`#chart-main-${coinId}`),
                data.prices,
                config,
                container.querySelector(`#tooltip-${coinId}`)
            );

            if (config.showVolume && data.total_volumes) {
                this.renderVolumeCanvas(
                    container.querySelector(`#volume-${coinId}`),
                    data.total_volumes,
                    config
                );
            }
        } catch (e) {
            console.warn('Chart data error:', e);
            if (loading) loading.textContent = 'Chart data unavailable';
        }
    },

    renderPriceCanvas(canvas, priceData, config, tooltipEl) {
        if (!canvas || !priceData?.length) return;

        const ctx = canvas.getContext('2d');
        const wrap = canvas.parentElement;
        const width = wrap.offsetWidth;
        const height = wrap.offsetHeight;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        const prices = priceData.map(p => p[1]);
        const timestamps = priceData.map(p => p[0]);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        const range = max - min || 1;
        const isUp = prices[prices.length - 1] >= prices[0];
        const color = config.color || (isUp ? '0, 211, 149' : '255, 71, 87');

        const padTop = 20;
        const padBottom = 30;
        const padLeft = 60;
        const padRight = 20;
        const chartW = width - padLeft - padRight;
        const chartH = height - padTop - padBottom;

        ctx.clearRect(0, 0, width, height);

        // Y-axis labels
        const ySteps = 5;
        ctx.font = `10px "JetBrains Mono", monospace`;
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.textAlign = 'right';
        for (let i = 0; i <= ySteps; i++) {
            const val = min + (range * i / ySteps);
            const y = padTop + chartH - (chartH * i / ySteps);
            ctx.fillText('$' + val.toLocaleString(undefined, { maximumFractionDigits: val > 1000 ? 0 : 2 }), padLeft - 8, y + 3);

            // Grid line
            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(width - padRight, y);
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // X-axis labels
        const xLabelCount = Math.min(6, prices.length);
        ctx.textAlign = 'center';
        for (let i = 0; i < xLabelCount; i++) {
            const idx = Math.floor(i * (timestamps.length - 1) / (xLabelCount - 1));
            const x = padLeft + (idx / (prices.length - 1)) * chartW;
            const date = new Date(timestamps[idx]);
            const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            ctx.fillText(label, x, height - 8);
        }

        // Gradient fill
        const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
        gradient.addColorStop(0, `rgba(${color}, 0.2)`);
        gradient.addColorStop(1, `rgba(${color}, 0)`);

        ctx.beginPath();
        ctx.moveTo(padLeft, padTop + chartH);
        prices.forEach((price, i) => {
            const x = padLeft + (i / (prices.length - 1)) * chartW;
            const y = padTop + chartH - ((price - min) / range) * chartH;
            ctx.lineTo(x, y);
        });
        ctx.lineTo(padLeft + chartW, padTop + chartH);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Price line
        ctx.beginPath();
        prices.forEach((price, i) => {
            const x = padLeft + (i / (prices.length - 1)) * chartW;
            const y = padTop + chartH - ((price - min) / range) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = `rgb(${color})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Interactive tooltip
        if (tooltipEl) {
            canvas.style.cursor = 'crosshair';
            canvas.onmousemove = (e) => {
                const rect = canvas.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;

                if (mx < padLeft || mx > width - padRight) {
                    tooltipEl.style.display = 'none';
                    return;
                }

                const idx = Math.round(((mx - padLeft) / chartW) * (prices.length - 1));
                const clampedIdx = Math.max(0, Math.min(prices.length - 1, idx));
                const price = prices[clampedIdx];
                const date = new Date(timestamps[clampedIdx]);
                const x = padLeft + (clampedIdx / (prices.length - 1)) * chartW;
                const y = padTop + chartH - ((price - min) / range) * chartH;

                tooltipEl.style.display = 'block';
                tooltipEl.style.left = `${x}px`;
                tooltipEl.style.top = `${y - 50}px`;
                tooltipEl.style.transform = 'translateX(-50%)';
                tooltipEl.innerHTML = `
                    <div style="background:var(--bg-surface);border:1px solid var(--border-default);padding:6px 10px;border-radius:var(--radius-sm);font-family:var(--font-mono);font-size:11px;white-space:nowrap">
                        <div style="color:var(--text-primary);font-weight:600">$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        <div style="color:var(--text-tertiary)">${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                    </div>
                `;

                // Crosshair
                // Redraw chart and add crosshair (simplified - just draw vertical line)
            };

            canvas.onmouseleave = () => {
                tooltipEl.style.display = 'none';
            };
        }
    },

    renderVolumeCanvas(canvas, volumeData, config) {
        if (!canvas || !volumeData?.length) return;

        const ctx = canvas.getContext('2d');
        const wrap = canvas.parentElement;
        const width = wrap.offsetWidth;
        const height = 60;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        const volumes = volumeData.map(v => v[1]);
        const maxVol = Math.max(...volumes);
        const padLeft = 60;
        const padRight = 20;
        const chartW = width - padLeft - padRight;
        const barWidth = Math.max(1, (chartW / volumes.length) - 1);

        ctx.clearRect(0, 0, width, height);

        volumes.forEach((vol, i) => {
            const x = padLeft + (i / volumes.length) * chartW;
            const barH = (vol / maxVol) * (height - 10);
            const y = height - barH;

            ctx.fillStyle = `rgba(${config.color || '255, 102, 0'}, 0.3)`;
            ctx.fillRect(x, y, barWidth, barH);
        });
    },

    /* === Comparison Bar Chart === */
    createComparisonBars(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="chart-bars">
                ${data.map(item => {
                    const pct = (item.value / Math.max(...data.map(d => d.value))) * 100;
                    return `
                        <div class="chart-bars__item" data-animate>
                            <div class="chart-bars__label">
                                <span>${item.label}</span>
                                <span style="color:${item.color || 'var(--text-primary)'}">${item.display || item.value}</span>
                            </div>
                            <div class="chart-bars__track">
                                <div class="chart-bars__fill" style="width:${pct}%;background:${item.color || 'var(--xmr-orange)'}"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        App.initScrollAnimations();
    }
};
