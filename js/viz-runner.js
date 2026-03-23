/* ═══════════════════════════════════════════════════════════════
   VizRunner — xmr.irish v4.0
   Manages Canvas 2D visualization lifecycle:
     - Canvas registration with draw functions
     - Mouse, touch, and keyboard interaction
     - IntersectionObserver visibility culling
     - DPR-aware resize handling
     - Animation loop with prefers-reduced-motion support

   Usage:
     import { VizRunner } from './viz-runner.js';
     const runner = new VizRunner();
     runner.add('myCanvas', drawFn);           // by canvas ID
     runner.addCanvas(canvasEl, drawFn, container); // by element
     runner.observe('.my-section');             // visibility tracking
     runner.start();                           // begin animation loop
   ═══════════════════════════════════════════════════════════════ */

export class VizRunner {
    constructor(options) {
        options = options || {};
        this.entries = [];
        this.frameCount = 0;
        this.running = false;
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // IntersectionObserver config
        this.obsThreshold = options.threshold || 0.05;
        this.obsMargin = options.rootMargin || '200px 0px 200px 0px';

        // Bind methods
        this._loop = this._loop.bind(this);
        this._resize = this._resize.bind(this);

        // Listen for resize
        window.addEventListener('resize', this._resize);
    }

    /**
     * Register a canvas by ID with a draw function.
     * @param {string} canvasId — DOM ID of the <canvas>
     * @param {Function} drawFn — function(ctx, W, H, t, mx, my)
     * @param {Element|string} [container] — parent element or selector for visibility tracking
     * @returns {object|null} — the entry object, or null if canvas not found
     */
    add(canvasId, drawFn, container) {
        var canvas = document.getElementById(canvasId);
        if (!canvas) return null;
        return this.addCanvas(canvas, drawFn, container);
    }

    /**
     * Register a canvas element directly.
     * @param {HTMLCanvasElement} canvas
     * @param {Function} drawFn — function(ctx, W, H, t, mx, my)
     * @param {Element|string} [container] — parent for visibility tracking (defaults to canvas itself)
     * @returns {object} — the entry object
     */
    addCanvas(canvas, drawFn, container) {
        var entry = {
            canvas: canvas,
            draw: drawFn,
            mx: -9999,
            my: -9999,
            W: 0,
            H: 0,
            dpr: 1,
            visible: false,
            container: null
        };

        // Resolve container
        if (typeof container === 'string') {
            entry.container = canvas.closest(container) || canvas;
        } else if (container instanceof Element) {
            entry.container = container;
        } else {
            entry.container = canvas;
        }

        // Mouse events
        var self = this;
        canvas.addEventListener('mousemove', function (e) {
            var r = canvas.getBoundingClientRect();
            entry.mx = e.clientX - r.left;
            entry.my = e.clientY - r.top;
        });
        canvas.addEventListener('mouseleave', function () {
            entry.mx = -9999;
            entry.my = -9999;
        });

        // Touch events
        canvas.addEventListener('touchmove', function (e) {
            e.preventDefault();
            var r = canvas.getBoundingClientRect();
            var touch = e.touches[0];
            entry.mx = touch.clientX - r.left;
            entry.my = touch.clientY - r.top;
        }, { passive: false });
        canvas.addEventListener('touchend', function () {
            entry.mx = -9999;
            entry.my = -9999;
        });

        // Keyboard interaction (for accessibility)
        if (canvas.hasAttribute('tabindex') || canvas.getAttribute('role') === 'img') {
            canvas.addEventListener('keydown', function (e) {
                var step = 20;
                var r = canvas.getBoundingClientRect();
                if (entry.mx < 0) { entry.mx = r.width / 2; entry.my = r.height / 2; }
                if (e.key === 'ArrowLeft') { entry.mx = Math.max(0, entry.mx - step); e.preventDefault(); }
                if (e.key === 'ArrowRight') { entry.mx = Math.min(r.width, entry.mx + step); e.preventDefault(); }
                if (e.key === 'ArrowUp') { entry.my = Math.max(0, entry.my - step); e.preventDefault(); }
                if (e.key === 'ArrowDown') { entry.my = Math.min(r.height, entry.my + step); e.preventDefault(); }
            });
        }

        this.entries.push(entry);
        this._resizeEntry(entry);
        return entry;
    }

    /**
     * Set up IntersectionObserver for visibility-based culling.
     * @param {string} selector — CSS selector for observed elements
     */
    observe(selector) {
        var self = this;
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (obsEntry) {
                self.entries.forEach(function (vizEntry) {
                    if (vizEntry.container === obsEntry.target ||
                        vizEntry.canvas === obsEntry.target) {
                        vizEntry.visible = obsEntry.isIntersecting;
                    }
                });
                // Also handle CSS fade-in class
                if (obsEntry.isIntersecting) {
                    obsEntry.target.classList.add('vis');
                }
            });
        }, {
            threshold: this.obsThreshold,
            rootMargin: this.obsMargin
        });

        document.querySelectorAll(selector).forEach(function (el) {
            observer.observe(el);
        });

        return observer;
    }

    /**
     * Resize a single entry's canvas to match CSS dimensions at device DPR.
     */
    _resizeEntry(entry) {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var W = entry.canvas.clientWidth;
        var H = entry.canvas.clientHeight;
        if (W > 0 && H > 0) {
            entry.canvas.width = W * dpr;
            entry.canvas.height = H * dpr;
            entry.W = W;
            entry.H = H;
            entry.dpr = dpr;
        }
    }

    /**
     * Resize all registered canvases.
     */
    _resize() {
        var self = this;
        this.entries.forEach(function (e) { self._resizeEntry(e); });
    }

    /**
     * Main animation loop.
     */
    _loop() {
        var self = this;

        if (!this.prefersReducedMotion) {
            this.entries.forEach(function (e) {
                if (!e.W || !e.visible) return;
                var ctx = e.canvas.getContext('2d');
                ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
                ctx.clearRect(0, 0, e.W, e.H);
                e.draw(ctx, e.W, e.H, self.frameCount,
                    e.mx < -999 ? e.W / 2 : e.mx,
                    e.my < -999 ? e.H / 2 : e.my);
            });
            this.frameCount++;
        } else if (this.frameCount === 0) {
            // Reduced motion: render one static frame
            this.entries.forEach(function (e) {
                if (!e.W) return;
                var ctx = e.canvas.getContext('2d');
                ctx.setTransform(e.dpr, 0, 0, e.dpr, 0, 0);
                ctx.clearRect(0, 0, e.W, e.H);
                e.draw(ctx, e.W, e.H, 0, e.W / 2, e.H / 2);
            });
            this.frameCount = 1;
        }

        requestAnimationFrame(this._loop);
    }

    /**
     * Start the animation loop. Safe to call multiple times.
     */
    start() {
        if (this.running) return;
        this.running = true;
        this._resize();
        requestAnimationFrame(this._loop);
    }

    /**
     * Get the reduced-motion preference.
     * @returns {boolean}
     */
    get reducedMotion() {
        return this.prefersReducedMotion;
    }
}
