/**
 * SVG fallback renderer.
 *
 * Used when WebGL is unavailable. Renders the same scene with degraded
 * fidelity (no shaders, no particle systems, no additive blending).
 *
 * Prompt S provides the scaffolding. Prompt T fills in real rendering only
 * if needed for SVG fallback testing — implementation can be deferred per-sim.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export class SVGRenderer {
    constructor(mountEl, spec) {
        this.mountEl = mountEl;
        this.spec = spec;
        this.canvas = mountEl.querySelector('.genui-canvas');

        if (!this.canvas) {
            throw new Error('GenUI SVGRenderer: no .genui-canvas in mount');
        }

        /* Create an SVG element overlaying the canvas (canvas itself stays empty in SVG mode) */
        const { width, height } = this.canvas.getBoundingClientRect();

        this.svg = document.createElementNS(SVG_NS, 'svg');
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', '100%');
        this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        this.svg.style.position = 'absolute';
        this.svg.style.inset = '0';

        mountEl.querySelector('.genui-canvas-container').appendChild(this.svg);

        /* Track SVG nodes by actor ID for diff/patch */
        this.actorNodes = new Map();
    }

    update(sceneGraph) {
        /* Stub: minimal SVG dispatch. Prompt T implements per-node updates if needed. */
        for (const node of sceneGraph.nodes) {
            if (!this.actorNodes.has(node.id)) {
                /* New node — create */
                const el = this.createNode(node);
                if (el) {
                    this.svg.appendChild(el);
                    this.actorNodes.set(node.id, el);
                }
            } else {
                /* Existing node — update attrs */
                const el = this.actorNodes.get(node.id);
                this.updateNode(el, node);
            }
        }
    }

    createNode(node) {
        let el;
        switch (node.type) {
            case 'circle':
            case 'instanced-disc':
                el = document.createElementNS(SVG_NS, 'circle');
                break;
            case 'rect':
                el = document.createElementNS(SVG_NS, 'rect');
                break;
            case 'text':
                el = document.createElementNS(SVG_NS, 'text');
                break;
            default:
                return null;
        }
        this.updateNode(el, node);
        return el;
    }

    updateNode(el, node) {
        for (const [key, value] of Object.entries(node)) {
            if (key === 'id' || key === 'type' || key === 'labels' || key === 'webgl') continue;
            if (typeof value === 'string' || typeof value === 'number') {
                el.setAttribute(this.svgAttrName(key), value);
            }
        }
    }

    svgAttrName(jsKey) {
        /* Map JS-style keys to SVG attribute names */
        const map = {
            cx: 'cx', cy: 'cy', r: 'r',
            x: 'x', y: 'y', width: 'width', height: 'height',
            fill: 'fill', stroke: 'stroke',
            strokeWidth: 'stroke-width',
            opacity: 'opacity'
        };
        return map[jsKey] || jsKey;
    }

    destroy() {
        if (this.svg && this.svg.parentNode) {
            this.svg.parentNode.removeChild(this.svg);
        }
        this.actorNodes.clear();
    }
}
