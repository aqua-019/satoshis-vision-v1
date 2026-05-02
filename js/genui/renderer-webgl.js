/**
 * WebGL renderer using Three.js r128.
 *
 * Prompt S provides the scaffolding (Three.js init, scene/camera/renderer setup).
 * Prompt T fills in the actual rendering of a SimulationSpec.
 */

import * as THREE from 'three';

export class WebGLRenderer {
    constructor(mountEl, spec) {
        this.mountEl = mountEl;
        this.spec = spec;
        this.canvas = mountEl.querySelector('.genui-canvas');

        if (!this.canvas) {
            throw new Error('GenUI WebGLRenderer: no .genui-canvas in mount');
        }

        const { width, height } = this.canvas.getBoundingClientRect();

        /* Standard Three.js init */
        this.three = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.three.setSize(width, height, false);
        this.three.setPixelRatio(window.devicePixelRatio || 1);

        this.scene = new THREE.Scene();
        const bg = spec.render.backgroundColor || '#0a0a0a';
        this.scene.background = new THREE.Color(bg);

        /* Orthographic camera by default — easier for 2D-ish protocol diagrams.
           Specific sims can override by extending this renderer in their module. */
        const aspect = width / height;
        const frustumSize = 2;
        this.camera = new THREE.OrthographicCamera(
            -frustumSize * aspect / 2, frustumSize * aspect / 2,
            frustumSize / 2, -frustumSize / 2,
            0.1, 100
        );
        this.camera.position.z = 10;

        /* Resize on window change */
        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(mountEl);

        /* Track Three.js objects by actor ID for diff/patch */
        this.actorMeshes = new Map();
    }

    handleResize() {
        const { width, height } = this.canvas.getBoundingClientRect();
        this.three.setSize(width, height, false);

        const aspect = width / height;
        const frustumSize = 2;
        this.camera.left = -frustumSize * aspect / 2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = -frustumSize / 2;
        this.camera.updateProjectionMatrix();
    }

    /**
     * Update the scene from a scene graph.
     * Prompt T replaces this stub with real geometry creation/updates.
     */
    update(sceneGraph) {
        /* Stub: render the empty scene */
        this.three.render(this.scene, this.camera);
    }

    destroy() {
        this.resizeObserver.disconnect();
        this.three.dispose();
        for (const mesh of this.actorMeshes.values()) {
            mesh.geometry?.dispose();
            mesh.material?.dispose();
        }
        this.actorMeshes.clear();
    }
}
