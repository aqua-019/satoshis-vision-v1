/* ═══════════════════════════════════════════════════════════════
   3D Engine — xmr.irish v4.0
   Shared math + rendering primitives for Canvas 2D visualizations.
   Import: import { TAU, PI, proj, rX, rY, rZ, hx, clamp } from './3d-engine.js';
   ═══════════════════════════════════════════════════════════════ */

export const TAU = Math.PI * 2;
export const PI = Math.PI;

/**
 * Perspective projection from 3D → 2D.
 * @param {number} x,y,z  — 3D coordinates (centered at 0,0,0)
 * @param {number} cx,cy  — 2D canvas center
 * @param {number} f      — focal length (default 600)
 * @returns {{ x: number, y: number, s: number, z: number }}
 */
export function proj(x, y, z, cx, cy, f) {
    f = f || 600;
    var s = f / (f + z);
    return { x: cx + x * s, y: cy + y * s, s: s, z: z };
}

/**
 * Rotate point around X axis.
 */
export function rX(p, a) {
    var c = Math.cos(a), s = Math.sin(a);
    return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}

/**
 * Rotate point around Y axis.
 */
export function rY(p, a) {
    var c = Math.cos(a), s = Math.sin(a);
    return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}

/**
 * Rotate point around Z axis.
 */
export function rZ(p, a) {
    var c = Math.cos(a), s = Math.sin(a);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}

/**
 * Convert hex color + alpha to rgba() string.
 * @param {string} hex — e.g. '#FF6600'
 * @param {number} a   — alpha 0–1
 * @returns {string}
 */
export function hx(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
}

/**
 * Clamp a value between lo and hi.
 */
export function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}
