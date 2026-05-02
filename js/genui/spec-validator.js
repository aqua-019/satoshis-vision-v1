/**
 * Step 1 of the 12-step pipeline: validate a SimulationSpec.
 * Throws on invalid spec; returns the spec unchanged on valid.
 *
 * @param {import('./types.js').SimulationSpec} spec
 * @returns {import('./types.js').SimulationSpec}
 */
export function validateSpec(spec) {
    if (!spec || typeof spec !== 'object') {
        throw new Error('GenUI: spec must be an object');
    }

    const required = ['id', 'title', 'actors', 'parameters', 'scene', 'render'];
    for (const key of required) {
        if (!(key in spec)) {
            throw new Error(`GenUI spec missing required field: ${key}`);
        }
    }

    /* ID must be kebab-case */
    if (!/^[a-z][a-z0-9-]*$/.test(spec.id)) {
        throw new Error(`GenUI spec id "${spec.id}" must be kebab-case`);
    }

    /* Actor IDs must be unique */
    const actorIds = new Set();
    for (const actor of spec.actors) {
        if (actorIds.has(actor.id)) {
            throw new Error(`GenUI duplicate actor id: ${actor.id}`);
        }
        actorIds.add(actor.id);
    }

    /* Parameter IDs must be unique */
    const paramIds = new Set();
    for (const param of spec.parameters) {
        if (paramIds.has(param.id)) {
            throw new Error(`GenUI duplicate parameter id: ${param.id}`);
        }
        paramIds.add(param.id);
    }

    /* Phase IDs must be unique within the scene */
    const phaseIds = new Set();
    for (const phase of spec.scene.phases) {
        if (phaseIds.has(phase.id)) {
            throw new Error(`GenUI duplicate phase id: ${phase.id}`);
        }
        phaseIds.add(phase.id);
    }

    /* Phases shouldn't have negative timings */
    for (const phase of spec.scene.phases) {
        if (phase.startMs < 0) {
            throw new Error(`GenUI phase ${phase.id} has negative startMs`);
        }
        if (phase.durationMs <= 0) {
            throw new Error(`GenUI phase ${phase.id} has non-positive durationMs`);
        }
    }

    /* Renderer must be one of the supported values */
    if (!['webgl', 'svg', 'canvas2d'].includes(spec.render.primaryRenderer)) {
        throw new Error(`GenUI invalid primaryRenderer: ${spec.render.primaryRenderer}`);
    }

    /* Inspector triggerActorIds must reference actual actors */
    for (const inspector of (spec.inspectors || [])) {
        if (!actorIds.has(inspector.triggerActorId)) {
            throw new Error(`GenUI inspector triggerActorId not found: ${inspector.triggerActorId}`);
        }
    }

    /* Transition actorIds must reference actual actors */
    for (const phase of spec.scene.phases) {
        for (const transition of phase.transitions) {
            if (!actorIds.has(transition.actorId)) {
                throw new Error(`GenUI transition actorId not found: ${transition.actorId}`);
            }
        }
    }

    return spec;
}

/**
 * Test if WebGL is available in the current browser.
 * Used by Step 8 to dispatch to fallback renderer when WebGL unavailable.
 *
 * @returns {boolean}
 */
export function detectWebGLSupport() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        return !!gl;
    } catch (e) {
        return false;
    }
}
