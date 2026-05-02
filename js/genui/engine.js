/**
 * GenUI Engine — the 12-step pipeline.
 *
 * For Prompt S, all steps except validation are stubs that pass-through
 * their input. Prompt T fills in the implementations as it builds the
 * Decoy Selection simulation.
 */

import { validateSpec, detectWebGLSupport } from './spec-validator.js';

/**
 * @typedef {import('./types.js').SimulationSpec} SimulationSpec
 */

class GenUIEngine {
    constructor(spec, mountEl) {
        /** @type {SimulationSpec} */
        this.spec = validateSpec(spec);   /* Step 1 */
        this.mountEl = mountEl;
        this.params = {};
        this.currentTimeMs = 0;
        this.isPlaying = false;
        this.renderer = null;
        this.lastSceneGraph = null;
        this.frameId = null;
        this._lastAnnouncedPhaseId = null;
        this._keydownHandler = null;

        /* Initialize parameter values from defaults */
        for (const param of this.spec.parameters) {
            this.params[param.id] = param.default;
        }

        /* Detect WebGL availability for Step 8 routing */
        this.webglAvailable = detectWebGLSupport();

        /* WCAG 2.3.3 — honor prefers-reduced-motion. Reduced-motion users
           get a single representative still keyframe (mid-scene) and no
           rAF loop. They can still scrub via keyboard arrows. */
        this.reducedMotion =
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        /* aria-live region for phase announcements (WCAG 4.1.3) */
        this._setupA11y();
    }

    /**
     * Set up accessibility scaffolding on the mount element:
     *   - tabindex / role / aria-label so keyboard users can focus the sim
     *   - aria-live region for phase-change announcements
     *   - keydown handlers for play/pause/scrub/restart
     */
    _setupA11y() {
        if (!this.mountEl) return;
        this.mountEl.setAttribute('role', 'application');
        this.mountEl.setAttribute('aria-label', this.spec.title || this.spec.id);
        if (this.mountEl.tabIndex < 0) this.mountEl.tabIndex = 0;

        let announcer = this.mountEl.querySelector('.genui-announcer');
        if (!announcer) {
            announcer = document.createElement('div');
            announcer.className = 'genui-announcer sr-only';
            announcer.setAttribute('aria-live', 'polite');
            announcer.setAttribute('aria-atomic', 'true');
            this.mountEl.appendChild(announcer);
        }
        this._announcer = announcer;

        this._keydownHandler = (e) => this._handleKey(e);
        this.mountEl.addEventListener('keydown', this._keydownHandler);
    }

    _handleKey(e) {
        const phases = (this.spec.scene && this.spec.scene.phases) || [];
        const totalMs = this.spec.scene.duration;
        switch (e.key) {
            case ' ':
            case 'Spacebar':
                e.preventDefault();
                if (this.isPlaying) this.pause(); else this.play();
                break;
            case 'ArrowRight': {
                e.preventDefault();
                const next = phases.find(p => p.startMs > this.currentTimeMs);
                this.currentTimeMs = next ? next.startMs : Math.min(this.currentTimeMs + 500, totalMs);
                this.startTimeMs = performance.now() - this.currentTimeMs;
                this.runFrame(this.currentTimeMs);
                break;
            }
            case 'ArrowLeft': {
                e.preventDefault();
                const prev = [...phases].reverse().find(p => p.startMs < this.currentTimeMs - 1);
                this.currentTimeMs = prev ? prev.startMs : 0;
                this.startTimeMs = performance.now() - this.currentTimeMs;
                this.runFrame(this.currentTimeMs);
                break;
            }
            case 'Home':
                e.preventDefault();
                this.restart();
                break;
            case 'End':
                e.preventDefault();
                this.currentTimeMs = totalMs;
                this.pause();
                this.runFrame(this.currentTimeMs);
                break;
        }
    }

    /* Step 1: spec validation already happened in constructor */

    /**
     * Step 2: parameter resolution.
     * Returns flat object: parameter.id → currentValue.
     */
    resolveParameters() {
        return { ...this.params };
    }

    /**
     * Step 3: scene materialization.
     * Walks the scene's phases and computes the post-phase actor state for
     * each phase by accumulating that phase's transitions on top of the
     * running state. Result: each phase has a snapshot of every actor's
     * state as of phase end.
     */
    materializeScene(paramContext) {
        const initialActorStates = Object.fromEntries(
            this.spec.actors.map(a => [a.id, { ...a.initialState }])
        );

        const initial = {
            id: '__initial',
            startMs: 0,
            durationMs: 0,
            actorStates: JSON.parse(JSON.stringify(initialActorStates))
        };

        let runningState = JSON.parse(JSON.stringify(initialActorStates));
        const phases = [];

        for (const phase of this.spec.scene.phases) {
            for (const transition of phase.transitions) {
                if (!runningState[transition.actorId]) continue;
                runningState[transition.actorId] = {
                    ...runningState[transition.actorId],
                    ...transition.targetState
                };
            }
            phases.push({
                id: phase.id,
                startMs: phase.startMs,
                durationMs: phase.durationMs,
                actorStates: JSON.parse(JSON.stringify(runningState))
            });
        }

        return { initial, phases };
    }

    /**
     * Step 4: visual scene graph construction.
     * Picks the active phase for the current time, then builds a flat list of
     * renderer-agnostic node descriptors merging actor visualMapping defaults
     * with the active phase's actor state. The previous phase (or initial
     * state) is also returned so step 5 can interpolate.
     */
    buildSceneGraph(materializedScene, currentTimeMs) {
        let activePhase = null;
        let prevPhase = materializedScene.initial;

        for (const phase of materializedScene.phases) {
            if (currentTimeMs >= phase.startMs && currentTimeMs < (phase.startMs + phase.durationMs)) {
                activePhase = phase;
                break;
            }
            if (phase.startMs + phase.durationMs <= currentTimeMs) {
                prevPhase = phase;
            }
        }

        if (!activePhase) {
            activePhase = materializedScene.phases[materializedScene.phases.length - 1];
        }

        const inspectorActorIds = new Set(
            (this.spec.inspectors || []).map(i => i.triggerActorId)
        );

        const nodes = this.spec.actors.map(actor => {
            const state = activePhase.actorStates[actor.id] || actor.initialState;
            const attrs = actor.visualMapping.attrs || {};
            return {
                id: actor.id,
                type: actor.visualMapping.shape,
                ...attrs,
                ...state,
                labels: actor.visualMapping.labels || [],
                webgl: actor.visualMapping.webgl || {},
                role: actor.role,
                interactive: inspectorActorIds.has(actor.id)
            };
        });

        return { nodes, prevPhase, activePhase };
    }

    /**
     * Step 5: animation interpolation.
     * For each node, lerp numeric attributes from the previous phase's
     * snapshot toward the active phase's snapshot using the active phase's
     * progress fraction. Per-actor delayMs offsets (used by sampling phase
     * to stagger ring-member spawns) are honored: an actor's interpolation
     * doesn't begin until its delay has elapsed.
     */
    interpolateAnimations(sceneGraph, currentTimeMs) {
        const { prevPhase, activePhase } = sceneGraph;
        if (!prevPhase || !activePhase) return sceneGraph;

        const phaseElapsedMs = currentTimeMs - activePhase.startMs;
        const delayMap = this._actorDelayMap(activePhase.id);

        sceneGraph.nodes = sceneGraph.nodes.map(node => {
            const fromState = prevPhase.actorStates[node.id] || node;
            const toState = activePhase.actorStates[node.id] || node;
            const delay = delayMap.get(node.id) || 0;

            const localDuration = Math.max(1, activePhase.durationMs - delay);
            const localElapsed = phaseElapsedMs - delay;
            const t = activePhase.durationMs > 0
                ? Math.min(1, Math.max(0, localElapsed / localDuration))
                : 1;
            const eased = this.applyEasing(t, this._easingFor(activePhase.id, node.id));

            const interpolated = {};
            const keys = new Set([...Object.keys(fromState), ...Object.keys(toState)]);
            for (const key of keys) {
                const from = fromState[key];
                const to = toState[key];
                if (typeof from === 'number' && typeof to === 'number') {
                    interpolated[key] = from + (to - from) * eased;
                } else if (to !== undefined) {
                    interpolated[key] = to;
                } else {
                    interpolated[key] = from;
                }
            }
            return { ...node, ...interpolated };
        });

        return sceneGraph;
    }

    _actorDelayMap(phaseId) {
        if (!this._delayCache) this._delayCache = new Map();
        if (this._delayCache.has(phaseId)) return this._delayCache.get(phaseId);
        const map = new Map();
        const phase = this.spec.scene.phases.find(p => p.id === phaseId);
        if (phase) {
            for (const t of phase.transitions) {
                if (typeof t.delayMs === 'number') map.set(t.actorId, t.delayMs);
            }
        }
        this._delayCache.set(phaseId, map);
        return map;
    }

    _easingFor(phaseId, actorId) {
        const phase = this.spec.scene.phases.find(p => p.id === phaseId);
        if (!phase) return 'cubic-bezier(.4,0,.2,1)';
        const t = phase.transitions.find(tr => tr.actorId === actorId);
        return (t && t.easing) || 'cubic-bezier(.4,0,.2,1)';
    }

    applyEasing(t, easing) {
        if (!easing || easing === 'linear') return t;
        if (easing.includes('ease-out') || easing.includes('cubic-bezier(.4,0,.2,1)')) {
            return 1 - Math.pow(1 - t, 3);
        }
        if (easing.includes('ease-in')) {
            return Math.pow(t, 3);
        }
        if (easing.includes('cubic-bezier(.4,0,.6,1)')) {
            /* Symmetric ease — used for the true-spender pulse */
            return t < 0.5
                ? 4 * t * t * t
                : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }
        return 1 - Math.pow(1 - t, 3);
    }

    /**
     * Step 6: style token resolution.
     * Replaces var(--xmr) etc. with concrete hex values from the resolved CSS.
     */
    resolveStyleTokens(sceneGraph) {
        const computed = getComputedStyle(document.documentElement);
        const resolveColor = (c) => {
            if (typeof c !== 'string') return c;
            const match = c.match(/^var\((--[a-z0-9-]+)\)$/i);
            if (!match) return c;
            return computed.getPropertyValue(match[1]).trim() || c;
        };

        return {
            ...sceneGraph,
            nodes: sceneGraph.nodes.map(node => ({
                ...node,
                fill: resolveColor(node.fill),
                stroke: resolveColor(node.stroke)
            }))
        };
    }

    /**
     * Step 7: accessibility annotation.
     * Adds aria-label / role / tabindex hints to interactive nodes so the
     * renderer can attach them to the corresponding overlay element.
     */
    annotateAccessibility(sceneGraph) {
        sceneGraph.nodes = sceneGraph.nodes.map(node => {
            if (!node.interactive) return node;

            const inspector = (this.spec.inspectors || []).find(i => i.triggerActorId === node.id);
            const ariaLabel = inspector
                ? inspector.panelTitle
                : `${node.role} ${node.id}`;

            return {
                ...node,
                ariaLabel,
                tabIndex: 0,
                ariaRole: 'button'
            };
        });
        return sceneGraph;
    }

    /**
     * Step 8: render target selection.
     * Returns the renderer to dispatch to.
     */
    selectRenderer() {
        const requested = this.spec.render.primaryRenderer;

        if (requested === 'webgl' && !this.webglAvailable) {
            /* WebGL requested but not available — fall back */
            const fallback = this.spec.render.fallbackRenderer || 'svg';
            console.warn(`[GenUI] WebGL unavailable; falling back to ${fallback}`);
            return fallback;
        }

        return requested;
    }

    /**
     * Step 9: DOM/scene patch.
     * Hands the scene graph to the renderer (whichever was selected). The
     * renderer is responsible for diffing against its own last state.
     */
    patchScene(sceneGraph) {
        if (this.renderer && typeof this.renderer.update === 'function') {
            this.renderer.update(sceneGraph);
        }
        this.lastSceneGraph = sceneGraph;
    }

    /**
     * Step 10: phase indicator update.
     * Updates the chrome around the simulation.
     */
    updatePhaseIndicator(currentTimeMs) {
        /* Find the active phase based on currentTimeMs */
        const activePhase = this.spec.scene.phases.find(p =>
            currentTimeMs >= p.startMs && currentTimeMs < (p.startMs + p.durationMs)
        );

        if (!activePhase) return;

        const phaseProgress = (currentTimeMs - activePhase.startMs) / activePhase.durationMs;
        const totalProgress = currentTimeMs / this.spec.scene.duration;

        /* Update overlay UI; Prompt T wires this up to actual DOM. */
        const indicator = this.mountEl.querySelector('.genui-phase-indicator');
        if (indicator) {
            const nameEl = indicator.querySelector('.genui-phase-name');
            const descEl = indicator.querySelector('.genui-phase-description');
            const progressEl = indicator.querySelector('.genui-phase-progress');
            if (nameEl) nameEl.textContent = activePhase.label;
            if (descEl) descEl.textContent = activePhase.description;
            if (progressEl) progressEl.style.setProperty('--progress', `${phaseProgress * 100}%`);
        }

        /* Announce phase changes to screen readers (WCAG 4.1.3) */
        if (this._announcer && activePhase.id !== this._lastAnnouncedPhaseId) {
            this._announcer.textContent = `${activePhase.label}: ${activePhase.description || ''}`;
            this._lastAnnouncedPhaseId = activePhase.id;
        }
    }

    /**
     * Step 11: inspector binding.
     * For each actor with an inspector, find the renderer's overlay element
     * and wire mouseenter/mouseleave/click/focus/blur to show/hide the
     * inspector panel. Bindings are idempotent — once attached, we don't
     * re-attach.
     */
    bindInspectors(sceneGraph) {
        if (!this.inspectorBindings) this.inspectorBindings = new Map();
        if (!this.renderer || !this.renderer.getElementForActor) return;

        if (!this.inspectorModule && !this.inspectorModulePending) {
            this.inspectorModulePending = true;
            import('./inspector.js').then(m => {
                this.inspectorModule = m;
                this.inspectorModulePending = false;
            });
            return;
        }
        if (!this.inspectorModule) return;

        for (const node of sceneGraph.nodes) {
            if (!node.interactive) continue;
            if (this.inspectorBindings.has(node.id)) {
                this.inspectorBindings.get(node.id).node = node;
                continue;
            }

            const inspector = (this.spec.inspectors || []).find(i => i.triggerActorId === node.id);
            if (!inspector) continue;

            const el = this.renderer.getElementForActor(node.id);
            if (!el) continue;

            const binding = { node, inspector, el };

            const show = () => {
                this.inspectorModule.showInspector(binding.node, inspector.panelTitle, inspector.fields, el);
            };
            const hide = () => this.inspectorModule.hideInspector();

            el.addEventListener('mouseenter', show);
            el.addEventListener('mouseleave', hide);
            el.addEventListener('focus', show);
            el.addEventListener('blur', hide);
            el.addEventListener('click', show);

            binding.show = show;
            binding.hide = hide;
            this.inspectorBindings.set(node.id, binding);
        }
    }

    /**
     * Step 12: frame commit + telemetry.
     * Logs per-frame data when window._xmrDebug is true.
     */
    commitFrame(stepTimings) {
        if (window._xmrDebug) {
            console.log('[GenUI]', {
                simId: this.spec.id,
                currentTimeMs: this.currentTimeMs,
                stepTimings,
                nodeCount: this.lastSceneGraph?.nodes?.length || 0,
                rendererTarget: this.rendererTarget
            });
        }
    }

    /**
     * Run a single frame through the pipeline.
     * Called by the animation loop (or once per parameter change).
     */
    runFrame(currentTimeMs) {
        const t0 = performance.now();
        const timings = {};

        /* Step 2 */
        const paramContext = this.resolveParameters();
        timings.params = performance.now() - t0;

        /* Step 3 */
        const ts3 = performance.now();
        const materialized = this.materializeScene(paramContext);
        timings.scene = performance.now() - ts3;

        /* Step 4 */
        const ts4 = performance.now();
        let sceneGraph = this.buildSceneGraph(materialized, currentTimeMs);
        timings.graph = performance.now() - ts4;

        /* Step 5 */
        const ts5 = performance.now();
        sceneGraph = this.interpolateAnimations(sceneGraph, currentTimeMs);
        timings.interp = performance.now() - ts5;

        /* Step 6 */
        const ts6 = performance.now();
        sceneGraph = this.resolveStyleTokens(sceneGraph);
        timings.tokens = performance.now() - ts6;

        /* Step 7 */
        const ts7 = performance.now();
        sceneGraph = this.annotateAccessibility(sceneGraph);
        timings.a11y = performance.now() - ts7;

        /* Step 8: renderer dispatch — actual instantiation happens once in
           initRenderer() so we don't fire dynamic imports per frame. */

        /* Step 9 */
        const ts9 = performance.now();
        this.patchScene(sceneGraph);
        timings.patch = performance.now() - ts9;

        /* Step 10 */
        const ts10 = performance.now();
        this.updatePhaseIndicator(currentTimeMs);
        timings.phase = performance.now() - ts10;

        /* Step 11 */
        const ts11 = performance.now();
        this.bindInspectors(sceneGraph);
        timings.inspect = performance.now() - ts11;

        /* Step 12 */
        this.commitFrame(timings);
    }

    /**
     * Lazy-instantiate the appropriate renderer. Renderer modules are
     * imported as ES modules so SVG fallback users don't pay the Three.js
     * download cost.
     */
    async createRenderer(target) {
        if (target === 'webgl') {
            const mod = await import('./renderer-webgl.js');
            return new mod.WebGLRenderer(this.mountEl, this.spec);
        } else if (target === 'svg') {
            const mod = await import('./renderer-svg.js');
            return new mod.SVGRenderer(this.mountEl, this.spec);
        } else {
            throw new Error(`GenUI: Canvas2D renderer not supported in genui module — use existing chart code`);
        }
    }

    /**
     * Boot the renderer; run a single frame at t=0 so the user sees a
     * static initial composition immediately (instead of black canvas
     * until the first rAF tick).
     */
    async initRenderer() {
        if (this.renderer) return this.renderer;
        const target = this.selectRenderer();
        this.rendererTarget = target;
        try {
            this.renderer = await this.createRenderer(target);
        } catch (err) {
            console.warn('[GenUI] WebGL renderer failed to initialize, falling back to SVG', err);
            const mod = await import('./renderer-svg.js');
            this.rendererTarget = 'svg';
            this.renderer = new mod.SVGRenderer(this.mountEl, this.spec);
        }
        this.runFrame(0);
        return this.renderer;
    }

    /**
     * Start the playback loop. autoPlay=true on the spec triggers this on
     * mount. We always boot the renderer first; if it's already booted,
     * play() is cheap.
     */
    async play() {
        if (this.isPlaying) return;
        if (!this.renderer) await this.initRenderer();

        /* WCAG 2.3.3 — reduced-motion users get a still keyframe instead
           of an animated tick loop. They can scrub via arrow keys. */
        if (this.reducedMotion) {
            this.currentTimeMs = (this.spec.scene.duration || 0) / 2;
            this.runFrame(this.currentTimeMs);
            return;
        }

        this.isPlaying = true;
        this.startTimeMs = performance.now() - this.currentTimeMs;
        this.tick();
    }

    pause() {
        this.isPlaying = false;
        if (this.frameId) cancelAnimationFrame(this.frameId);
    }

    restart() {
        this.currentTimeMs = 0;
        if (this.isPlaying) this.tick();
    }

    tick() {
        if (!this.isPlaying) return;

        this.currentTimeMs = performance.now() - this.startTimeMs;
        if (this.currentTimeMs > this.spec.scene.duration) {
            if (this.spec.scene.loop) {
                this.currentTimeMs = 0;
                this.startTimeMs = performance.now();
            } else {
                this.pause();
                return;
            }
        }

        this.runFrame(this.currentTimeMs);
        this.frameId = requestAnimationFrame(() => this.tick());
    }

    /**
     * Update a parameter value and re-render.
     * If the spec exposes __buildSpec, the spec is rebuilt with the new
     * parameters so topology-affecting changes (e.g. ringSize) take effect.
     * Orphaned actors are removed from the renderer; new actors will be
     * created on the next frame.
     */
    updateParameter(paramId, value) {
        if (!(paramId in this.params)) {
            throw new Error(`Unknown parameter: ${paramId}`);
        }
        this.params[paramId] = value;

        if (typeof this.spec.__buildSpec === 'function') {
            const builder = this.spec.__buildSpec;
            const newSpec = builder(this.params);
            newSpec.__buildSpec = builder;
            const validated = validateSpec(newSpec);

            const oldIds = new Set(this.spec.actors.map(a => a.id));
            const newIds = new Set(validated.actors.map(a => a.id));
            const removed = [...oldIds].filter(id => !newIds.has(id));
            if (this.renderer && this.renderer.removeActor) {
                for (const id of removed) this.renderer.removeActor(id);
            }
            if (this.inspectorBindings) {
                for (const id of removed) this.inspectorBindings.delete(id);
            }

            this.spec = validated;
            this._delayCache = new Map();
        }

        this.runFrame(this.currentTimeMs);
    }

    /**
     * Tear down the engine: pause, dispose the renderer, drop listeners
     * and the announcer node. Called on scene switch by
     * protocol-simulations.html so WebGL contexts and DOM overlays don't
     * leak across card clicks.
     */
    destroy() {
        try { this.pause(); } catch (_) {}
        if (this.renderer && typeof this.renderer.destroy === 'function') {
            try { this.renderer.destroy(); } catch (_) {}
        }
        this.renderer = null;
        if (this.mountEl && this._keydownHandler) {
            this.mountEl.removeEventListener('keydown', this._keydownHandler);
            this._keydownHandler = null;
        }
        if (this._announcer && this._announcer.parentElement) {
            this._announcer.parentElement.removeChild(this._announcer);
        }
        this._announcer = null;
    }
}

/* Global registry — sims register themselves here */
window.GenUI = window.GenUI || {
    Engine: GenUIEngine,
    sims: new Map(),
    register(spec) {
        if (!spec.id) throw new Error('GenUI: sim spec missing id');
        this.sims.set(spec.id, spec);
    },
    mount(simId, mountEl) {
        const spec = this.sims.get(simId);
        if (!spec) throw new Error(`GenUI: unknown sim id "${simId}"`);
        const engine = new GenUIEngine(spec, mountEl);
        /* Boot renderer asynchronously; play() awaits internally if needed. */
        engine.initRenderer().then(() => {
            if (spec.scene.autoPlay) engine.play();
        });
        return engine;
    }
};

/* Expose Engine for tests / debugging */
export { GenUIEngine };
