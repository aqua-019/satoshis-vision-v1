/**
 * GenUI type definitions — JSDoc form, no TypeScript runtime.
 * Maps the Phase 4 spec data model into JS for IDE autocomplete and validation.
 *
 * @typedef {object} SimulationSpec
 * @property {string} id - Unique simulation identifier (kebab-case)
 * @property {string} title - Display title
 * @property {string} subtitle - One-line description
 * @property {string} educationalGoal - 1-2 sentences: what should the user understand?
 * @property {Actor[]} actors
 * @property {Parameter[]} parameters
 * @property {Scene} scene
 * @property {RenderHints} render
 * @property {Inspector[]} inspectors
 *
 * @typedef {object} Actor
 * @property {string} id
 * @property {string} role
 * @property {object} initialState
 * @property {object} visualMapping
 *
 * @typedef {object} Parameter
 * @property {string} id
 * @property {string} label
 * @property {('number'|'choice'|'boolean')} type
 * @property {(number|string|boolean)} default
 * @property {number} [min]
 * @property {number} [max]
 * @property {number} [step]
 * @property {Array<{value: string, label: string}>} [choices]
 * @property {string[]} [affects]
 *
 * @typedef {object} Scene
 * @property {number} duration - Total runtime in ms
 * @property {boolean} autoPlay
 * @property {boolean} loop
 * @property {Phase[]} phases
 *
 * @typedef {object} Phase
 * @property {string} id
 * @property {string} label
 * @property {number} startMs
 * @property {number} durationMs
 * @property {string} description
 * @property {Transition[]} transitions
 * @property {string} [narrationKey]
 *
 * @typedef {object} Transition
 * @property {string} actorId
 * @property {object} targetState
 * @property {string} easing
 * @property {number} [delayMs]
 *
 * @typedef {object} RenderHints
 * @property {('webgl'|'svg'|'canvas2d')} primaryRenderer
 * @property {('svg'|'canvas2d')} [fallbackRenderer]
 * @property {{width: number, height: number, aspectRatio?: string}} viewport
 * @property {string} backgroundColor
 * @property {('full'|'reduced'|'static')} motionPreference
 * @property {number} [fpsTarget]
 *
 * @typedef {object} Inspector
 * @property {string} triggerActorId
 * @property {string} panelTitle
 * @property {Array<{label: string, valueFromActor: string}>} fields
 */

export const TYPES = {};   // Empty export so this is a valid ES module
