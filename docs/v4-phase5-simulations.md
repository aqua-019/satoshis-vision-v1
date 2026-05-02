# Phase 5 — Five Simulation Briefs

**Status:** Frozen reference. Implementation contract for Phase 5 prompts (T+).
**Depends on:** Phase 4 spec (`docs/[v4-phase4-genui-spec.md](http://v4-phase4-genui-spec.md)`).
**Scope:** Working briefs for each of the five Phase 5 simulations. Each brief is a standalone implementation contract — Phase 5 implementation prompts will cite these as their source of truth.
**Out of scope:** Actual simulation code. These are specs, not implementations.

---

## How to read this document

Each brief follows the same shape:
- **Educational goal** — the one thing the user should understand after watching
- **Actors** — every entity that appears on screen, with WebGL render specifics
- **Parameters** — what the user can change
- **Scene timeline** — phase-by-phase breakdown with timing
- **Visual treatment** — WebGL specifics, color/motion vocabulary
- **Inspectors** — what's hoverable/clickable
- **Accessibility** — keyboard navigation, reduced-motion behavior, narration text
- **Verification** — how to know the simulation is "done"

Phase 5 implementation should not deviate from these briefs without proposing a spec amendment first. The briefs are the contract.

---

## Default render approach (applies to all five)

**Renderer:** WebGL via the Phase 4 pipeline's `primaryRenderer: 'webgl'` dispatch. SVG fallback for users on hardware that can't run WebGL — graceful degradation, but the WebGL path is the polished v4.0 deliverable.

**Why WebGL:**
- Particle effects, glow trails, additive blending — everything that Canvas 2D can do but with GPU acceleration
- Shader-driven aesthetics: the Pedersen blob distortion in RingCT, the Diffie-Hellman beam convergence in stealth address — these need shaders to look right
- Depth and atmospheric effects (slight depth-of-field on inactive actors)
- 60fps with element counts that would tax SVG's reflow path

**Library decision (deferred to Phase 5 implementation, but recommended now):**
- **Three.js** is the recommended starting point. Mature, documented, used everywhere. The savings on rolling our own scene graph outweigh the bundle-size cost.
- If first-sim implementation reveals Three.js is overkill, fall back to **regl** or raw WebGL with a small wrapper.

**Aesthetic invariants (every simulation honors these):**
- d10 color tokens drive every visible color: `--xmr` (#FF6600), `--grn`, `--blue`, `--gold`, `--red`. No raw hex outside the token system.
- Backgrounds are deep neutrals (`--bg-0`); no busy gradients.
- Glow effects use additive blending — bright element + dark surround = visible halo without overdraw.
- All HTML text (annotations, inspectors, narration, parameter sliders) renders in an absolutely-positioned overlay layer. WebGL canvas does the visual; HTML does the type. Crisp text at any zoom; accessible to assistive tech.
- Motion timing uses the established d10 curves: `200ms cubic-bezier(.4, 0, .2, 1)` for acknowledgments, `700ms cubic-bezier(.32, .72, .25, 1)` for standard transitions, `1.4s cubic-bezier(.45, .85, .35, 1)` for slow drifts.

---

## A word on the educational arc

Each user encountering a simulation for the first time should:

1. **See the mechanism in motion** without needing to read first
2. **Understand what's happening** through visual storytelling
3. **Get the takeaway** in one sentence at the end
4. **Optionally explore** by changing parameters or hovering inspectors

Visual narrative comes first; technical accuracy lives in the inspectors. A user who watches casually leaves understanding the *concept*. A user who hovers an actor and reads the inspector leaves understanding the *cryptography*.

This means: prefer concrete metaphors over precise notation. "Sender's wallet computes a one-time address" beats "P = H(rA||i)G + B". Both are true; only one survives a casual viewing.

User feedback during planning: "the site felt too data/math-heavy, prefer better visualization over mathy ones." These briefs honor that — every formula appears only in inspector panels, never in scene annotations.

---

# BRIEF 1 — Decoy Selection Algorithm

## Educational goal

> The true spender is one of 16 ring members. Statistical analysis cannot reliably identify which one because all 16 are sampled from the same distribution.

## Why this simulation matters

Ring signatures are Monero's most-asked-about privacy primitive. Most explanations either over-simplify ("decoys hide the real one") or over-mathematize. This simulation lives in the middle: it shows the actual sampling, the resulting ring, and visually demonstrates indistinguishability.

## Actors

| Actor | Role | WebGL render | Initial state |
|---|---|---|---|
| `chain-blocks` | Background spine of the chain | InstancedMesh of ~720 small blocks compressed into a horizontal lane along the bottom. Single instanced draw call. | Static |
| `density-curve` | Log-normal age distribution overlay | Line geometry drawn with a custom shader for the orange glow effect | Animating in over phase 2 |
| `output-pool` | Set of all chain outputs | InstancedMesh of ~5,000 dim points. Most invisible until phase 3. | Mostly invisible until phase 3 |
| `ring-member-N` (×16) | Individual ring members chosen for this signature | Bright orange discs (Mesh + glow shader). Indexed 0–15. | Spawn in phase 3 |
| `true-spender-marker` | Highlights ring member that is the actual sender | Pulsing gold ring around one of the 16 (separate Mesh) | Hidden until phase 4, revealed and hidden again |
| `obscure-overlay` | Equalizes all 16 visually | Subtle additive glow applied uniformly via post-process pass | Phase 5 only |

## Parameters

| Parameter | Type | Default | Range | Effect |
|---|---|---|---|---|
| `ringSize` | number | 16 | 4 → 64 (step 1) | Number of ring members chosen |
| `spendOutputAge` | number | 7 days | 1 day → 5 years (step: 1 day) | Age of true spender output; affects density curve emphasis |
| `showAllOutputs` | boolean | true | — | Whether the dim output-pool is visible during sampling |

## Scene timeline (total 12 seconds)

| Phase | Start | Duration | What happens |
|---|---|---|---|
| `intro` | 0s | 1.0s | Chain spine fades in. Title overlay: "Selecting 16 ring members." |
| `density-curve` | 1.0s | 2.5s | Log-normal curve draws across the chain, peak near recent outputs, tail toward older. Subtle annotation: "Recent outputs are weighted more heavily." |
| `sampling` | 3.5s | 4.5s | 16 ring members spawn one at a time, each preceded by a particle trail from the curve down to the chosen output position. Mostly clustered near recent, a few scattered older. |
| `reveal-true-spender` | 8.0s | 1.5s | Gold ring pulses around one of the 16. Label: "This one is the real spender." |
| `obscure` | 9.5s | 2.5s | Gold ring fades. All 16 ring members glow identically. Annotation: "From outside, all 16 are indistinguishable." |

## Visual treatment

- **Sampling phase particles**: each ring member's spawn is preceded by a particle trail from density curve to chosen output position. ~80ms duration per particle. Additive blending. This is one of the WebGL-specific visual flourishes that Canvas 2D couldn't handle gracefully.
- **True-spender pulse**: gold (`var(--gold)`) ring, pulsing scale 1.0 → 1.3 → 1.0 over 1.0s.
- **Obscure phase**: a `pow(r, 2)` glow shader applied uniformly to all ring members in post-process, equalizing their brightness so they appear identical.

## Inspectors

| Trigger | Panel content |
|---|---|
| Hover any `ring-member-N` | Output index, age in blocks, age in days. *No indication of which is the true spender — that's the privacy property.* |
| Hover `density-curve` | "Log-normal distribution. Mean ~7 days, sigma ~0.5. Skewed toward recent outputs because they're more likely to be the actual spender." |
| Hover `chain-blocks` | "The Monero blockchain. Each block creates outputs that can later be ring members." |

## Accessibility

- Keyboard: Tab walks ring members 0–15, then density curve, then chain spine
- Reduced-motion: sampling particles collapse to instant spawns; obscure-phase glow becomes static
- Narration (aria-live): "Phase 1: introducing the chain. Phase 2: density curve drawn. Phase 3: 16 ring members sampled. Phase 4: true spender revealed. Phase 5: true spender obscured among the others."

## Verification

- [ ] Simulation runs at 60fps on M1-class hardware
- [ ] Reducing `ringSize` to 4 still produces a coherent visual (not awkwardly empty)
- [ ] Increasing `ringSize` to 64 doesn't drop frames
- [ ] All ring members visible without overlap at default viewport
- [ ] Inspector panels do not give away which is the true spender
- [ ] Final phase visually confirms indistinguishability
- [ ] Reduced-motion variant tells the same story without animation
- [ ] Tab order makes sense (start at one end of the ring, walk around)

---

# BRIEF 2 — Dandelion++ Stem-Phase Propagation

## Educational goal

> Before broadcast, transactions take a randomized walk through stem nodes. Observers can't easily trace the originator from the broadcast pattern because the originating node is hidden several hops upstream.

## Why this simulation matters

Dandelion++ is one of Monero's most under-explained privacy features. Users assume "the network broadcasts the transaction" — roughly true, but the *initial* propagation phase (stem) is the critical step for hiding the originator. This sim makes that visible.

## Actors

| Actor | Role | WebGL render | Initial state |
|---|---|---|---|
| `mempool-node-N` (×30 default) | Network nodes | InstancedMesh of small discs in force-directed layout | Static positions |
| `network-edges` | Connections between nodes | LineSegments geometry, dim | Static |
| `stem-edges` | Subset of edges marked as stem-eligible | LineSegments with brighter shader | Static, randomly chosen subset |
| `tx-packet` | Transaction in flight | Bright orange particle Mesh with trail (separate buffered geometry) | Spawns phase 2 |
| `originator-mark` | Highlights the originating node | Pulsing dim glow around the origin node — never bright (intentionally hard to see) | Phase 2 only, fades over time |
| `fluff-burst` | Moment of broadcast | Particle system: ~80 particles radiating outward | Phase 4 only |

## Parameters

| Parameter | Type | Default | Range | Effect |
|---|---|---|---|---|
| `stemLength` | number | 10 | 1 → 30 | Hops before fluff phase triggers |
| `fluffProbability` | number | 0.1 | 0 → 1 (step 0.05) | Per-hop probability of converting from stem to fluff |
| `networkSize` | choice | "30 nodes" | 10/30/100/300 | Number of nodes |

## Scene timeline (total 14 seconds)

| Phase | Start | Duration | What happens |
|---|---|---|---|
| `network-spawn` | 0s | 2.0s | Node graph fades in via force-directed layout, edges follow. Subtle pulse on each node as it appears. |
| `tx-origin` | 2.0s | 1.0s | One node briefly highlights as originator, then fades to dim. Tx packet emerges from it. |
| `stem-walk` | 3.0s | 7.0s | Tx hops node-to-node along stem edges, ~700ms per hop. Brief pause between hops for clarity. Originator-mark fades further with each hop. |
| `fluff-trigger` | 10.0s | 1.0s | At a randomized hop, the tx "decides" to fluff. Carrying node briefly pulses, then radiates particles outward. |
| `broadcast` | 11.0s | 2.5s | Particles propagate to every connected node simultaneously. Network briefly all-bright. |
| `outro` | 13.5s | 0.5s | Subtle fade. Annotation: "The original sender is N hops upstream — and you've already lost track." |

## Visual treatment

- **Stem-walk path**: orange particle with 200ms-long fading trail. Trail uses additive blending. Each hop ends with a brief glow pulse on the receiving node.
- **Originator-mark fade**: starts at 50% opacity in phase 2, decreases by 5% per stem hop. By broadcast time, barely visible — that's the educational point.
- **Fluff-burst**: ~80 particles radiating outward at varying speeds with `ease-out`. Particles dissipate after reaching adjacent nodes.

## Inspectors

| Trigger | Panel content |
|---|---|
| Hover any `mempool-node-N` | Node ID, stem-edge connection count, fluff-edge connection count. No indication of whether this is the originator. |
| Hover an edge | "Stem edge — used during private propagation phase" or "Standard edge — used during public broadcast." |
| Hover `tx-packet` (during stem walk) | "Transaction in stem phase. Hop count: N. Originator now H hops upstream." |

## Accessibility

- Keyboard: Tab walks the network nodes in force-directed-layout order
- Reduced-motion: stem-walk collapses to a single instant trace from origin to fluff point; fluff-burst becomes a static "all nodes glow" frame
- Narration: "Phase 1: network appears. Phase 2: transaction emerges from sender. Phase 3: transaction takes 8 hops along stem path. Phase 4: at hop 9, transaction broadcasts to everyone. Original sender is now hidden 9 hops upstream."

## Verification

- [ ] 60fps with default `networkSize: 30`
- [ ] At `networkSize: 300`, simulation runs at minimum 30fps
- [ ] Originator-mark visibly fades with each hop — a user watching for the originator should *lose track* during stem phase
- [ ] Fluff-burst feels distinct from stem-walk (different motion vocabulary)
- [ ] Inspector on tx-packet during stem walk does not reveal the originator
- [ ] Reduced-motion variant preserves the educational point

---

# BRIEF 3 — View Tag Matching

## Educational goal

> View tags let wallets skip ~99% of outputs without compromising privacy — a 256× scan speedup that nobody can attribute to a specific user.

## Why this simulation matters

View tags are one of Monero's most user-impactful 2022 upgrades, but they're invisible to users in everyday operation. This sim shows the upgrade's effect by directly comparing wallet scan time with and without view tags. The before/after comparison is what makes it land.

## Actors

| Actor | Role | WebGL render | Initial state |
|---|---|---|---|
| `output-pool` (×150 default) | All outputs to scan | InstancedMesh of small discs in a grid layout | Static |
| `user-outputs` (subset of pool) | Outputs actually belonging to the user | Same instance as pool, but with hidden `isMine: true` flag — visually identical | Identity hidden |
| `scan-cursor` | Where the wallet is looking right now | Crosshair-style indicator that walks the grid | Phase 2+ |
| `view-tag-check` | One-byte check operation | Quick particle flash on each output as cursor passes | Phase 3 only |
| `full-decrypt` | Slow operation | Slower flash + halt indicator | Phase 2 (always) and Phase 3 (rare) |
| `comparison-bars` | Side-by-side time bars | Two bars showing wall-clock time for each scan, animated width | Phase 4 only |

## Parameters

| Parameter | Type | Default | Range | Effect |
|---|---|---|---|---|
| `outputCount` | number | 150 | 50 → 500 | Number of outputs in the pool |
| `userOwnedRatio` | number | 0.02 | 0.01 → 0.1 | Fraction of outputs the user actually owns |
| `viewTagsEnabled` | boolean | toggleable | — | Switches between scan modes mid-simulation |

## Scene timeline (total 16 seconds)

| Phase | Start | Duration | What happens |
|---|---|---|---|
| `setup` | 0s | 2.0s | Output pool fades in. User-owned outputs are NOT highlighted (visually identical to all others). |
| `scan-without-tags` | 2.0s | 7.0s | Cursor walks every output. Each triggers a "full decrypt" — slow flash, ~50ms per output. Total time visible. |
| `transition` | 9.0s | 1.0s | Cursor returns to start. Annotation: "Now with view tags…" |
| `scan-with-tags` | 10.0s | 4.0s | Cursor walks every output again. Each triggers a fast view-tag-check (~5ms per output). The few that match get the slower full-decrypt. Total time noticeably shorter. |
| `comparison` | 14.0s | 2.0s | Two side-by-side bars appear showing total scan time. The "with view tags" bar is dramatically shorter. |

## Visual treatment

- **Full decrypt**: cursor pauses on output for ~50ms with a "thinking" pulse. Distinct visual rhythm.
- **View-tag check**: cursor passes over each output in ~5ms with a barely-visible flash. Mismatched outputs pass through without pause; matched outputs trigger full decrypt.
- **Comparison bars**: animate from 0 width to final width over 1.5s. Bars labeled with wall-clock time. The "without" bar is ~256× longer than "with" — exaggerated for clarity but representative of the protocol gain.

## Inspectors

| Trigger | Panel content |
|---|---|
| Hover any `output` | Output index. Does NOT reveal `isMine` status — that's the privacy property. |
| Hover `scan-cursor` (during scan) | Current scan operation: "View tag check (fast)" or "Full decrypt (slow)". |
| Hover comparison bars | Per-bar time, output count scanned, ops per output. |

## Accessibility

- Keyboard: Tab walks outputs in scan order
- Reduced-motion: phases collapse to before/after still images with a single comparison-bar animation
- Narration: "Phase 1: showing the output pool. Phase 2: wallet scans without view tags — full decrypt on every output. Phase 3: wallet scans with view tags — fast 1-byte check on every output, full decrypt only on the few that match. Phase 4: comparison shows view tags are 256 times faster."

## Verification

- [ ] 60fps with default 150 outputs
- [ ] At 500 outputs, runs at minimum 30fps
- [ ] Speed difference is *visually obvious* — "with view tags" finishes in noticeably less wall-clock time
- [ ] Comparison bars communicate the speedup at a glance
- [ ] User-owned outputs are not visually identifiable in the inspector
- [ ] Toggling `viewTagsEnabled` mid-scene re-runs the appropriate phase
- [ ] Reduced-motion preserves the comparative story

---

# BRIEF 4 — RingCT Signature Construction

## Educational goal

> A confidential transaction proves it's valid — inputs balance outputs, amounts are non-negative — without revealing the amounts or which input was actually spent.

## Why this simulation matters

RingCT is the foundational privacy mechanism of modern Monero. It combines ring signatures, Pedersen commitments, and range proofs into a single transaction format. Most explanations are too vague or too mathematical. This simulation walks through the structure of a transaction visually — formulas live in inspectors, the scene tells the story.

## Actors

| Actor | Role | WebGL render | Initial state |
|---|---|---|---|
| `input-utxo` | The actual input being spent | Bright orange disc on the left | Phase 1 |
| `decoy-outputs` (×15) | Ring members from the chain | Dim discs that flow in from the chain spine | Phase 2 |
| `ring-container` | Visual grouping of the 16 ring members | Glowing border (custom shader) that contains all 16 | Phase 3+ |
| `output-commitments` (×2) | Recipient + change | Discs on the right with hidden value blobs | Phase 4 |
| `pedersen-blobs` | Visual representation of blinded amounts | Custom fragment shader: simplex noise distortion of base orange. Communicates "value hidden" without showing math. | Phase 4 |
| `range-proof-band` | Bulletproofs+ collapsed to a single visual | Compact horizontal band beneath outputs with brief animation | Phase 5 |
| `clsag-signature` | The signature itself | Particle trail wrapping around the ring container | Phase 6 |
| `broadcast-particle` | Final tx packet | Single bright particle leaves the scene rightward | Phase 7 |

## Parameters

| Parameter | Type | Default | Range | Effect |
|---|---|---|---|---|
| `ringSize` | number | 16 | 4 → 64 | Number of ring members |
| `outputCount` | number | 2 | 2 → 8 | Recipient + change + additional outputs |
| `showCommitmentMath` | boolean | false | — | Reveals (in inspector) the Pedersen formulas. Off by default to keep simulation visual. |

## Scene timeline (total 18 seconds — the longest sim)

| Phase | Start | Duration | What happens |
|---|---|---|---|
| `intro-input` | 0s | 1.5s | Input UTXO appears on left. Label: "You're spending this output." |
| `gather-ring` | 1.5s | 4.0s | 15 decoys flow in from chain spine, slotting into a ring around the input. Slow draw-in. |
| `seal-ring` | 5.5s | 1.0s | Ring container's glowing border closes. Annotation: "16 ring members. The chain can't tell which is yours." |
| `build-commitments` | 6.5s | 3.0s | Output commitments appear on right. Pedersen-blob texture animates in over each, hiding the actual amount. |
| `range-proof` | 9.5s | 2.5s | Range-proof-band animates briefly. Annotation: "Proves amounts are non-negative without revealing them." |
| `sign-clsag` | 12.0s | 3.5s | Light trail traces the ring, then jumps to outputs, then back. Final form: a glowing signature ribbon connecting input to output. Annotation: "Signature locks the transaction." |
| `broadcast` | 15.5s | 2.0s | Single particle leaves the scene rightward. Outline of the full tx persists as faded ghost. |
| `outro` | 17.5s | 0.5s | Final annotation: "Confidential. Validated. Indistinguishable." |

## Visual treatment

- **Pedersen blobs**: this is the WebGL-specific signature visual. Fragment shader distorts base color (`var(--xmr)`) with simplex noise — visually communicates "value hidden behind cryptographic commitment" without showing math.
- **Range-proof band**: brief animation, ~2.5s. Looks like a horizontal bar pulsing with concentric rings, then settling. Conveys "this is a fast operation that completes in a single bound" — not the actual proof internals.
- **CLSAG signature trail**: ~80 particles tracing the ring → outputs → ring path. Trail length ~400ms.
- **Final ghost**: when the tx broadcasts, the entire constructed scene fades to ~30% opacity and persists for the outro. Visual confirmation that the artifact is complete.

## Inspectors (where the math lives)

| Trigger | Panel content |
|---|---|
| Hover `input-utxo` | "Input being spent. The chain doesn't know which decoy is the real one — only the spender does." |
| Hover any `decoy-output` | Output index, age, source block. Same shape as input-utxo's panel. |
| Hover `ring-container` | "Ring of 16 members. CLSAG signature proves spend authority without revealing which member is yours." |
| Hover `output-commitments` | "Pedersen commitment. Blinded amount + recipient address. Sum of inputs equals sum of outputs (homomorphic)." |
| Hover `range-proof-band` | "Bulletproofs+ range proof. Proves each output amount is in [0, 2^64) without revealing the amount. Verifies in O(log n)." |
| Hover `clsag-signature` | "CLSAG: Compact Linkable Spontaneous Anonymous Group signature. ~1.8KB for a 2-input ring 16 transaction." |

If `showCommitmentMath: true`, the commitment inspector additionally shows: `C = aG + bH where a is amount, b is blinding factor`.

## Accessibility

- Keyboard: Tab walks input-utxo, ring members, outputs, range-proof, signature, broadcast
- Reduced-motion: ring assembly collapses to instant; signature ribbon static; range-proof-band static frame
- Narration: highly verbose for this sim — most complex one. Each phase has 1-2 sentences of narration.

## Verification

- [ ] 60fps at default ringSize 16
- [ ] At ringSize 64 (worst case), drops to no less than 30fps
- [ ] Pedersen blobs visually convey "hidden value" without being mistaken for "broken graphics"
- [ ] Range-proof phase doesn't feel like a pause — it's a discrete moment but still part of the flow
- [ ] CLSAG signature trail makes the connection between inputs, ring, and outputs visually explicit
- [ ] Educational goal achievable in under 90 seconds of viewing
- [ ] Inspector content is accurate to the cryptography (no hand-waving in the data layer, even if the visual is a metaphor)

---

# BRIEF 5 — Stealth Address Derivation

## Educational goal

> Every Monero transaction goes to a one-time address only the recipient can recognize. The sender never knows whether the recipient sees it; the recipient knows it's theirs without scanning anyone else's output.

## Why this simulation matters

Stealth addresses are how Monero hides the recipient. Most explanations make this feel like cryptographic magic. This simulation makes it concrete: two characters, a published key pair, a random scalar, a derivation, an address that only the recipient recognizes. Watch the math — but mostly watch the actors.

This is the most character-driven simulation. The user feedback that the site felt too data/math-heavy is most directly addressed here: the math is the *story*, not the spectacle.

## Actors (more character-driven than other sims)

| Actor | Role | WebGL render | Initial state |
|---|---|---|---|
| `recipient-figure` | Bob, the recipient | Stylized minimalist character on the right side. Holds two keys above their head. | Static |
| `sender-figure` | Alice, the sender | Stylized minimalist character on the left | Static |
| `recipient-V-key` | Public view key | Blue glowing point near Bob's hands | Static |
| `recipient-S-key` | Public spend key | Orange glowing point near Bob's hands | Static |
| `random-scalar-r` | Ephemeral scalar generated by sender | Small green particle that pulses near Alice | Phase 2 |
| `R-publication` | R = r·G, the public part | Blue glowing point that travels from sender to "blockchain" zone in the middle | Phase 3 |
| `shared-secret-derivation` | Both sides compute the same shared secret | Two converging beams (custom shader for the convergence point) meeting at a single point | Phase 4 |
| `one-time-address` | The destination address P | Bright orange disc emerging from shared-secret point | Phase 5 |
| `recipient-watching` | Bob watching for outputs that match his derivation | Subtle scanning cursor on Bob's side | Phase 5+ |
| `output-arrival` | The transaction landing at the address | Particle traveling from sender toward the one-time-address | Phase 6 |

## Parameters

None for v4.0. This is a pure walkthrough simulation. Phase 5 polish or v5.0 may add parameters (e.g., custom recipient name).

## Scene timeline (total 13 seconds)

| Phase | Start | Duration | What happens |
|---|---|---|---|
| `setup` | 0s | 2.0s | Recipient and sender appear on opposite sides. Recipient holds V (blue) and S (orange) keys — visible to all. Annotation: "Bob publishes his public keys. Anyone can see them." |
| `random-scalar` | 2.0s | 1.5s | Sender (Alice) generates random scalar r. Green particle materializes near her. Annotation: "Alice picks a random secret r." |
| `compute-R` | 3.5s | 2.0s | r is multiplied by base-point G to produce R. R as blue glowing point travels to the middle (chain). Annotation: "She publishes R = r·G on-chain. Public, but reveals nothing about r." |
| `derive-shared-secret` | 5.5s | 2.5s | TWO simultaneous animations: Alice computes r·V_bob; Bob computes v_bob·R. Both result in the same shared point. Both beams converge at the center. Annotation: "Diffie-Hellman magic: both sides compute the same shared secret." |
| `compute-address` | 8.0s | 2.0s | Shared secret hashes into a one-time address P. P appears as a bright orange disc. Annotation: "Address P = H(shared) ⊕ B. Only Bob's wallet can recognize it." |
| `recipient-watches` | 10.0s | 1.5s | Bob's "watching" cursor begins scanning. Each output on the chain is checked against his derivation. Annotation: "Bob watches every output. His wallet recognizes only his." |
| `output-arrives` | 11.5s | 1.5s | The transaction (a particle from Alice) arrives at P. Bob "sees" it — his cursor highlights it. Annotation: "He recognizes it. Nobody else does." |

## Visual treatment

- **Character figures**: stylized, abstract — minimal head + shoulders, geometric. Important to avoid the "Alice and Bob" trope feeling cartoonish or stock-illustrated. Match the d10 aesthetic.
- **Key glow**: V is blue (`var(--blue)`), S is orange (`var(--xmr)`). They sit above Bob's hands like floating runes. Always visible during the simulation.
- **Diffie-Hellman convergence**: this is the visual centerpiece. Two beams travel from opposite sides and meet at exactly the same point in the middle. The point lights up brighter as both beams arrive simultaneously. WebGL shader handles the convergence brightness boost. Communicates "they computed the same thing without communicating."
- **Recipient-watching cursor**: subtle, scanning across many outputs but only highlighting one. The cursor's behavior is the visual proof of recognizability.
- **Output-arrival**: the final particle from Alice. Travels in an arc to the one-time address. Lands. Brief pulse of the address.

## Inspectors

| Trigger | Panel content |
|---|---|
| Hover `recipient-figure` | "Bob, the recipient. Owns the private spend key (b) and view key (v)." |
| Hover `sender-figure` | "Alice, the sender. Knows Bob's public keys but not his private keys." |
| Hover `recipient-V-key` | "Public view key V. Anyone can see it. Used to derive shared secrets." |
| Hover `recipient-S-key` | "Public spend key S. Anyone can see it. Used to compute the destination address." |
| Hover `random-scalar-r` | "Random scalar r. Generated freshly per transaction. Never reused. Never shared." |
| Hover `R-publication` | "R = r·G, where G is the curve base point. Published on-chain. Reveals nothing about r." |
| Hover `shared-secret-derivation` | "Both Alice and Bob compute the same shared secret: r·V = v·R = r·v·G. Diffie-Hellman key exchange." |
| Hover `one-time-address` | "P = H(r·V) ⊕ B. Unique to this transaction. Bob's wallet recognizes it; nobody else can." |

## Accessibility

- Keyboard: Tab walks Bob, Alice, random-scalar-r, R-publication, shared-secret-derivation, one-time-address, recipient-watching, output-arrival
- Reduced-motion: phases collapse to static keyframes. Diffie-Hellman convergence becomes a single still frame showing both beams meeting. Output-arrival becomes an instant landing.
- Narration (this sim is the most narration-friendly):
  - "Bob publishes his public keys. They're visible to everyone."
  - "Alice generates a random secret r."
  - "She publishes R = r times G on the chain. Public, but reveals nothing about r."
  - "Both Alice and Bob compute the same shared secret using their respective keys. Magic of Diffie-Hellman."
  - "The shared secret derives a one-time address only Bob recognizes."
  - "Bob watches every output. He recognizes only his."

## Verification

- [ ] 60fps throughout — this sim has the lowest element count, easy target
- [ ] Diffie-Hellman convergence is visually striking — beams arrive *simultaneously* at the same point
- [ ] Bob's "watching" cursor passes over many outputs without highlighting them, then highlights exactly one
- [ ] Educational goal achievable in under 60 seconds (this is the shortest, simplest sim)
- [ ] Character figures don't feel cartoonish or stock — they fit the d10 aesthetic
- [ ] Inspector content is mathematically accurate (the formulas in the inspectors are real)
- [ ] Reduced-motion variant tells the same story in still keyframes
- [ ] Bob's keys (V, S) remain visible throughout the simulation, never leave the scene

---

## Cross-cutting design choices

These decisions apply uniformly across all five briefs:

### Color vocabulary

| Color | Token | Used for |
|---|---|---|
| Bright orange | `var(--xmr)` | Active actors, primary brand |
| Dim orange | `rgba(255,102,0, 0.25)` | Decoys, equivalence-class members |
| Gold | `var(--gold)` | Special markers (true spender, threshold indicators) |
| Blue | `var(--blue)` | View-related elements (view keys, view tags, R publications) |
| Green | `var(--grn)` | Random/generated values, success states |
| Red | `var(--red)` | Almost never used in these sims (no failure states are educational) |

### Motion vocabulary

| Speed | Easing | Used for |
|---|---|---|
| 200ms | `cubic-bezier(.4, 0, .2, 1)` | Quick acknowledgments (hovering, tapping) |
| 700ms | `cubic-bezier(.32, .72, .25, 1)` | Standard state transitions |
| 1.4s | `cubic-bezier(.45, .85, .35, 1)` | Slow drifts, scene transitions |
| 4-7s | per-phase | Multi-step phase animations |

### Typography (HTML overlay layer)

WebGL renders the visual; an absolutely-positioned HTML overlay handles all text — annotations, inspector panels, narration, parameter sliders. This keeps text crisp at any zoom level and accessible to assistive tech.

### Mobile adaptation

All five sims need to work on 375px viewport. WebGL canvas resizes to viewport width; aspect ratio adjusts; controls stack vertically below the canvas. None of the simulations are unusable on mobile — but RingCT (the most complex) may show fewer ring members at smaller sizes (e.g., default ringSize 16 → 8 on mobile).

### Loading and error states

Each simulation needs a loading shell (WebGL context creation can take 100-500ms) and an error fallback (WebGL unavailable, hardware refused). Loading shell: subtle pulsing version of the simulation's background. Error: SVG fallback if available, or a static educational graphic with the same educational goal.

---

## Open questions for Phase 5 implementation

These are decisions deferred to implementation, not to this brief:

1. **Three.js vs raw WebGL vs intermediate library** — recommended Three.js, defer until first sim implementation
2. **Audio cues** — should phase transitions have subtle audio? (Probably not for v4.0; consider for v5.0)
3. **Save/share state** — should users be able to share a URL with specific parameters? (Future feature; not v4.0)
4. **Combined view** — should there be a "tour mode" that plays all five simulations in sequence? (Phase 6 polish, not v4.0)

---

## Definition of done for Phase 5

Phase 5 is complete when:
- All five simulations are implemented per these briefs
- Each simulation passes its verification checklist
- The Phase 4 pipeline successfully drives all five
- The simulations are reachable from a unified `/protocol-simulations` page
- The generative art gallery (separate scope, same renderer infrastructure) has at least three pieces shipped
- Pre-launch checklist (Phase 6) can begin

---

## What this document leaves unspecified

- **The generative art gallery's content.** Listed in roadmap as "Phase 5 + generative art gallery" — gallery briefs are a separate document
- **Implementation timing.** Phase 5 sims will likely be one PR each; Phase 4 spec will be referenced; this document will be referenced.
- **Performance budgets in detail.** Each brief gives 60fps targets but leaves the actual optimization techniques to the implementer.
- **Specific Three.js patterns.** Once the library is selected (probably Three.js), the patterns become consistent across all sims and can be documented separately if needed.
