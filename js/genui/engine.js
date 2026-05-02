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

        /* Initialize parameter values from defaults */
        for (const param of this.spec.parameters) {
            this.params[param.id] = param.default;
        }

        /* Detect WebGL availability for Step 8 routing */
        this.webglAvailable = detectWebGLSupport();
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
     * Walks the scene's phases and computes actor states at each phase boundary.
     * Returns a structure: { phases: [{ id, actorStates: { actorId: state } }] }
     *
     * Prompt T implements the actual phase-walk; Prompt S leaves a stub.
     */
    materializeScene(paramContext) {
        /* Stub: returns initial state for each actor across all phases.
           Prompt T replaces this with the real phase-walk algorithm. */
        return {
            phases: this.spec.scene.phases.map(phase => ({
                id: phase.id,
                actorStates: Object.fromEntries(
                    this.spec.actors.map(a => [a.id, { ...a.initialState }])
                )
            }))
        };
    }

    /**
     * Step 4: visual scene graph construction.
     * Translates actor state into renderer-agnostic visual elements.
     *
     * Prompt T implements; Prompt S stubs.
     */
    buildSceneGraph(materializedScene, currentTimeMs) {
        /* Stub: returns empty scene graph. */
        return { nodes: [] };
    }

    /**
     * Step 5: animation interpolation.
     * Lerps actor attributes between keyframes to the current time.
     *
     * Prompt T implements; Prompt S stubs.
     */
    interpolateAnimations(sceneGraph, currentTimeMs) {
        return sceneGraph;
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
     * Adds aria-* attributes to interactive nodes.
     *
     * Prompt T implements per-node aria attribution; Prompt S returns the graph unchanged.
     */
    annotateAccessibility(sceneGraph) {
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
     * Compares scene graph to last frame's, applies minimal mutations.
     *
     * Prompt T implements per-renderer; Prompt S stubs.
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
    }

    /**
     * Step 11: inspector binding.
     * Wires up hover/click → inspector panel for actors with inspectors defined.
     *
     * Prompt T implements; Prompt S stubs (binding happens after first render).
     */
    bindInspectors(sceneGraph) {
        /* Stub */
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

        /* Step 8: select and (lazily) initialize renderer */
        if (!this.renderer) {
            const target = this.selectRenderer();
            this.rendererTarget = target;
            this.renderer = this.createRenderer(target);
        }

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
     * Lazy-instantiate the appropriate renderer.
     * Prompt S provides the dispatch; renderer modules are loaded as ES modules.
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
     * Start the playback loop. autoPlay=true on the spec triggers this on mount.
     */
    play() {
        if (this.isPlaying) return;
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
     * Triggers a single-frame re-derivation, which propagates through steps 2-9.
     */
    updateParameter(paramId, value) {
        if (!(paramId in this.params)) {
            throw new Error(`Unknown parameter: ${paramId}`);
        }
        this.params[paramId] = value;
        this.runFrame(this.currentTimeMs);
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
        if (spec.scene.autoPlay) engine.play();
        return engine;
    }
};

/* Expose Engine for tests / debugging */
export { GenUIEngine };
