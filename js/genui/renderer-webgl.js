/**
 * WebGL renderer using Three.js r128.
 *
 * Renders a SimulationSpec scene graph. Each actor type (circle, instanced,
 * instanced-points, path, ring) maps to a Three.js Mesh/Line. The renderer
 * also maintains a parallel DOM overlay layer for label and inspector
 * targeting — interactions ride on real DOM elements so screenreaders
 * and keyboard navigation work without WebGL-aware shims.
 */

import * as THREE from 'three';

const glowVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const glowFragmentShader = `
    uniform vec3 color;
    uniform float opacity;
    uniform float intensity;
    varying vec2 vUv;
    void main() {
        vec2 centered = vUv - vec2(0.5);
        float dist = length(centered) * 2.0;
        if (dist > 1.0) discard;
        float core = 1.0 - smoothstep(0.0, 0.42, dist);
        float halo = (1.0 - smoothstep(0.42, 1.0, dist)) * 0.5;
        float alpha = (core + halo * intensity) * opacity;
        gl_FragColor = vec4(color, alpha);
    }
`;

const ringVertexShader = glowVertexShader;
const ringFragmentShader = `
    uniform vec3 color;
    uniform float opacity;
    varying vec2 vUv;
    void main() {
        vec2 centered = vUv - vec2(0.5);
        float dist = length(centered) * 2.0;
        if (dist > 1.0) discard;
        float ring = smoothstep(0.78, 0.86, dist) * (1.0 - smoothstep(0.94, 1.0, dist));
        gl_FragColor = vec4(color, ring * opacity);
    }
`;

const instancedBlocksVertexShader = `
    attribute vec3 instanceOffset;
    void main() {
        vec3 pos = position + instanceOffset;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

const instancedBlocksFragmentShader = `
    uniform vec3 color;
    uniform float opacity;
    void main() {
        gl_FragColor = vec4(color, opacity);
    }
`;

const instancedPointsVertexShader = `
    attribute vec3 instanceOffset;
    attribute float instanceAlpha;
    varying float vAlpha;
    void main() {
        vAlpha = instanceAlpha;
        vec3 pos = position + instanceOffset;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

const instancedPointsFragmentShader = `
    uniform vec3 color;
    uniform float opacity;
    varying float vAlpha;
    void main() {
        gl_FragColor = vec4(color, vAlpha * opacity);
    }
`;

/* Pedersen-blob shader — used for output commitments in Sim 4.
   Simplex-noise distortion of the base color visually conveys "value
   hidden behind a cryptographic commitment" without showing the math. */
const pedersenVertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

/* GLSL simplex noise — Ashima version, public domain (compact 2D variant). */
const pedersenFragmentShader = `
    uniform vec3 color;
    uniform float opacity;
    uniform float time;
    uniform float blobPhase;
    varying vec2 vUv;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
    float snoise(vec2 v) {
        const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                           -0.577350269189626, 0.024390243902439);
        vec2 i  = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289v2(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                       + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                                dot(x12.zw, x12.zw)), 0.0);
        m = m * m;
        m = m * m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
        vec3 g;
        g.x  = a0.x  * x0.x  + h.x  * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
    }

    void main() {
        vec2 centered = vUv - vec2(0.5);
        float dist = length(centered) * 2.0;
        if (dist > 1.0) discard;

        /* Base disc with soft falloff */
        float disc = 1.0 - smoothstep(0.55, 1.0, dist);

        /* Two octaves of simplex noise, animating slowly */
        float n1 = snoise(vUv * 4.5 + vec2(time * 0.35, time * 0.22));
        float n2 = snoise(vUv * 9.0 - vec2(time * 0.18, time * 0.31)) * 0.5;
        float noise = (n1 + n2) * 0.5;

        /* blobPhase animates the distortion intensity in over phase 4 */
        float distortion = 0.55 + 0.45 * (noise * 0.5 + 0.5);
        float intensity = mix(1.0, distortion, clamp(blobPhase, 0.0, 1.0));

        float alpha = disc * opacity;
        /* Subtle dark "veins" punch the surface as noise dips */
        float darken = clamp(0.5 + 0.5 * intensity, 0.4, 1.0);
        gl_FragColor = vec4(color * darken, alpha);
    }
`;

/* CLSAG signature-trail shader — particle positions are static along a
   precomputed path; alpha is computed per-particle based on its phase
   relative to the moving leading edge. */
const signatureTrailVertexShader = `
    attribute float phase;
    uniform float pathProgress;
    uniform float trailLengthFrac;
    uniform float pixelRatio;
    varying float vAlpha;
    void main() {
        float dist = mod(pathProgress - phase + 1.0, 1.0);
        float t = clamp(1.0 - dist / max(trailLengthFrac, 0.001), 0.0, 1.0);
        vAlpha = pow(t, 2.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = 5.0 * pixelRatio;
    }
`;

const signatureTrailFragmentShader = `
    uniform vec3 color;
    uniform float opacity;
    varying float vAlpha;
    void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c) * 2.0;
        float disc = 1.0 - smoothstep(0.0, 1.0, d);
        gl_FragColor = vec4(color, disc * vAlpha * opacity);
    }
`;

function resolveCssColor(c, fallback = '#FF6600') {
    if (typeof c !== 'string') return fallback;
    const match = c.match(/^var\((--[a-z0-9-]+)\)$/i);
    if (!match) return c;
    const computed = getComputedStyle(document.documentElement);
    const v = computed.getPropertyValue(match[1]).trim();
    return v || fallback;
}

/**
 * Parse a CSS color (rgba/rgb/hex/var) into a THREE.Color plus a separate
 * numeric alpha multiplier. THREE.Color silently drops the alpha channel
 * from rgba strings, leading to opaque rendering — call this anywhere we
 * feed a color string into a shader uniform whose alpha matters.
 */
function parseColorWithAlpha(c, fallback = '#FF6600') {
    const resolved = resolveCssColor(c, fallback);
    const m = typeof resolved === 'string'
        ? resolved.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i)
        : null;
    if (m) {
        return {
            color: new THREE.Color(+m[1] / 255, +m[2] / 255, +m[3] / 255),
            alpha: m[4] !== undefined ? parseFloat(m[4]) : 1
        };
    }
    return { color: new THREE.Color(resolved), alpha: 1 };
}

export class WebGLRenderer {
    constructor(mountEl, spec) {
        this.mountEl = mountEl;
        this.spec = spec;
        this.canvas = mountEl.querySelector('.genui-canvas');

        if (!this.canvas) {
            throw new Error('GenUI WebGLRenderer: no .genui-canvas in mount');
        }

        const { width, height } = this.canvas.getBoundingClientRect();

        this.three = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.three.setSize(Math.max(1, width), Math.max(1, height), false);
        this.three.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(resolveCssColor(spec.render.backgroundColor || 'var(--surface-0)', '#0a0a0c'));

        const aspect = (width || 2) / (height || 1);
        const frustumSize = 2;
        this.camera = new THREE.OrthographicCamera(
            -frustumSize * aspect / 2, frustumSize * aspect / 2,
            frustumSize / 2, -frustumSize / 2,
            0.1, 100
        );
        this.camera.position.z = 10;
        this.frustumSize = frustumSize;
        this.frustumWidth = frustumSize * aspect;
        this.frustumHeight = frustumSize;

        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(mountEl);

        this.actorMeshes = new Map();
        this.actorOverlayElements = new Map();

        this.overlayEl = mountEl.querySelector('.genui-overlay');
    }

    handleResize() {
        const { width, height } = this.canvas.getBoundingClientRect();
        if (!width || !height) return;
        this.three.setSize(width, height, false);

        const aspect = width / height;
        this.camera.left = -this.frustumSize * aspect / 2;
        this.camera.right = this.frustumSize * aspect / 2;
        this.camera.top = this.frustumSize / 2;
        this.camera.bottom = -this.frustumSize / 2;
        this.camera.updateProjectionMatrix();
        this.frustumWidth = this.frustumSize * aspect;
        this.frustumHeight = this.frustumSize;
    }

    canvasToWorld(cx, cy) {
        return {
            x: (cx - 0.5) * this.frustumWidth,
            y: (0.5 - cy) * this.frustumHeight
        };
    }

    update(sceneGraph) {
        for (const node of sceneGraph.nodes) {
            const existing = this.actorMeshes.get(node.id);
            if (!existing) {
                if ((node.opacity ?? 0) <= 0.001) {
                    /* Don't materialize meshes for actors that haven't appeared yet —
                       overlay still wants to exist, but cheap to defer. */
                    if (this.overlayEl && !this.actorOverlayElements.has(node.id)
                        && (node.interactive || (node.labels && node.labels.length))) {
                        this.createOverlayElement(node);
                    }
                    continue;
                }
                this.createMesh(node);
            } else {
                this.updateMesh(node);
            }
        }
        this.three.render(this.scene, this.camera);
    }

    createMesh(node) {
        let mesh = null;

        if (node.type === 'circle') {
            mesh = this._createGlowDisc(node);
        } else if (node.type === 'ring') {
            mesh = this._createRing(node);
        } else if (node.type === 'instanced') {
            mesh = this._createInstancedBlocks(node);
        } else if (node.type === 'instanced-points') {
            mesh = this._createInstancedPoints(node);
        } else if (node.type === 'path') {
            /* Sim 5 introduced bezier paths (alice/bob ECDH beams, derivation arc).
               When the spec ships from/controlPoint/to, build a bezier line;
               otherwise fall back to the original density-curve implementation. */
            mesh = (node.from && node.to)
                ? this._createBezierLine(node)
                : this._createDensityCurveLine(node);
        } else if (node.type === 'graph-edge') {
            mesh = this._createGraphEdges(node);
        } else if (node.type === 'particle-trail') {
            mesh = this._createParticleTrail(node);
        } else if (node.type === 'particle-burst') {
            mesh = this._createParticleBurst(node);
        } else if (node.type === 'comparison-bar') {
            mesh = this._createComparisonBar(node);
        } else if (node.type === 'pedersen-blob') {
            mesh = this._createPedersenBlob(node);
        } else if (node.type === 'range-proof-band') {
            mesh = this._createRangeProofBand(node);
        } else if (node.type === 'signature-trail') {
            mesh = this._createSignatureTrail(node);
        } else if (node.type === 'ring-boundary') {
            mesh = this._createRingBoundary(node);
        } else if (node.type === 'ghost-overlay') {
            mesh = this._createGhostOverlay(node);
        }

        if (!mesh) return;

        if (node.cx !== undefined && node.cy !== undefined && !mesh.userData.skipPosition) {
            const { x, y } = this.canvasToWorld(node.cx, node.cy);
            mesh.position.set(x, y, 0);
        }

        this.scene.add(mesh);
        this.actorMeshes.set(node.id, mesh);

        this.createOverlayElement(node);
    }

    _createGlowDisc(node) {
        const geometry = new THREE.PlaneGeometry(0.12, 0.12);
        const useGlow = node.webgl && node.webgl.material === 'glow';
        const color = new THREE.Color(resolveCssColor(node.fill || 'var(--xmr)', '#FF6600'));

        const material = useGlow
            ? new THREE.ShaderMaterial({
                vertexShader: glowVertexShader,
                fragmentShader: glowFragmentShader,
                uniforms: {
                    color: { value: color },
                    opacity: { value: node.opacity ?? 1 },
                    intensity: { value: node.glowIntensity ?? 1 }
                },
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
            : new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: node.opacity ?? 1
            });

        const mesh = new THREE.Mesh(geometry, material);
        const r = node.r ?? 8;
        const scale = (r / 8) * 0.7;
        mesh.scale.set(scale, scale, 1);
        return mesh;
    }

    _createRing(node) {
        const geometry = new THREE.PlaneGeometry(0.18, 0.18);
        const color = new THREE.Color(resolveCssColor(node.stroke || 'var(--gold)', '#FFD700'));
        const material = new THREE.ShaderMaterial({
            vertexShader: ringVertexShader,
            fragmentShader: ringFragmentShader,
            uniforms: {
                color: { value: color },
                opacity: { value: node.opacity ?? 1 }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        const baseScale = node.scale ?? 1;
        mesh.scale.set(baseScale, baseScale, 1);
        return mesh;
    }

    _createInstancedBlocks(node) {
        const count = Math.max(1, node.blockCount || 720);
        const baseGeometry = new THREE.PlaneGeometry(1, 1);
        const instancedGeo = new THREE.InstancedBufferGeometry();
        instancedGeo.index = baseGeometry.index;
        instancedGeo.attributes.position = baseGeometry.attributes.position;
        instancedGeo.attributes.uv = baseGeometry.attributes.uv;

        const blockWidthWorld = (this.frustumWidth * 0.92) / count;
        const blockHeightWorld = this.frustumHeight * 0.04;

        const offsets = new Float32Array(count * 3);
        const yWorld = (0.5 - 0.88) * this.frustumHeight;
        const startX = -this.frustumWidth * 0.46 + blockWidthWorld / 2;
        for (let i = 0; i < count; i++) {
            offsets[i * 3] = startX + i * blockWidthWorld;
            offsets[i * 3 + 1] = yWorld;
            offsets[i * 3 + 2] = 0;
        }
        instancedGeo.setAttribute('instanceOffset', new THREE.InstancedBufferAttribute(offsets, 3));
        instancedGeo.instanceCount = count;

        const fill = resolveCssColor(node.fill || 'var(--surface-2)', '#1A1A1E');

        const material = new THREE.ShaderMaterial({
            vertexShader: instancedBlocksVertexShader,
            fragmentShader: instancedBlocksFragmentShader,
            uniforms: {
                color: { value: new THREE.Color(fill) },
                opacity: { value: node.opacity ?? 1 }
            },
            transparent: true,
            depthWrite: false
        });

        const mesh = new THREE.Mesh(instancedGeo, material);
        mesh.scale.set(blockWidthWorld * 0.85, blockHeightWorld, 1);
        mesh.position.set(0, 0, 0);
        mesh.userData.skipPosition = true;
        return mesh;
    }

    _createInstancedPoints(node) {
        const count = Math.max(1, node.count || 5000);
        const baseGeometry = new THREE.PlaneGeometry(1, 1);
        const instancedGeo = new THREE.InstancedBufferGeometry();
        instancedGeo.index = baseGeometry.index;
        instancedGeo.attributes.position = baseGeometry.attributes.position;
        instancedGeo.attributes.uv = baseGeometry.attributes.uv;

        const offsets = new Float32Array(count * 3);
        const alphas = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            /* Sample log-uniform on age. Convert to canvas X.
               Map to world. Y noise within central band. */
            const ageDays = Math.exp(Math.log(0.5) + Math.random() * (Math.log(1825) - Math.log(0.5)));
            const minLog = Math.log(0.5);
            const maxLog = Math.log(1825);
            const t = (Math.log(ageDays) - minLog) / (maxLog - minLog);
            const cx = 0.95 - (t * 0.85);
            const cy = 0.30 + Math.random() * 0.50;
            const { x, y } = this.canvasToWorld(cx, cy);

            offsets[i * 3] = x;
            offsets[i * 3 + 1] = y;
            offsets[i * 3 + 2] = 0;

            /* Recent outputs slightly brighter (still uniform appearance) */
            alphas[i] = 0.4 + (1 - t) * 0.4;
        }

        instancedGeo.setAttribute('instanceOffset', new THREE.InstancedBufferAttribute(offsets, 3));
        instancedGeo.setAttribute('instanceAlpha', new THREE.InstancedBufferAttribute(alphas, 1));
        instancedGeo.instanceCount = count;

        const fill = resolveCssColor(node.fill || 'var(--xmr)', '#FF6600');
        const material = new THREE.ShaderMaterial({
            vertexShader: instancedPointsVertexShader,
            fragmentShader: instancedPointsFragmentShader,
            uniforms: {
                color: { value: new THREE.Color(fill) },
                opacity: { value: node.opacity ?? 0.6 }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const pointSizeWorld = 0.012;
        const mesh = new THREE.Mesh(instancedGeo, material);
        mesh.scale.set(pointSizeWorld, pointSizeWorld, 1);
        mesh.position.set(0, 0, 0);
        mesh.userData.skipPosition = true;
        return mesh;
    }

    _createDensityCurveLine(node) {
        const N = 200;
        const positions = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setDrawRange(0, 0);

        const material = new THREE.LineBasicMaterial({
            color: new THREE.Color(resolveCssColor(node.stroke || 'var(--xmr)', '#FF6600')),
            transparent: true,
            opacity: node.opacity ?? 1,
            linewidth: 2
        });

        const line = new THREE.Line(geometry, material);
        line.userData.curveSamples = N;
        line.userData.skipPosition = true;
        return line;
    }

    _createBezierLine(node) {
        /* Quadratic-bezier polyline. The geometry is sampled into N segments
           at creation; updateMesh resamples on each frame to stay correct if
           from/controlPoint/to ever animate, and walks drawRange against
           node.progress to "draw the line in" over time. */
        const N = 120;
        const positions = new Float32Array(N * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setDrawRange(0, 0);

        const parsed = parseColorWithAlpha(node.stroke || 'var(--xmr)', '#FF6600');
        const material = new THREE.LineBasicMaterial({
            color: parsed.color,
            transparent: true,
            opacity: (node.opacity ?? 1) * parsed.alpha,
            linewidth: node.strokeWidth || 2
        });

        const line = new THREE.Line(geometry, material);
        line.userData.bezierLine = true;
        line.userData.bezierSamples = N;
        line.userData.colorAlpha = parsed.alpha;
        line.userData.skipPosition = true;
        return line;
    }

    _updateBezierLine(line, node) {
        const N = line.userData.bezierSamples || 120;
        const positions = line.geometry.attributes.position.array;
        const from = node.from;
        const to = node.to;
        /* Default control point: midpoint, slightly biased toward the higher
           of the two endpoints so the curve doesn't look like a straight line. */
        const cp = node.controlPoint || {
            cx: (from.cx + to.cx) / 2,
            cy: Math.min(from.cy, to.cy) - 0.08
        };

        for (let i = 0; i < N; i++) {
            const t = i / (N - 1);
            const oneMinusT = 1 - t;
            const cx = oneMinusT * oneMinusT * from.cx
                     + 2 * oneMinusT * t * cp.cx
                     + t * t * to.cx;
            const cy = oneMinusT * oneMinusT * from.cy
                     + 2 * oneMinusT * t * cp.cy
                     + t * t * to.cy;
            const { x, y } = this.canvasToWorld(cx, cy);
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = 0;
        }

        const progress = Math.max(0, Math.min(1, node.progress ?? 1));
        line.geometry.setDrawRange(0, Math.max(2, Math.floor(N * progress)));
        line.geometry.attributes.position.needsUpdate = true;
        line.geometry.computeBoundingSphere();

        if (line.material) {
            const colorAlpha = line.userData.colorAlpha ?? 1;
            line.material.opacity = (node.opacity ?? 1) * colorAlpha;
        }
    }

    _createGraphEdges(node) {
        const edges = node.edges || [];
        const positions = new Float32Array(Math.max(1, edges.length) * 6);
        const stemFlags = new Float32Array(Math.max(1, edges.length) * 2);

        for (let i = 0; i < edges.length; i++) {
            const e = edges[i];
            const a = this.canvasToWorld(e.from.cx, e.from.cy);
            const b = this.canvasToWorld(e.to.cx, e.to.cy);
            positions[i * 6 + 0] = a.x;
            positions[i * 6 + 1] = a.y;
            positions[i * 6 + 2] = 0;
            positions[i * 6 + 3] = b.x;
            positions[i * 6 + 4] = b.y;
            positions[i * 6 + 5] = 0;
            const flag = e.isStem ? 1.0 : 0.0;
            stemFlags[i * 2] = flag;
            stemFlags[i * 2 + 1] = flag;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('isStem', new THREE.BufferAttribute(stemFlags, 1));

        /* Spec uses rgba() strings for the dim baseline. THREE.Color drops
           alpha — extract it explicitly and feed it into the opacity uniform
           so the per-edge mix() stays multiplicative on top. */
        const baseParsed = parseColorWithAlpha(node.stroke || 'var(--xmr)', '#FF6600');
        const stemParsed = parseColorWithAlpha(node.stemStroke || node.stroke || 'var(--xmr)', '#FF6600');

        const material = new THREE.ShaderMaterial({
            vertexShader: `
                attribute float isStem;
                varying float vIsStem;
                void main() {
                    vIsStem = isStem;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float opacity;
                uniform float baseAlpha;
                uniform float stemAlpha;
                varying float vIsStem;
                void main() {
                    float alpha = mix(baseAlpha, stemAlpha, vIsStem);
                    gl_FragColor = vec4(color, opacity * alpha);
                }
            `,
            uniforms: {
                color: { value: baseParsed.color },
                opacity: { value: node.opacity ?? 1 },
                baseAlpha: { value: baseParsed.alpha },
                stemAlpha: { value: stemParsed.alpha }
            },
            transparent: true,
            depthWrite: false
        });

        const lineSegments = new THREE.LineSegments(geometry, material);
        lineSegments.userData.skipPosition = true;
        return lineSegments;
    }

    _createParticleTrail(node) {
        const group = new THREE.Group();
        group.userData.skipPosition = true;

        const headGeom = new THREE.PlaneGeometry(0.12, 0.12);
        const parsed = parseColorWithAlpha(node.fill || 'var(--xmr)', '#FF6600');
        const color = parsed.color;
        const headMat = new THREE.ShaderMaterial({
            vertexShader: glowVertexShader,
            fragmentShader: glowFragmentShader,
            uniforms: {
                color: { value: color },
                opacity: { value: (node.opacity ?? 0) * parsed.alpha },
                intensity: { value: 1.2 }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const headScale = ((node.r ?? 7) / 8) * 0.7;
        const head = new THREE.Mesh(headGeom, headMat);
        head.scale.set(headScale, headScale, 1);
        group.add(head);

        const trailLength = Math.max(2, node.trailLength || 12);
        const trailPositions = new Float32Array(trailLength * 3);
        const trailAlphas = new Float32Array(trailLength);
        const trailGeom = new THREE.BufferGeometry();
        trailGeom.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        trailGeom.setAttribute('alpha', new THREE.BufferAttribute(trailAlphas, 1));

        const trailMat = new THREE.ShaderMaterial({
            vertexShader: `
                attribute float alpha;
                varying float vAlpha;
                void main() {
                    vAlpha = alpha;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float opacity;
                varying float vAlpha;
                void main() {
                    gl_FragColor = vec4(color, vAlpha * opacity);
                }
            `,
            uniforms: {
                color: { value: color },
                opacity: { value: (node.opacity ?? 0) * parsed.alpha }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const trail = new THREE.Line(trailGeom, trailMat);
        group.add(trail);

        group.userData.head = head;
        group.userData.trail = trail;
        group.userData.trailLength = trailLength;
        group.userData.trailFade = node.trailFade ?? 0.85;
        group.userData.trailHistory = [];
        group.userData.colorAlpha = parsed.alpha;
        return group;
    }

    _updateParticleTrail(group, node) {
        if (!group.userData.head) return;

        const head = group.userData.head;
        const trail = group.userData.trail;
        const trailLength = group.userData.trailLength;
        const fade = group.userData.trailFade;
        const history = group.userData.trailHistory;
        const colorAlpha = group.userData.colorAlpha ?? 1;

        /* When the actor has no position to record AND no history to draw,
           skip — pre-spawn / post-fade frames have nothing to do. */
        const hasPosition = node.cx !== undefined && node.cy !== undefined;
        if (!hasPosition && history.length === 0) return;

        const { x, y } = hasPosition
            ? this.canvasToWorld(node.cx, node.cy)
            : history[history.length - 1];

        head.position.set(x, y, 0);
        head.material.uniforms.opacity.value = (node.opacity ?? 1) * colorAlpha;

        const last = history[history.length - 1];
        /* Only push when actually moved (avoids stale dense trail when paused). */
        if (hasPosition && (!last || Math.abs(last.x - x) > 1e-5 || Math.abs(last.y - y) > 1e-5)) {
            history.push({ x, y });
            if (history.length > trailLength) history.shift();
        }

        const positions = trail.geometry.attributes.position.array;
        const alphas = trail.geometry.attributes.alpha.array;
        for (let i = 0; i < trailLength; i++) {
            /* Pad the FIRST (trailLength - history.length) slots with the
               oldest sample, then map the remaining slots to the history
               in order. Defensive `||` chain guards against a future
               regression rather than crashing. */
            const histIdx = Math.max(0, history.length - trailLength + i);
            const point = history[histIdx] || history[history.length - 1] || { x, y };
            positions[i * 3] = point.x;
            positions[i * 3 + 1] = point.y;
            positions[i * 3 + 2] = 0;
            const t = i / Math.max(1, trailLength - 1);
            alphas[i] = Math.pow(t, 1 / Math.max(0.001, 1 - fade)) * 0.6;
        }
        trail.geometry.attributes.position.needsUpdate = true;
        trail.geometry.attributes.alpha.needsUpdate = true;
        trail.material.uniforms.opacity.value = (node.opacity ?? 1) * colorAlpha;
    }

    _createParticleBurst(node) {
        const particleCount = node.particleCount || 80;
        const positions = new Float32Array(particleCount * 3);
        const angles = new Float32Array(particleCount);
        const speeds = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
            angles[i] = Math.random() * Math.PI * 2;
            speeds[i] = 0.6 + Math.random() * 0.8;
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('angle', new THREE.BufferAttribute(angles, 1));
        geometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));

        const parsed = parseColorWithAlpha(node.fill || 'var(--xmr)', '#FF6600');
        const material = new THREE.ShaderMaterial({
            vertexShader: `
                attribute float angle;
                attribute float speed;
                uniform float radius;
                uniform float pixelRatio;
                void main() {
                    vec3 displaced = position + vec3(cos(angle) * radius * speed,
                                                     sin(angle) * radius * speed, 0.0);
                    vec4 mv = modelViewMatrix * vec4(displaced, 1.0);
                    gl_Position = projectionMatrix * mv;
                    gl_PointSize = 4.0 * pixelRatio;
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float opacity;
                uniform float radius;
                void main() {
                    vec2 c = gl_PointCoord - vec2(0.5);
                    float d = length(c) * 2.0;
                    float alpha = (1.0 - smoothstep(0.0, 1.0, d)) * opacity;
                    /* Particles dim as they fly out (trailing burst) */
                    alpha *= clamp(1.0 - radius * 1.4, 0.0, 1.0);
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            uniforms: {
                color: { value: parsed.color },
                opacity: { value: (node.opacity ?? 1) * parsed.alpha },
                radius: { value: node.radius ?? 0 },
                pixelRatio: { value: Math.min(2, window.devicePixelRatio || 1) }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const points = new THREE.Points(geometry, material);
        points.userData.material = material;
        points.userData.colorAlpha = parsed.alpha;
        return points;
    }

    _updateParticleBurst(mesh, node) {
        if (node.cx !== undefined && node.cy !== undefined) {
            const { x, y } = this.canvasToWorld(node.cx, node.cy);
            mesh.position.set(x, y, 0);
        }
        if (mesh.userData.material) {
            const colorAlpha = mesh.userData.colorAlpha ?? 1;
            mesh.userData.material.uniforms.radius.value = node.radius ?? 0;
            mesh.userData.material.uniforms.opacity.value = (node.opacity ?? 1) * colorAlpha;
        }
    }

    _createComparisonBar(node) {
        /* Horizontal bar anchored at canvas-fraction node.anchorX, growing
           rightward to width = node.barWidth (also in canvas-fraction units).
           PlaneGeometry(1,1) is centered at origin; we set position.x to the
           bar center and scale.x to the world-space bar width every frame. */
        const heightWorld = (node.height || 0.04) * this.frustumHeight;
        const geometry = new THREE.PlaneGeometry(1, heightWorld);
        const parsed = parseColorWithAlpha(node.fill || node.color || 'var(--xmr)', '#FF6600');
        const material = new THREE.MeshBasicMaterial({
            color: parsed.color,
            transparent: true,
            opacity: (node.opacity ?? 1) * parsed.alpha
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.barType = 'comparison-bar';
        mesh.userData.height = node.height || 0.04;
        mesh.userData.anchorX = node.anchorX ?? 0.10;
        mesh.userData.colorAlpha = parsed.alpha;
        mesh.userData.skipPosition = true;
        return mesh;
    }

    _updateComparisonBar(mesh, node) {
        const anchorX = mesh.userData.anchorX;
        const barWidth = Math.max(0, node.barWidth ?? 0);

        const centerCanvasX = anchorX + barWidth / 2;
        const { x, y } = this.canvasToWorld(centerCanvasX, node.cy ?? 0.85);
        mesh.position.set(x, y, 0);

        const worldWidth = barWidth * this.frustumWidth;
        mesh.scale.set(Math.max(1e-4, worldWidth), 1, 1);

        if (mesh.material) {
            const colorAlpha = mesh.userData.colorAlpha ?? 1;
            mesh.material.opacity = (node.opacity ?? 1) * colorAlpha;
        }
    }

    _createPedersenBlob(node) {
        const geometry = new THREE.PlaneGeometry(0.12, 0.12);
        const parsed = parseColorWithAlpha(node.fill || 'var(--xmr)', '#FF6600');
        const material = new THREE.ShaderMaterial({
            vertexShader: pedersenVertexShader,
            fragmentShader: pedersenFragmentShader,
            uniforms: {
                color: { value: parsed.color },
                opacity: { value: (node.opacity ?? 1) * parsed.alpha },
                time: { value: 0 },
                blobPhase: { value: node.blobPhase ?? 0 }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geometry, material);
        const r = node.r ?? 18;
        const scale = (r / 8) * 0.7;
        mesh.scale.set(scale, scale, 1);
        mesh.userData.pedersenMaterial = material;
        mesh.userData.colorAlpha = parsed.alpha;
        return mesh;
    }

    _updatePedersenBlob(mesh, node) {
        if (node.cx !== undefined && node.cy !== undefined) {
            const { x, y } = this.canvasToWorld(node.cx, node.cy);
            mesh.position.set(x, y, 0);
        }
        if (node.r !== undefined) {
            const scale = (node.r / 8) * 0.7;
            mesh.scale.set(scale, scale, 1);
        }
        const mat = mesh.userData.pedersenMaterial;
        if (!mat) return;
        const colorAlpha = mesh.userData.colorAlpha ?? 1;
        mat.uniforms.opacity.value = (node.opacity ?? 1) * colorAlpha;
        mat.uniforms.time.value = (performance.now() / 1000);
        mat.uniforms.blobPhase.value = node.blobPhase ?? 0;
    }

    _createRangeProofBand(node) {
        /* Group: a base bar + 3 concentric pulse rings overlaid. */
        const group = new THREE.Group();
        group.userData.skipPosition = true;

        const widthCanvas = node.width || 0.30;
        const heightCanvas = node.height || 0.06;
        const widthWorld = widthCanvas * this.frustumWidth;
        const heightWorld = heightCanvas * this.frustumHeight;

        const barGeom = new THREE.PlaneGeometry(widthWorld, heightWorld);
        const barParsed = parseColorWithAlpha(node.fill || 'rgba(255,102,0,0.18)', '#FF6600');
        const barMat = new THREE.MeshBasicMaterial({
            color: barParsed.color,
            transparent: true,
            opacity: (node.opacity ?? 1) * barParsed.alpha
        });
        const bar = new THREE.Mesh(barGeom, barMat);
        group.add(bar);

        const ringMeshes = [];
        const ringParsed = parseColorWithAlpha(node.stroke || 'var(--xmr)', '#FF6600');
        const baseRingRadius = heightWorld * 0.5;
        for (let i = 0; i < 3; i++) {
            const ringGeom = new THREE.RingGeometry(baseRingRadius * 0.92, baseRingRadius, 48);
            const ringMat = new THREE.MeshBasicMaterial({
                color: ringParsed.color,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const ring = new THREE.Mesh(ringGeom, ringMat);
            group.add(ring);
            ringMeshes.push(ring);
        }

        group.userData.bar = bar;
        group.userData.barMat = barMat;
        group.userData.barAlpha = barParsed.alpha;
        group.userData.rings = ringMeshes;
        group.userData.bandType = 'range-proof-band';
        return group;
    }

    _updateRangeProofBand(mesh, node) {
        if (node.cx !== undefined && node.cy !== undefined) {
            const { x, y } = this.canvasToWorld(node.cx, node.cy);
            mesh.position.set(x, y, 0);
        }

        const opacity = node.opacity ?? 1;
        const barAlpha = mesh.userData.barAlpha ?? 1;
        if (mesh.userData.barMat) {
            mesh.userData.barMat.opacity = opacity * barAlpha;
        }

        const pulsePhase = node.pulsePhase ?? 0;
        const t = (performance.now() / 1000) % 2;
        const rings = mesh.userData.rings || [];
        for (let i = 0; i < rings.length; i++) {
            const ring = rings[i];
            const stagger = i * 0.55;
            const localT = (t + stagger) % 2;
            const norm = localT / 2;
            const scale = 1 + norm * 6 * pulsePhase;
            ring.scale.set(scale, scale, 1);
            ring.material.opacity = (1 - norm) * 0.65 * pulsePhase * opacity;
        }
    }

    _createSignatureTrail(node) {
        const particleCount = node.particleCount || 80;
        const positions = new Float32Array(particleCount * 3);
        const phases = new Float32Array(particleCount);

        for (let i = 0; i < particleCount; i++) {
            phases[i] = i / particleCount;
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

        const parsed = parseColorWithAlpha(node.fill || 'var(--xmr)', '#FF6600');
        const material = new THREE.ShaderMaterial({
            vertexShader: signatureTrailVertexShader,
            fragmentShader: signatureTrailFragmentShader,
            uniforms: {
                color: { value: parsed.color },
                opacity: { value: (node.opacity ?? 1) * parsed.alpha },
                pathProgress: { value: node.pathProgress ?? 0 },
                trailLengthFrac: { value: 0.18 },
                pixelRatio: { value: Math.min(2, window.devicePixelRatio || 1) }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const points = new THREE.Points(geometry, material);
        points.userData.skipPosition = true;
        points.userData.signatureMaterial = material;
        points.userData.particleCount = particleCount;
        points.userData.colorAlpha = parsed.alpha;
        points.userData.pathSamplesNeeded = true;
        return points;
    }

    _buildSignatureTrailPath(particleCount) {
        /* The trail visits each ring member, then each output, then loops
           back to the first ring member. Ring positions are read from the
           gather-ring phase's transitions because the actor initialState
           holds off-screen spawn coords. */
        const ringFinalPositions = [];
        const outputPositions = [];

        const gatherPhase = this.spec.scene.phases.find(p => p.id === 'gather-ring');
        if (gatherPhase) {
            const indexed = [];
            for (const t of gatherPhase.transitions) {
                if (t.actorId.startsWith('ring-member-')) {
                    const idx = parseInt(t.actorId.slice('ring-member-'.length), 10);
                    indexed.push({
                        idx,
                        cx: t.targetState.cx,
                        cy: t.targetState.cy
                    });
                }
            }
            indexed.sort((a, b) => a.idx - b.idx);
            for (const p of indexed) ringFinalPositions.push({ cx: p.cx, cy: p.cy });
        }

        for (const actor of this.spec.actors) {
            if (actor.role === 'output') {
                outputPositions.push({
                    cx: actor.initialState.cx,
                    cy: actor.initialState.cy
                });
            }
        }

        if (ringFinalPositions.length === 0) {
            const samples = [];
            for (let i = 0; i < particleCount; i++) samples.push({ x: 0, y: 0 });
            return samples;
        }

        const waypoints = [
            ...ringFinalPositions,
            ...outputPositions,
            ringFinalPositions[0]
        ];

        const segLengths = [];
        let totalLength = 0;
        for (let i = 0; i < waypoints.length - 1; i++) {
            const dx = waypoints[i + 1].cx - waypoints[i].cx;
            const dy = waypoints[i + 1].cy - waypoints[i].cy;
            const len = Math.sqrt(dx * dx + dy * dy);
            segLengths.push(len);
            totalLength += len;
        }

        const samples = [];
        for (let i = 0; i < particleCount; i++) {
            const t = i / particleCount;
            let targetDist = t * totalLength;
            let segIdx = 0;
            let acc = 0;
            while (segIdx < segLengths.length - 1 && acc + segLengths[segIdx] < targetDist) {
                acc += segLengths[segIdx];
                segIdx++;
            }
            const localT = segLengths[segIdx] > 0
                ? (targetDist - acc) / segLengths[segIdx]
                : 0;
            const a = waypoints[segIdx];
            const b = waypoints[segIdx + 1];
            const cx = a.cx + (b.cx - a.cx) * localT;
            const cy = a.cy + (b.cy - a.cy) * localT;
            const world = this.canvasToWorld(cx, cy);
            samples.push({ x: world.x, y: world.y });
        }

        return samples;
    }

    _updateSignatureTrail(mesh, node) {
        if (mesh.userData.pathSamplesNeeded) {
            const samples = this._buildSignatureTrailPath(mesh.userData.particleCount);
            const positions = mesh.geometry.attributes.position.array;
            for (let i = 0; i < samples.length; i++) {
                positions[i * 3] = samples[i].x;
                positions[i * 3 + 1] = samples[i].y;
                positions[i * 3 + 2] = 0;
            }
            mesh.geometry.attributes.position.needsUpdate = true;
            mesh.userData.pathSamplesNeeded = false;
        }
        const mat = mesh.userData.signatureMaterial;
        if (!mat) return;
        const colorAlpha = mesh.userData.colorAlpha ?? 1;
        mat.uniforms.opacity.value = (node.opacity ?? 1) * colorAlpha;
        mat.uniforms.pathProgress.value = node.pathProgress ?? 0;
    }

    _createRingBoundary(node) {
        const ringGeom = new THREE.RingGeometry(0.95, 1.0, 64, 1, 0, Math.PI * 2);
        const parsed = parseColorWithAlpha(node.stroke || 'var(--xmr)', '#FF6600');
        const ringMat = new THREE.MeshBasicMaterial({
            color: parsed.color,
            transparent: true,
            opacity: (node.opacity ?? 0) * parsed.alpha,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(ringGeom, ringMat);
        const radiusCanvas = node.radius ?? 0.225;
        mesh.scale.set(
            radiusCanvas * this.frustumWidth,
            radiusCanvas * this.frustumHeight,
            1
        );
        mesh.userData.ringMat = ringMat;
        mesh.userData.colorAlpha = parsed.alpha;
        mesh.userData.radiusCanvas = radiusCanvas;
        return mesh;
    }

    _updateRingBoundary(mesh, node) {
        if (node.cx !== undefined && node.cy !== undefined) {
            const { x, y } = this.canvasToWorld(node.cx, node.cy);
            mesh.position.set(x, y, 0);
        }
        if (node.radius !== undefined && node.radius !== mesh.userData.radiusCanvas) {
            mesh.userData.radiusCanvas = node.radius;
            mesh.scale.set(
                node.radius * this.frustumWidth,
                node.radius * this.frustumHeight,
                1
            );
        }
        if (mesh.userData.ringMat) {
            const colorAlpha = mesh.userData.colorAlpha ?? 1;
            const seal = node.sealProgress ?? 1;
            mesh.userData.ringMat.opacity = (node.opacity ?? 1) * colorAlpha * seal;
        }
    }

    _createGhostOverlay(node) {
        const geom = new THREE.PlaneGeometry(this.frustumWidth, this.frustumHeight);
        const parsed = parseColorWithAlpha(node.fill || 'rgba(8,8,10,0.7)', '#08080a');
        const mat = new THREE.MeshBasicMaterial({
            color: parsed.color,
            transparent: true,
            opacity: 0,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geom, mat);
        /* Render in front of everything else (other actors are at z=0) */
        mesh.position.set(0, 0, 1);
        mesh.userData.skipPosition = true;
        mesh.userData.ghostMat = mat;
        mesh.userData.ghostAlpha = parsed.alpha;
        return mesh;
    }

    _updateGhostOverlay(mesh, node) {
        if (!mesh.userData.ghostMat) return;
        const fadeAmount = node.fadeAmount ?? 0;
        const ghostAlpha = mesh.userData.ghostAlpha ?? 1;
        mesh.userData.ghostMat.opacity = fadeAmount * ghostAlpha * (node.opacity ?? 1);
    }

    updateMesh(node) {
        const mesh = this.actorMeshes.get(node.id);
        if (!mesh) return;

        if (node.type === 'particle-trail') {
            this._updateParticleTrail(mesh, node);
            this.updateOverlayElement(node);
            return;
        }

        if (node.type === 'particle-burst') {
            this._updateParticleBurst(mesh, node);
            this.updateOverlayElement(node);
            return;
        }

        if (node.type === 'comparison-bar') {
            this._updateComparisonBar(mesh, node);
            this.updateOverlayElement(node);
            return;
        }

        if (node.type === 'pedersen-blob') {
            this._updatePedersenBlob(mesh, node);
            this.updateOverlayElement(node);
            return;
        }

        if (node.type === 'range-proof-band') {
            this._updateRangeProofBand(mesh, node);
            this.updateOverlayElement(node);
            return;
        }

        if (node.type === 'signature-trail') {
            this._updateSignatureTrail(mesh, node);
            this.updateOverlayElement(node);
            return;
        }

        if (node.type === 'ring-boundary') {
            this._updateRingBoundary(mesh, node);
            this.updateOverlayElement(node);
            return;
        }

        if (node.type === 'ghost-overlay') {
            this._updateGhostOverlay(mesh, node);
            this.updateOverlayElement(node);
            return;
        }

        if (node.cx !== undefined && node.cy !== undefined && !mesh.userData.skipPosition) {
            const { x, y } = this.canvasToWorld(node.cx, node.cy);
            mesh.position.set(x, y, 0);
        }

        if (node.type === 'ring' && node.scale !== undefined) {
            mesh.scale.set(node.scale, node.scale, 1);
        }

        if (node.type === 'circle' && node.r !== undefined) {
            const scale = (node.r / 8) * 0.7;
            mesh.scale.set(scale, scale, 1);
        }

        if (mesh.material) {
            if (mesh.material.uniforms && mesh.material.uniforms.opacity) {
                mesh.material.uniforms.opacity.value = node.opacity ?? 1;
            } else if ('opacity' in mesh.material) {
                mesh.material.opacity = node.opacity ?? 1;
            }
            if (mesh.material.uniforms && mesh.material.uniforms.intensity && node.glowIntensity !== undefined) {
                mesh.material.uniforms.intensity.value = node.glowIntensity;
            }
        }

        if (node.type === 'path') {
            if (mesh.userData && mesh.userData.bezierLine) {
                this._updateBezierLine(mesh, node);
            } else if (node.drawProgress !== undefined) {
                this._updateDensityCurve(mesh, node.drawProgress, node.meanDays ?? 7, node.sigma ?? 0.5);
            }
        }

        this.updateOverlayElement(node);
    }

    _updateDensityCurve(line, progress, meanDays, sigma) {
        const N = line.userData.curveSamples || 200;
        const limit = Math.max(2, Math.floor(N * Math.max(0, Math.min(1, progress))));

        const positions = line.geometry.attributes.position.array;

        const lnMean = Math.log(meanDays * 86400);
        const baselineCanvasY = 0.86;
        const peakCanvasY = 0.40;
        const peakSpan = baselineCanvasY - peakCanvasY;

        let pdfMax = 0;
        for (let i = 0; i < N; i++) {
            const t = i / (N - 1);
            const ageDays = Math.exp(Math.log(0.5) + t * (Math.log(1825) - Math.log(0.5)));
            const ageS = ageDays * 86400;
            const lnX = Math.log(Math.max(1, ageS));
            const pdf = Math.exp(-Math.pow(lnX - lnMean, 2) / (2 * sigma * sigma)) / (ageS * sigma * Math.sqrt(2 * Math.PI));
            if (pdf > pdfMax) pdfMax = pdf;
        }
        if (pdfMax === 0) pdfMax = 1;

        for (let i = 0; i < N; i++) {
            const t = i / (N - 1);
            const ageDays = Math.exp(Math.log(0.5) + t * (Math.log(1825) - Math.log(0.5)));
            const ageS = ageDays * 86400;
            const lnX = Math.log(Math.max(1, ageS));
            const pdf = Math.exp(-Math.pow(lnX - lnMean, 2) / (2 * sigma * sigma)) / (ageS * sigma * Math.sqrt(2 * Math.PI));
            const cy = baselineCanvasY - (pdf / pdfMax) * peakSpan;

            const cx = 0.95 - (1 - t) * 0.85;
            const { x: wx, y: wy } = this.canvasToWorld(cx, cy);
            positions[i * 3] = wx;
            positions[i * 3 + 1] = wy;
            positions[i * 3 + 2] = 0;
        }

        line.geometry.setDrawRange(0, limit);
        line.geometry.attributes.position.needsUpdate = true;
        line.geometry.computeBoundingSphere();
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
        el.style.willChange = 'top, left, opacity';

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
        const mesh = this.actorMeshes.get(actorId);
        if (mesh) {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
            this.scene.remove(mesh);
            this.actorMeshes.delete(actorId);
        }
        const el = this.actorOverlayElements.get(actorId);
        if (el) {
            el.remove();
            this.actorOverlayElements.delete(actorId);
        }
    }

    destroy() {
        if (this.resizeObserver) this.resizeObserver.disconnect();
        for (const mesh of this.actorMeshes.values()) {
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
            this.scene.remove(mesh);
        }
        this.actorMeshes.clear();
        for (const el of this.actorOverlayElements.values()) {
            el.remove();
        }
        this.actorOverlayElements.clear();
        this.three.dispose();
    }
}
