# Phase 4 — GenUI 12-Step Pipeline Specification

**Status:** Frozen reference. Sign-off baseline for Phase 5 implementation.
**Owner:** [xmr.irish](http://xmr.irish) v4.0 architecture.
**Scope:** Pipeline architecture + data shapes that Phase 5's interactive simulations will use.
**Out of scope:** Working pseudocode, AI-generated UI, art gallery specs.

---

## Provisional name notice

Per planning agreement, the system is currently called "GenUI" — name inherited from earlier project memory. This name is **provisional through v4.0**. The system is not generative-AI-driven; it's deterministic spec-driven rendering. A more descriptive name (e.g., "Protocol Simulator Pipeline" or "Sim Engine") will be adopted in v5.0 once the broader system is stable. Documentation in v4.0 keeps "GenUI" for continuity with prior planning artifacts; rename is a documentation refactor for v5.0.

---

## Why this exists

Phase 5 will ship five interactive simulations of Monero protocol behaviors:

1. **Decoy selection algorithm** — log-normal age sampling that picks 16 ring members
2. **Dandelion++ stem-phase propagation** — tx propagating through a stem path before broadcast
3. **View tag matching** — wallet scan with and without view tags
4. **RingCT signature construction** — input → ring → CLSAG signature → output commitments
5. **Stealth address derivation** — sender computes one-time address from recipient's public keys

Each simulation needs to:
- Accept user-modifiable parameters (where applicable)
- Render visually with motion that communicates the protocol mechanism
- Stay stylistically consistent with the rest of the d10 design system
- Be debuggable, testable, and inspectable
- Educate without being a math lecture

Building each simulation as a one-off would produce five separately-maintained codebases with five different rendering approaches. The 12-step pipeline gives each simulation a shared spine — a declarative description, a deterministic renderer, a shared component vocabulary, a uniform inspection layer.

The pipeline also positions us for what comes after Phase 5: any future protocol-behavior simulation we want to add becomes a new spec file rather than a new codebase.

---

## Architectural framing

### Three layers, separated cleanly

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 — SPEC                                             │
│  A simulation is defined by a JS object describing actors,  │
│  parameters, scene timeline, and visual mappings.           │
│  Pure data. No DOM, no WebGL, no logic.                     │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2 — ENGINE                                           │
│  The 12-step pipeline. Reads a spec, produces frames.       │
│  Stateless across simulations — same engine drives all 5.   │
├─────────────────────────────────────────────────────────────┤
│  LAYER 3 — RENDERER                                         │
│  Translates frames into actual visual output. WebGL is the  │
│  default; SVG is the accessibility fallback only. The block │
│  parade and hold-monero charts remain Canvas 2D — those are │
│  separate, working code paths that GenUI does not absorb.   │
└─────────────────────────────────────────────────────────────┘
```

The boundary between layers is strict. The spec doesn't know how it'll be rendered. The engine doesn't know what WebGL looks like. The renderer doesn't know what protocol behavior the spec describes.

### Why WebGL by default

User feedback during planning: the visual ceiling of v4.0 should be ambitious. WebGL is the right default for protocol simulations:

- **GPU-accelerated.** Particle effects, glow trails, additive blending all run on the GPU.
- **Shader-driven aesthetics.** The Pedersen-blob distortion in RingCT and the Diffie-Hellman beam convergence in stealth address are shader-defined visuals that DOM-based SVG can't render.
- **Depth and atmospheric effects.** Slight depth-of-field on inactive actors, additive glow halos that read clearly against deep neutral backgrounds.
- **60fps with high element counts.** Some sims (RingCT at ringSize 64) push element counts that would tax SVG's reflow path.
- **Headroom.** v4.0 ships with foundation; v5.0 polishes. WebGL gives v5.0 room to grow without forcing a renderer migration.

SVG remains the accessibility fallback (users on hardware that can't run WebGL get a graceful degradation), but the polished v4.0 experience is the WebGL path.

Canvas 2D is reserved for the existing block parade and hold-monero charts, which work and ship. GenUI does not migrate those.

### What "GenUI" means in this context (provisional name)

To be clear about what it is and isn't:

- **Is:** a declarative spec → deterministic UI pipeline. Specs describe simulations. Engine reads specs. Output is reproducible — same spec produces the same frames every time.
- **Is not:** LLM-generated UI. There's no Anthropic API call in the rendering path. The "Gen" in the inherited name refers to the spec-driven generation of the visual scene, not generative AI.

The name is provisional. v5.0 documentation rename is part of v5.0 polish.

---

## Data model — the spec format

This is the canonical shape Phase 5 simulations conform to.

```typescript
type SimulationSpec = {
    /* IDENTIFICATION */
    id: string;
    title: string;
    subtitle: string;
    educationalGoal: string;

    /* ACTORS — entities in the simulation */
    actors: Actor[];

    /* PARAMETERS — user-modifiable inputs */
    parameters: Parameter[];

    /* SCENE — the timeline of what happens */
    scene: Scene;

    /* RENDER HINTS — guidance for the renderer */
    render: RenderHints;

    /* INSPECTION — what the user can probe */
    inspectors: Inspector[];
};

type Actor = {
    id: string;
    role: 'sender' | 'recipient' | 'ring-member' | 'tx' | 'node' | 'wallet' | 'output' | 'key' | string;
    initialState: Record<string, any>;
    visualMapping: {
        shape: 'circle' | 'rect' | 'path' | 'group' | 'text' | 'particle' | 'mesh' | 'instanced';
        attrs: Record<string, string | number>;
        labels?: { text: string; placement: 'above' | 'below' | 'inside' | 'right' | 'left' }[];
        webgl?: {
            material: 'standard' | 'glow' | 'distortion' | 'beam' | string;  // shader variant
            blendMode?: 'normal' | 'additive';
        };
    };
};

type Parameter = {
    id: string;
    label: string;
    type: 'number' | 'choice' | 'boolean';
    default: number | string | boolean;
    min?: number;
    max?: number;
    step?: number;
    choices?: { value: string; label: string }[];
    affects: string[];
};

type Scene = {
    duration: number;       // ms
    autoPlay: boolean;
    loop: boolean;
    phases: Phase[];
};

type Phase = {
    id: string;
    label: string;
    startMs: number;
    durationMs: number;
    description: string;
    transitions: Transition[];
    narrationKey?: string;  // optional; supports future narrate mode
};

type Transition = {
    actorId: string;
    targetState: Record<string, any>;
    easing: 'linear' | 'ease-in' | 'ease-out' | 'cubic-bezier(...)' | string;
    delayMs?: number;
};

type RenderHints = {
    primaryRenderer: 'webgl' | 'svg' | 'canvas2d';   // default: 'webgl'
    fallbackRenderer?: 'svg' | 'canvas2d';
    viewport: { width: number; height: number; aspectRatio?: string };
    backgroundColor: string;
    motionPreference: 'full' | 'reduced' | 'static';
    fpsTarget?: number;
};

type Inspector = {
    triggerActorId: string;
    panelTitle: string;
    fields: { label: string; valueFromActor: string }[];
};
```

A complete simulation is approximately 200-400 lines of JS in this shape. Phase 5's first deliverable per simulation is its spec object.

---

## The 12-step pipeline

Each step is single-purpose. Each step's output feeds the next. The pipeline is synchronous within a frame.

### Step 1 — Spec validation

**Input:** raw `SimulationSpec` object.
**Output:** validated spec, OR thrown error with diagnostic.

Verify all required fields, ID uniqueness, phase timeline non-overlap, visual mapping references shapes/materials the renderer supports, easing strings are valid CSS, parameter types and defaults agree, inspector field paths resolve.

### Step 2 — Parameter resolution

**Input:** validated spec + current parameter values.
**Output:** resolved parameter context — a flat object mapping `[parameter.id](http://parameter.id) → currentValue`.

Each simulation has parameter controls (sliders, dropdowns, toggles) that re-trigger this step. Parameter changes propagate forward; everything downstream re-derives.

### Step 3 — Scene materialization

**Input:** resolved parameter context.
**Output:** materialized scene — actor states pre-computed for each phase boundary.

Walk the scene's phases in order. For each phase, apply transitions to actors and store the resulting state. By the end, we have a scene graph at every keyframe.

This step is where simulations diverge: decoy selection's scene materialization runs the actual log-normal sampling. Stealth address derivation runs the actual elliptic curve scalar multiplication. The mathematics live here, in step 3, where they belong — close to the spec, far from the renderer.

This step produces only data. No DOM, no WebGL, nothing visual.

### Step 4 — Visual scene graph construction

**Input:** materialized scene.
**Output:** scene graph — a tree of nodes describing what to render at this moment.

Translate actor state into renderer-agnostic visual elements. A ring-member actor at position (x: 320, y: 180) with state `isSelected: true` becomes a scene-graph node:

```js
{
    id: 'ring-member-3',
    type: 'instanced-disc',
    cx: 320, cy: 180, r: 12,
    fill: 'var(--xmr)',
    stroke: 'var(--text-primary)',
    strokeWidth: 2,
    material: 'glow',
    blendMode: 'additive',
    labels: [{ text: '#3 (true spender)', placement: 'below' }],
    interactive: true,
    inspectorRef: 'ring-member-detail'
}
```

This is the renderer's input. Critically: still no WebGL calls. Just structured data.

### Step 5 — Animation interpolation

**Input:** scene graph + current playback time.
**Output:** scene graph with attributes interpolated to the current time.

If the current time falls between two keyframes, lerp the actor attributes. WebGL renderer takes interpolated values and updates Three.js (or equivalent) instanced positions, attributes, and uniforms. Reduced-motion preference (system-level accessibility) collapses easing to `step-end` — animations become instantaneous transitions.

### Step 6 — Style token resolution

**Input:** interpolated scene graph.
**Output:** scene graph with all style values resolved.

Replace `var(--xmr)` with `#FF6600`, etc. Specs reference design tokens semantically; the renderer gets concrete values. Dark/light mode adaptation would happen here — for v4.0 the site is dark-only, so this step is largely a passthrough.

### Step 7 — Accessibility annotation

**Input:** style-resolved scene graph.
**Output:** scene graph with `aria-*` attributes attached to every interactive node.

WebGL canvas itself isn't navigable by screen readers — the HTML overlay layer (annotations, inspector panels, parameter sliders) carries all aria attributes. Each actor's overlay element gets:

- `role` (button, group, img depending on type)
- `aria-label` derived from actor metadata
- `tabindex` if interactive
- `aria-describedby` pointing to inspector details when inspectors exist

Reduced-motion users get an additional set of `aria-live` regions describing phase transitions in text — they hear what they can't see animate.

### Step 8 — Render target selection

**Input:** annotated scene graph + RenderHints from spec.
**Output:** dispatch to one of three renderers (WebGL / SVG / Canvas 2D).

For all five Phase 5 simulations, this dispatches to **WebGL** by default. SVG is the fallback when WebGL context creation fails (hardware refusal, browser disabled, etc.). Canvas 2D is reserved for the existing block parade and hold-monero charts — those are separate code paths.

The dispatcher is data-driven — change `RenderHints.primaryRenderer` in the spec, the simulation re-renders with the new approach, no engine changes needed.

The WebGL renderer is the reference implementation for v4.0. The SVG fallback path delivers the same scene with degraded visual fidelity (no shaders, no particle effects, no additive blending, no depth).

### Step 9 — DOM/scene patch

**Input:** scene graph + previously-rendered scene graph.
**Output:** minimal renderer mutations.

Standard diff-and-patch. For WebGL: Three.js InstancedMesh attribute updates, uniform updates, scene-add/remove for nodes that appeared/disappeared. For SVG: the same DOM diff approach as Draft 1.

This step is what keeps the simulations fast. A scene with 16 ring members and 12 keyframes shouldn't trigger 192 mutations per frame; it should trigger only what actually changed.

### Step 10 — Phase indicator update

**Input:** current phase + phase metadata.
**Output:** DOM updates to the phase-indicator UI chrome.

The chrome around each simulation includes:
- Current phase name + description
- Phase progress bar (shows position within current phase)
- Total scene progress bar
- Play/pause/restart controls
- Parameter sliders / dropdowns

This step updates the chrome based on playback position. Visually distinct from the simulation itself — chrome lives in HTML, simulation lives in WebGL canvas.

### Step 11 — Inspector binding

**Input:** scene graph nodes + inspector definitions from spec.
**Output:** event listeners attached to interactive overlay nodes.

For every actor with an inspector defined, wire up:
- `mouseenter` → show inspector panel near the actor (raycasting from cursor to WebGL scene; HTML overlay listener fires)
- `mouseleave` → hide panel
- `click` (mobile) → toggle pinned inspector
- `keyboard focus` → show panel + announce content via `aria-describedby`

The inspector panel reuses the legal-tooltips pattern from Prompt P. Same DOM structure, same a11y posture, same dismissal rules.

For WebGL specifically: hovering over a WebGL canvas requires raycasting from the cursor position into the scene to identify which actor is under the cursor. Three.js provides this via Raycaster. The HTML overlay element for that actor then gets the inspector binding.

### Step 12 — Frame commit + telemetry

**Input:** final patched renderer state.
**Output:** frame committed; telemetry hook fired (gated on `window._xmrDebug`).

When `_xmrDebug` is true, log per-frame data: which step took how long, which actors mutated, scene-graph node count, renderer dispatch target, draw call count. Useful for performance tuning a simulation that drops frames.

In production, step 12 is a no-op.

---

## Five simulations: spec sketches

Each is a one-paragraph sketch of how the pipeline applies. Phase 5 implementation prompts will deepen each into a working spec — see the companion document `[v4-phase5-simulations.md](http://v4-phase5-simulations.md)` for the full briefs.

### 1. Decoy selection algorithm

- **Actors:** 16 ring-member outputs (one true spender, 15 decoys), one chain-tip marker, age-distribution density curve.
- **Parameters:** ring size (default 16), spend output age (slider).
- **Scene phases:** spawn-chain → sample-distribution → select-decoys → mark-true-spender → obscure.
- **Renderer:** WebGL primary; SVG fallback.
- **Particle effect signature:** sampling-trail particles (~30/sim).
- **Educational goal:** "The true spender is one of 16 ring members. Statistical analysis cannot reliably identify which one because all 16 are sampled from the same distribution."

### 2. Dandelion++ stem-phase propagation

- **Actors:** ~30 mempool nodes, one transaction packet, edges between nodes.
- **Parameters:** stem length, fluff probability per hop, network topology preset.
- **Scene phases:** network-spawn → tx-origin → stem-walk → fluff-trigger → broadcast.
- **Renderer:** WebGL primary; SVG fallback.
- **Particle effect signature:** stem-walk trail (single particle), fluff-burst (~80 particles).
- **Educational goal:** "Before broadcast, transactions take a randomized walk through stem nodes. Observers can't easily trace the originator from the broadcast pattern."

### 3. View tag matching

- **Actors:** ~150 wallet outputs, wallet scan cursor, view-tag check indicator, full-decryption indicator.
- **Parameters:** number of outputs to scan, view tags enabled toggle.
- **Scene phases:** outputs-spawn → scan-without-tags → scan-with-tags → comparison-bars.
- **Renderer:** WebGL primary; SVG fallback.
- **Particle effect signature:** minimal — this sim is mostly static layout with motion.
- **Educational goal:** "View tags let wallets skip ~99% of outputs without compromising privacy — a 256× scan speedup."

### 4. RingCT signature construction

- **Actors:** input UTXO, 15 decoy outputs, ring container, output commitments, range-proof band, CLSAG signature aggregator.
- **Parameters:** ring size (default 16), output count (default 2: payment + change).
- **Scene phases:** select-input → gather-ring → seal-ring → build-commitments → range-proof → sign-clsag → broadcast → outro.
- **Renderer:** WebGL primary; SVG fallback. **Custom shaders required** for the Pedersen-blob distortion effect.
- **Particle effect signature:** signature trail (~80 particles tracing the ring → outputs path).
- **Educational goal:** "A confidential transaction proves it's valid without revealing the amounts or which input was spent."

### 5. Stealth address derivation

- **Actors:** sender (Alice), recipient (Bob), public view-key + spend-key, random scalar `r`, computed `R = rG`, computed shared secret, derived one-time address.
- **Parameters:** none (pure cryptographic walkthrough).
- **Scene phases:** setup → random-scalar → compute-R → derive-shared-secret → compute-address → recipient-watches → output-arrives.
- **Renderer:** WebGL primary; SVG fallback. **Custom shaders required** for the Diffie-Hellman beam convergence effect (two beams meeting at a single point).
- **Particle effect signature:** Diffie-Hellman beams + convergence-point glow.
- **Educational goal:** "Every Monero transaction goes to a one-time address only the recipient can recognize."

---

## Component vocabulary

The renderer ships with a small library of reusable visual primitives:

- **`actor-circle`** — disc with optional glow, the most common primitive
- **`actor-rect`** — rectangle for blocks, packets, containers
- **`flow-arrow`** — directed arrow between two actors with optional animation
- **`graph-edge`** — undirected line between two actors (network topology)
- **`particle-stream`** — emits particles from one point toward another
- **`scene-axis`** — coordinate axis with tick marks (for charts within simulations)
- **`text-callout`** — labeled annotation pointing at an actor (HTML overlay)

For WebGL specifically, the primitives compose as:
- `actor-circle` → `THREE.InstancedMesh` of circle geometry with glow shader material
- `flow-arrow` → `THREE.Line` with animated dash material
- `graph-edge` → `THREE.LineSegments`
- `particle-stream` → `THREE.Points` system with particle shader

---

## Architectural decisions (confirmed)

1. **Specs in JS modules** — confirmed. Allows computed defaults referencing runtime values.

2. **Multiple simultaneous simulations** — confirmed lazy-instantiated with per-engine instances. Memory cost bounded.

3. **Existing Canvas 2D code** — confirmed UNTOUCHED. GenUI does not absorb block parade or hold-monero charts. Working code stays.

4. **Inspector panel singleton** — confirmed. Reuses legal-tooltips component from Prompt P. Aesthetic consistency wins over per-sim flexibility.

5. **Parameter change re-runs** — confirmed full pipeline re-run, optimize only if measured to be a problem.

6. **Narrate mode** — confirmed deferred. Spec carries `Phase.narrationKey?` for future addition. v4.0 ships without narrate audio.

---

## Verification scaffolding (for Phase 5)

When Phase 5 implements each simulation, it should pass these checks:

1. The simulation spec validates per Step 1 without errors.
2. The simulation runs in WebGL primary mode at 60fps with default parameters.
3. The simulation gracefully falls back to SVG if WebGL is unavailable.
4. With `prefers-reduced-motion: reduce` set in the OS, animations collapse to static keyframes.
5. The simulation is accessible via keyboard alone — Tab walks through interactive actors, Enter activates inspector panels, Esc dismisses.
6. The simulation passes axe DevTools accessibility audit with no critical issues.
7. With `window._xmrDebug = true`, the per-frame telemetry shows step timings; no step exceeds 8ms.
8. The simulation's parameter changes produce visibly different results.
9. The simulation's educational goal is achievable in under 90 seconds of viewing.

---

## What this spec deliberately leaves unspecified

- **Library selection (Three.js vs alternatives).** Recommended Three.js; final selection deferred to first Phase 5 implementation prompt.
- **Bundling strategy.** Each simulation might be a separate JS file or all bundled. TBD based on total payload.
- **Tests.** Phase 5 will write per-simulation tests.
- **The generative art gallery.** Phase 5 includes "five interactive simulations + generative art gallery." Art gallery is a separate workstream — uses the same renderer infrastructure but with non-protocol-educational specs. Will be specified separately.

---

## Definition of done for Phase 4

This spec is "done" when:
- User has reviewed and signed off on the architecture ✓
- The five simulation sketches accurately reflect what Phase 5 will build (companion `[v4-phase5-simulations.md](http://v4-phase5-simulations.md)` document)
- The six open questions have answers ✓ (all confirmed)
- The spec is committed to the repo at `docs/[v4-phase4-genui-spec.md](http://v4-phase4-genui-spec.md)` ✓
- The companion simulation briefs are committed to the repo at `docs/[v4-phase5-simulations.md](http://v4-phase5-simulations.md)` (same commit)
- Phase 5 can begin implementation with these documents as its contract

After this commit, this becomes a frozen reference. Phase 5 implementation prompts cite specific sections of this spec and the simulation briefs; deviations require a spec amendment, not a unilateral implementation decision.
