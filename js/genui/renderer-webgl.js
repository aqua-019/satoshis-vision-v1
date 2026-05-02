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

    updateMesh(node) {
        const mesh = this.actorMeshes.get(node.id);
        if (!mesh) return;

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
