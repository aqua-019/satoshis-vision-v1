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

function resolveCssColor(c, fallback = '#FF6600') {
    if (typeof c !== 'string') return fallback;
    const match = c.match(/^var\((--[a-z0-9-]+)\)$/i);
    if (!match) return c;
    const computed = getComputedStyle(document.documentElement);
    const v = computed.getPropertyValue(match[1]).trim();
    return v || fallback;
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
            mesh = this._createDensityCurveLine(node);
        } else if (node.type === 'graph-edge') {
            mesh = this._createGraphEdges(node);
        } else if (node.type === 'particle-trail') {
            mesh = this._createParticleTrail(node);
        } else if (node.type === 'particle-burst') {
            mesh = this._createParticleBurst(node);
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

        const baseColor = new THREE.Color(resolveCssColor(node.stroke || 'var(--xmr)', '#FF6600'));

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
                color: { value: baseColor },
                opacity: { value: node.opacity ?? 1 },
                baseAlpha: { value: 0.18 },
                stemAlpha: { value: 0.42 }
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
        const color = new THREE.Color(resolveCssColor(node.fill || 'var(--xmr)', '#FF6600'));
        const headMat = new THREE.ShaderMaterial({
            vertexShader: glowVertexShader,
            fragmentShader: glowFragmentShader,
            uniforms: {
                color: { value: color },
                opacity: { value: node.opacity ?? 0 },
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
                opacity: { value: node.opacity ?? 0 }
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
        return group;
    }

    _updateParticleTrail(group, node) {
        if (!group.userData.head) return;
        const { x, y } = this.canvasToWorld(node.cx ?? 0.5, node.cy ?? 0.5);
        const head = group.userData.head;
        const trail = group.userData.trail;
        const trailLength = group.userData.trailLength;
        const fade = group.userData.trailFade;

        head.position.set(x, y, 0);
        head.material.uniforms.opacity.value = node.opacity ?? 1;

        const history = group.userData.trailHistory;
        const last = history[history.length - 1];
        /* Only push when actually moved (avoids stale dense trail when paused). */
        if (!last || Math.abs(last.x - x) > 1e-5 || Math.abs(last.y - y) > 1e-5) {
            history.push({ x, y });
            if (history.length > trailLength) history.shift();
        }

        const positions = trail.geometry.attributes.position.array;
        const alphas = trail.geometry.attributes.alpha.array;
        const len = history.length;
        for (let i = 0; i < trailLength; i++) {
            const histIdx = i + (trailLength - len);
            const point = histIdx >= 0 ? history[histIdx] : history[0] || { x, y };
            positions[i * 3] = point.x;
            positions[i * 3 + 1] = point.y;
            positions[i * 3 + 2] = 0;
            const t = i / Math.max(1, trailLength - 1);
            alphas[i] = Math.pow(t, 1 / Math.max(0.001, 1 - fade)) * 0.6;
        }
        trail.geometry.attributes.position.needsUpdate = true;
        trail.geometry.attributes.alpha.needsUpdate = true;
        trail.material.uniforms.opacity.value = node.opacity ?? 1;
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

        const color = new THREE.Color(resolveCssColor(node.fill || 'var(--xmr)', '#FF6600'));
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
                color: { value: color },
                opacity: { value: node.opacity ?? 1 },
                radius: { value: node.radius ?? 0 },
                pixelRatio: { value: Math.min(2, window.devicePixelRatio || 1) }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const points = new THREE.Points(geometry, material);
        points.userData.material = material;
        return points;
    }

    _updateParticleBurst(mesh, node) {
        if (node.cx !== undefined && node.cy !== undefined) {
            const { x, y } = this.canvasToWorld(node.cx, node.cy);
            mesh.position.set(x, y, 0);
        }
        if (mesh.userData.material) {
            mesh.userData.material.uniforms.radius.value = node.radius ?? 0;
            mesh.userData.material.uniforms.opacity.value = node.opacity ?? 1;
        }
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

        if (node.type === 'path' && node.drawProgress !== undefined) {
            this._updateDensityCurve(mesh, node.drawProgress, node.meanDays ?? 7, node.sigma ?? 0.5);
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
