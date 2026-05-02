/**
 * SVG fallback renderer.
 *
 * Used when WebGL is unavailable. Renders the same scene with degraded
 * fidelity (no shaders, no particle systems, no additive blending) but
 * preserves the educational content. The DOM elements double as
 * inspector targets — interactions just listen on the SVG nodes.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function resolveCssColor(c, fallback = '#FF6600') {
    if (typeof c !== 'string') return fallback;
    const match = c.match(/^var\((--[a-z0-9-]+)\)$/i);
    if (!match) return c;
    const computed = getComputedStyle(document.documentElement);
    return computed.getPropertyValue(match[1]).trim() || fallback;
}

export class SVGRenderer {
    constructor(mountEl, spec) {
        this.mountEl = mountEl;
        this.spec = spec;
        this.canvas = mountEl.querySelector('.genui-canvas');

        if (!this.canvas) {
            throw new Error('GenUI SVGRenderer: no .genui-canvas in mount');
        }

        const { width, height } = this.canvas.getBoundingClientRect();
        this.viewWidth = Math.max(800, width);
        this.viewHeight = Math.max(400, height);

        this.svg = document.createElementNS(SVG_NS, 'svg');
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', '100%');
        this.svg.setAttribute('viewBox', `0 0 ${this.viewWidth} ${this.viewHeight}`);
        this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        this.svg.style.position = 'absolute';
        this.svg.style.inset = '0';

        const container = mountEl.querySelector('.genui-canvas-container');
        if (container) container.appendChild(this.svg);
        else mountEl.appendChild(this.svg);

        this.actorNodes = new Map();
        this.actorOverlayElements = new Map();
        this.overlayEl = mountEl.querySelector('.genui-overlay');
    }

    update(sceneGraph) {
        for (const node of sceneGraph.nodes) {
            if (!this.actorNodes.has(node.id)) {
                if ((node.opacity ?? 0) <= 0.001
                    && !(node.interactive || (node.labels && node.labels.length))) {
                    continue;
                }
                const el = this.createNode(node);
                if (el) {
                    this.svg.appendChild(el);
                    this.actorNodes.set(node.id, el);
                    this.createOverlayElement(node);
                }
            } else {
                this.updateNode(this.actorNodes.get(node.id), node);
                this.updateOverlayElement(node);
            }
        }
    }

    createNode(node) {
        switch (node.type) {
            case 'circle':       return this._createCircle(node);
            case 'ring':         return this._createRingNode(node);
            case 'instanced':    return this._createInstancedBlocks(node);
            case 'instanced-points': return this._createInstancedPoints(node);
            case 'path':         return this._createPath(node);
            case 'rect':         return this._createRect(node);
            case 'text':         return this._createText(node);
            case 'graph-edge':   return this._createGraphEdges(node);
            case 'particle-trail': return this._createParticleTrail(node);
            case 'particle-burst': return this._createParticleBurst(node);
            case 'comparison-bar': return this._createComparisonBar(node);
            case 'pedersen-blob': return this._createPedersenBlob(node);
            case 'range-proof-band': return this._createRangeProofBand(node);
            case 'signature-trail': return this._createSignatureTrail(node);
            case 'ring-boundary': return this._createRingBoundary(node);
            case 'ghost-overlay': return this._createGhostOverlay(node);
            default:             return null;
        }
    }

    _createCircle(node) {
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('r', String(node.r ?? 8));
        c.setAttribute('fill', resolveCssColor(node.fill || 'var(--xmr)'));
        if (node.stroke) c.setAttribute('stroke', resolveCssColor(node.stroke));
        if (node.strokeWidth) c.setAttribute('stroke-width', String(node.strokeWidth));
        this._applyPosition(c, node);
        c.setAttribute('opacity', String(node.opacity ?? 1));
        return c;
    }

    _createRingNode(node) {
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('r', String(node.r ?? 14));
        c.setAttribute('fill', 'transparent');
        c.setAttribute('stroke', resolveCssColor(node.stroke || 'var(--gold)', '#FFD700'));
        c.setAttribute('stroke-width', String(node.strokeWidth ?? 2));
        this._applyPosition(c, node);
        c.setAttribute('opacity', String(node.opacity ?? 0));
        return c;
    }

    _createInstancedBlocks(node) {
        const group = document.createElementNS(SVG_NS, 'g');
        const count = Math.max(1, node.blockCount || 720);
        const fill = resolveCssColor(node.fill || 'var(--surface-2)', '#1A1A1E');
        const yPct = 0.88;
        const blockWidthPct = 0.92 / count;
        for (let i = 0; i < count; i++) {
            const r = document.createElementNS(SVG_NS, 'rect');
            const x = (0.04 + i * blockWidthPct) * this.viewWidth;
            r.setAttribute('x', String(x));
            r.setAttribute('y', String((yPct - 0.02) * this.viewHeight));
            r.setAttribute('width', String(blockWidthPct * this.viewWidth * 0.85));
            r.setAttribute('height', String(0.04 * this.viewHeight));
            r.setAttribute('fill', fill);
            group.appendChild(r);
        }
        group.setAttribute('opacity', String(node.opacity ?? 0));
        return group;
    }

    _createInstancedPoints(node) {
        const group = document.createElementNS(SVG_NS, 'g');
        /* Reduce count for SVG fidelity */
        const count = Math.min(800, node.count || 800);
        const fill = resolveCssColor(node.fill || 'var(--xmr)', '#FF6600');
        for (let i = 0; i < count; i++) {
            const ageDays = Math.exp(Math.log(0.5) + Math.random() * (Math.log(1825) - Math.log(0.5)));
            const minLog = Math.log(0.5);
            const maxLog = Math.log(1825);
            const t = (Math.log(ageDays) - minLog) / (maxLog - minLog);
            const cx = (0.95 - t * 0.85) * this.viewWidth;
            const cy = (0.30 + Math.random() * 0.50) * this.viewHeight;
            const dot = document.createElementNS(SVG_NS, 'circle');
            dot.setAttribute('cx', String(cx));
            dot.setAttribute('cy', String(cy));
            dot.setAttribute('r', '1.4');
            dot.setAttribute('fill', fill);
            dot.setAttribute('opacity', String(0.25 + (1 - t) * 0.3));
            group.appendChild(dot);
        }
        group.setAttribute('opacity', String(node.opacity ?? 0));
        return group;
    }

    _createPath(node) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('stroke', resolveCssColor(node.stroke || 'var(--xmr)', '#FF6600'));
        path.setAttribute('stroke-width', String(node.strokeWidth ?? 2));
        path.setAttribute('fill', node.fill || 'none');
        path.setAttribute('opacity', String(node.opacity ?? 1));
        path.setAttribute('d', this._buildDensityPath(node.drawProgress ?? 0, node.meanDays ?? 7, node.sigma ?? 0.5));
        return path;
    }

    _buildDensityPath(progress, meanDays, sigma) {
        const N = 120;
        const limit = Math.max(2, Math.floor(N * Math.max(0, Math.min(1, progress))));
        const lnMean = Math.log(meanDays * 86400);

        let pdfMax = 0;
        for (let i = 0; i < N; i++) {
            const t = i / (N - 1);
            const ageS = Math.exp(Math.log(0.5 * 86400) + t * (Math.log(1825 * 86400) - Math.log(0.5 * 86400)));
            const lnX = Math.log(Math.max(1, ageS));
            const pdf = Math.exp(-Math.pow(lnX - lnMean, 2) / (2 * sigma * sigma)) / (ageS * sigma * Math.sqrt(2 * Math.PI));
            if (pdf > pdfMax) pdfMax = pdf;
        }
        if (pdfMax === 0) pdfMax = 1;

        let d = '';
        for (let i = 0; i < limit; i++) {
            const t = i / (N - 1);
            const ageS = Math.exp(Math.log(0.5 * 86400) + t * (Math.log(1825 * 86400) - Math.log(0.5 * 86400)));
            const lnX = Math.log(Math.max(1, ageS));
            const pdf = Math.exp(-Math.pow(lnX - lnMean, 2) / (2 * sigma * sigma)) / (ageS * sigma * Math.sqrt(2 * Math.PI));
            const cy = 0.86 - (pdf / pdfMax) * 0.46;
            const cx = 0.95 - (1 - t) * 0.85;
            d += (i === 0 ? 'M' : 'L') + (cx * this.viewWidth).toFixed(2) + ' ' + (cy * this.viewHeight).toFixed(2) + ' ';
        }
        return d.trim() || 'M0 0';
    }

    _createGraphEdges(node) {
        const group = document.createElementNS(SVG_NS, 'g');
        const stroke = resolveCssColor(node.stroke || 'var(--xmr)', '#FF6600');
        const stemStroke = resolveCssColor(node.stemStroke || node.stroke || 'var(--xmr)', '#FF6600');
        const strokeWidth = node.strokeWidth ?? 1;
        for (const e of (node.edges || [])) {
            const line = document.createElementNS(SVG_NS, 'line');
            line.setAttribute('x1', String(e.from.cx * this.viewWidth));
            line.setAttribute('y1', String(e.from.cy * this.viewHeight));
            line.setAttribute('x2', String(e.to.cx * this.viewWidth));
            line.setAttribute('y2', String(e.to.cy * this.viewHeight));
            line.setAttribute('stroke', e.isStem ? stemStroke : stroke);
            line.setAttribute('stroke-width', String(strokeWidth));
            line.setAttribute('opacity', String(e.isStem ? 0.42 : 0.18));
            group.appendChild(line);
        }
        group.setAttribute('opacity', String(node.opacity ?? 0));
        return group;
    }

    _createParticleTrail(node) {
        /* SVG fallback: single dot — no trail. Documented degradation. */
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('r', String(node.r ?? 7));
        c.setAttribute('fill', resolveCssColor(node.fill || 'var(--xmr)', '#FF6600'));
        c.setAttribute('cx', String((node.cx ?? 0.5) * this.viewWidth));
        c.setAttribute('cy', String((node.cy ?? 0.5) * this.viewHeight));
        c.setAttribute('opacity', String(node.opacity ?? 1));
        return c;
    }

    _createParticleBurst(node) {
        /* SVG fallback: static starburst of short lines. */
        const group = document.createElementNS(SVG_NS, 'g');
        const count = node.particleCount || 80;
        const fill = resolveCssColor(node.fill || 'var(--xmr)', '#FF6600');
        const cxPx = (node.cx ?? 0.5) * this.viewWidth;
        const cyPx = (node.cy ?? 0.5) * this.viewHeight;
        const r1 = 6;
        const r2 = 32;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const line = document.createElementNS(SVG_NS, 'line');
            line.setAttribute('x1', String(cxPx + Math.cos(angle) * r1));
            line.setAttribute('y1', String(cyPx + Math.sin(angle) * r1));
            line.setAttribute('x2', String(cxPx + Math.cos(angle) * r2));
            line.setAttribute('y2', String(cyPx + Math.sin(angle) * r2));
            line.setAttribute('stroke', fill);
            line.setAttribute('stroke-width', '1');
            line.setAttribute('opacity', '0.6');
            group.appendChild(line);
        }
        group.setAttribute('opacity', String(node.opacity ?? 0));
        return group;
    }

    _createComparisonBar(node) {
        const r = document.createElementNS(SVG_NS, 'rect');
        const anchorX = node.anchorX ?? 0.10;
        const barWidth = Math.max(0, node.barWidth ?? 0);
        const heightFrac = node.height ?? 0.04;
        const cyFrac = node.cy ?? 0.85;
        r.setAttribute('x', String(anchorX * this.viewWidth));
        r.setAttribute('y', String((cyFrac - heightFrac / 2) * this.viewHeight));
        r.setAttribute('width', String(barWidth * this.viewWidth));
        r.setAttribute('height', String(heightFrac * this.viewHeight));
        r.setAttribute('fill', resolveCssColor(node.fill || node.color || 'var(--xmr)', '#FF6600'));
        r.setAttribute('opacity', String(node.opacity ?? 1));
        r.dataset.barType = 'comparison-bar';
        return r;
    }

    _createPedersenBlob(node) {
        /* SVG fallback: a plain disc — no shader noise, but the colour stays right. */
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('r', String(node.r ?? 18));
        c.setAttribute('fill', resolveCssColor(node.fill || 'var(--xmr)', '#FF6600'));
        c.setAttribute('cx', String((node.cx ?? 0.5) * this.viewWidth));
        c.setAttribute('cy', String((node.cy ?? 0.5) * this.viewHeight));
        c.setAttribute('opacity', String(node.opacity ?? 1));
        return c;
    }

    _createRangeProofBand(node) {
        const group = document.createElementNS(SVG_NS, 'g');
        const widthFrac = node.width || 0.30;
        const heightFrac = node.height || 0.06;
        const cxFrac = node.cx ?? 0.78;
        const cyFrac = node.cy ?? 0.84;
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', String((cxFrac - widthFrac / 2) * this.viewWidth));
        rect.setAttribute('y', String((cyFrac - heightFrac / 2) * this.viewHeight));
        rect.setAttribute('width', String(widthFrac * this.viewWidth));
        rect.setAttribute('height', String(heightFrac * this.viewHeight));
        rect.setAttribute('fill', resolveCssColor(node.fill || 'rgba(255,102,0,0.18)', '#FF6600'));
        rect.setAttribute('stroke', resolveCssColor(node.stroke || 'var(--xmr)', '#FF6600'));
        rect.setAttribute('stroke-width', '1');
        group.appendChild(rect);
        group.setAttribute('opacity', String(node.opacity ?? 0));
        group.dataset.bandType = 'range-proof-band';
        return group;
    }

    _createSignatureTrail(node) {
        /* SVG fallback: static dotted line — no animation. */
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', String(0.42 * this.viewWidth));
        line.setAttribute('y1', String(0.50 * this.viewHeight));
        line.setAttribute('x2', String(0.78 * this.viewWidth));
        line.setAttribute('y2', String(0.40 * this.viewHeight));
        line.setAttribute('stroke', resolveCssColor(node.fill || 'var(--xmr)', '#FF6600'));
        line.setAttribute('stroke-width', '1.5');
        line.setAttribute('stroke-dasharray', '4,4');
        line.setAttribute('opacity', String(node.opacity ?? 0));
        return line;
    }

    _createRingBoundary(node) {
        const c = document.createElementNS(SVG_NS, 'ellipse');
        c.setAttribute('cx', String((node.cx ?? 0.5) * this.viewWidth));
        c.setAttribute('cy', String((node.cy ?? 0.5) * this.viewHeight));
        c.setAttribute('rx', String((node.radius ?? 0.225) * this.viewWidth));
        c.setAttribute('ry', String((node.radius ?? 0.225) * this.viewHeight));
        c.setAttribute('fill', 'none');
        c.setAttribute('stroke', resolveCssColor(node.stroke || 'var(--xmr)', '#FF6600'));
        c.setAttribute('stroke-width', String(node.strokeWidth ?? 2));
        c.setAttribute('opacity', String((node.opacity ?? 0) * (node.sealProgress ?? 1)));
        return c;
    }

    _createGhostOverlay(node) {
        const r = document.createElementNS(SVG_NS, 'rect');
        r.setAttribute('x', '0');
        r.setAttribute('y', '0');
        r.setAttribute('width', '100%');
        r.setAttribute('height', '100%');
        r.setAttribute('fill', resolveCssColor(node.fill || 'rgba(8,8,10,0.7)', '#08080a'));
        r.setAttribute('opacity', String((node.fadeAmount ?? 0) * (node.opacity ?? 1)));
        r.dataset.bandType = 'ghost-overlay';
        return r;
    }

    _createRect(node) {
        const r = document.createElementNS(SVG_NS, 'rect');
        if (node.x !== undefined) r.setAttribute('x', String(node.x));
        if (node.y !== undefined) r.setAttribute('y', String(node.y));
        if (node.width !== undefined) r.setAttribute('width', String(node.width));
        if (node.height !== undefined) r.setAttribute('height', String(node.height));
        if (node.fill) r.setAttribute('fill', resolveCssColor(node.fill));
        r.setAttribute('opacity', String(node.opacity ?? 1));
        return r;
    }

    _createText(node) {
        const t = document.createElementNS(SVG_NS, 'text');
        t.textContent = node.text || '';
        this._applyPosition(t, node);
        t.setAttribute('fill', resolveCssColor(node.fill || 'var(--text-primary)'));
        t.setAttribute('opacity', String(node.opacity ?? 1));
        return t;
    }

    _applyPosition(el, node) {
        if (node.cx !== undefined) el.setAttribute('cx', String(node.cx * this.viewWidth));
        if (node.cy !== undefined) el.setAttribute('cy', String(node.cy * this.viewHeight));
        if (node.x !== undefined) el.setAttribute('x', String(node.x));
        if (node.y !== undefined) el.setAttribute('y', String(node.y));
    }

    updateNode(el, node) {
        if (node.type === 'circle' || node.type === 'ring') {
            if (node.cx !== undefined) el.setAttribute('cx', String(node.cx * this.viewWidth));
            if (node.cy !== undefined) el.setAttribute('cy', String(node.cy * this.viewHeight));
            if (node.r !== undefined) {
                const baseR = node.r * (node.scale ?? 1);
                el.setAttribute('r', String(baseR));
            }
            if (node.opacity !== undefined) el.setAttribute('opacity', String(node.opacity));
        } else if (node.type === 'instanced' || node.type === 'instanced-points' || node.type === 'graph-edge') {
            if (node.opacity !== undefined) el.setAttribute('opacity', String(node.opacity));
        } else if (node.type === 'particle-trail') {
            if (node.cx !== undefined) el.setAttribute('cx', String(node.cx * this.viewWidth));
            if (node.cy !== undefined) el.setAttribute('cy', String(node.cy * this.viewHeight));
            if (node.opacity !== undefined) el.setAttribute('opacity', String(node.opacity));
        } else if (node.type === 'particle-burst') {
            /* Translate the whole starburst group to follow cx/cy. */
            if (node.cx !== undefined && node.cy !== undefined) {
                const tx = node.cx * this.viewWidth;
                const ty = node.cy * this.viewHeight;
                /* The static starburst was authored at the original cx/cy at creation time;
                   apply a transform delta from that origin. We re-emit children rather than
                   tracking the delta — simpler to set transform and let scale/translate compose. */
                const baseScale = 1 + Math.max(0, node.radius ?? 0) * 4;
                const cx0 = (node.cx ?? 0.5) * this.viewWidth;
                const cy0 = (node.cy ?? 0.5) * this.viewHeight;
                el.setAttribute('transform', `translate(${tx - cx0},${ty - cy0}) translate(${cx0},${cy0}) scale(${baseScale}) translate(${-cx0},${-cy0})`);
            }
            if (node.opacity !== undefined) el.setAttribute('opacity', String(node.opacity));
        } else if (node.type === 'comparison-bar') {
            const anchorX = node.anchorX ?? 0.10;
            const barWidth = Math.max(0, node.barWidth ?? 0);
            const heightFrac = node.height ?? 0.04;
            const cyFrac = node.cy ?? 0.85;
            el.setAttribute('x', String(anchorX * this.viewWidth));
            el.setAttribute('y', String((cyFrac - heightFrac / 2) * this.viewHeight));
            el.setAttribute('width', String(barWidth * this.viewWidth));
            el.setAttribute('height', String(heightFrac * this.viewHeight));
            if (node.opacity !== undefined) el.setAttribute('opacity', String(node.opacity));
        } else if (node.type === 'path') {
            el.setAttribute('opacity', String(node.opacity ?? 1));
            if (node.drawProgress !== undefined) {
                el.setAttribute('d', this._buildDensityPath(node.drawProgress, node.meanDays ?? 7, node.sigma ?? 0.5));
            }
        } else if (node.type === 'pedersen-blob') {
            if (node.cx !== undefined) el.setAttribute('cx', String(node.cx * this.viewWidth));
            if (node.cy !== undefined) el.setAttribute('cy', String(node.cy * this.viewHeight));
            if (node.r !== undefined) el.setAttribute('r', String(node.r));
            if (node.opacity !== undefined) el.setAttribute('opacity', String(node.opacity));
        } else if (node.type === 'range-proof-band') {
            if (node.opacity !== undefined) el.setAttribute('opacity', String(node.opacity));
        } else if (node.type === 'signature-trail') {
            if (node.opacity !== undefined) el.setAttribute('opacity', String(node.opacity));
        } else if (node.type === 'ring-boundary') {
            if (node.cx !== undefined) el.setAttribute('cx', String(node.cx * this.viewWidth));
            if (node.cy !== undefined) el.setAttribute('cy', String(node.cy * this.viewHeight));
            if (node.radius !== undefined) {
                el.setAttribute('rx', String(node.radius * this.viewWidth));
                el.setAttribute('ry', String(node.radius * this.viewHeight));
            }
            const seal = node.sealProgress ?? 1;
            el.setAttribute('opacity', String((node.opacity ?? 1) * seal));
        } else if (node.type === 'ghost-overlay') {
            const fade = node.fadeAmount ?? 0;
            el.setAttribute('opacity', String(fade * (node.opacity ?? 1)));
        } else {
            if (node.opacity !== undefined) el.setAttribute('opacity', String(node.opacity));
            if (node.cx !== undefined) el.setAttribute('cx', String(node.cx * this.viewWidth));
            if (node.cy !== undefined) el.setAttribute('cy', String(node.cy * this.viewHeight));
        }
    }

    createOverlayElement(node) {
        if (!this.overlayEl) return;
        if (this.actorOverlayElements.has(node.id)) return;
        if (!node.interactive && (!node.labels || node.labels.length === 0)) return;

        const el = document.createElement('div');
        el.className = 'genui-overlay-actor';
        el.dataset.actorId = node.id;
        el.style.position = 'absolute';
        el.style.transform = 'translate(-50%, -50%)';
        el.style.cursor = node.interactive ? 'pointer' : 'default';
        el.style.minWidth = '24px';
        el.style.minHeight = '24px';
        el.style.borderRadius = '50%';

        if (node.interactive) {
            el.setAttribute('role', node.ariaRole || 'button');
            el.setAttribute('tabindex', String(node.tabIndex ?? 0));
            el.setAttribute('aria-label', node.ariaLabel || node.id);
        }

        if (node.labels && node.labels.length > 0) {
            const label = document.createElement('span');
            label.className = 'genui-overlay-label';
            label.textContent = node.labels[0].text;
            label.style.position = 'absolute';
            label.style.top = node.labels[0].placement === 'below' ? '24px' : '-24px';
            label.style.left = '50%';
            label.style.transform = 'translateX(-50%)';
            label.style.fontFamily = 'var(--font-data)';
            label.style.fontSize = '10px';
            label.style.color = 'var(--text-tertiary)';
            label.style.whiteSpace = 'nowrap';
            label.style.opacity = '0.65';
            el.appendChild(label);
        }

        this.overlayEl.appendChild(el);
        this.actorOverlayElements.set(node.id, el);
        this.updateOverlayElement(node);
    }

    updateOverlayElement(node) {
        const el = this.actorOverlayElements.get(node.id);
        if (!el) return;
        if (node.cx !== undefined && node.cy !== undefined) {
            el.style.left = `${node.cx * 100}%`;
            el.style.top = `${node.cy * 100}%`;
        }
        if (node.opacity !== undefined) {
            el.style.opacity = String(node.opacity);
            el.style.pointerEvents = node.opacity > 0.4 ? 'auto' : 'none';
        }
    }

    getElementForActor(actorId) {
        return this.actorOverlayElements.get(actorId);
    }

    removeActor(actorId) {
        const node = this.actorNodes.get(actorId);
        if (node && node.parentNode) node.parentNode.removeChild(node);
        this.actorNodes.delete(actorId);
        const el = this.actorOverlayElements.get(actorId);
        if (el) el.remove();
        this.actorOverlayElements.delete(actorId);
    }

    destroy() {
        if (this.svg && this.svg.parentNode) this.svg.parentNode.removeChild(this.svg);
        this.actorNodes.clear();
        for (const el of this.actorOverlayElements.values()) el.remove();
        this.actorOverlayElements.clear();
    }
}
