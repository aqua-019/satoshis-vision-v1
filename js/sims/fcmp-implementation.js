/**
 * Sim 6: FCMP++ Implementation
 *
 * Educational goal: Once FCMP++ activates, every output ever created on the
 * Monero blockchain becomes a member of every input's anonymity set — not 16
 * selected decoys. Statistical attacks that work against 16-member rings have
 * no signal to operate on when the anonymity set is the entire chain.
 *
 * Status (May 2026): FCMP++ is in beta stressnet (launching May 6, 2026).
 * Mainnet activation is tentatively targeted for mid-2026. See
 * docs/v4-fcmp-canonical-facts.md for the authoritative status snapshot.
 *
 * See docs/v4-phase5-simulations.md Brief 6 for the canonical spec.
 *
 * Phase 1 reuses Sim 1's visual vocabulary by duplicating the ring-member
 * visualMapping verbatim from js/sims/decoy-selection.js (r:8, fill var(--xmr),
 * stroke rgba(0,0,0,0.5), glow material, additive blending). If Sim 1's
 * ring-member visual treatment changes (e.g. via a future redesign), the
 * corresponding blocks in this file must be updated to match.
 */

/* Approximate Monero output count as of January 2026 (sources: seraphis-migration/monero
   release notes, kayabaNerve fcmp-plus-plus-paper). The figure is conservatively low —
   sources cite 152-158M in early 2026 and the count grows monotonically. Update at
   v4.0 ship time if a newer authoritative figure is available. Live RPC fetch is
   v5.0 territory per Brief 6 open question #1. */
const STATIC_UTXO_COUNT = 152_000_000;

const RING_SIZE = 16;

/* Compute the layout positions used across multiple phases. The 16 legacy
   ring members are arranged horizontally — narrower x band than Sim 1
   (0.10–0.55) to leave canvas room for the Curve Tree on the right. The
   visual feel ("scattered horizontal row of orange discs") still reads as
   a continuation of Sim 1's exit state. */
function computeLayout() {
    const ringPositions = [];
    const ringYBand = { min: 0.30, max: 0.50 };
    const ringXStart = 0.10;
    const ringXEnd = 0.55;
    const ringYCenter = (ringYBand.min + ringYBand.max) / 2;
    const ringYHalfRange = (ringYBand.max - ringYBand.min) * 0.5;

    for (let i = 0; i < RING_SIZE; i++) {
        const t = i / (RING_SIZE - 1);
        const cx = ringXStart + t * (ringXEnd - ringXStart);
        /* Deterministic vertical jitter via sin so re-renders are stable. */
        const cy = ringYCenter + Math.sin(i * 1.7) * ringYHalfRange * 0.6;
        ringPositions.push({ cx, cy });
    }

    /* True-spender index fixed at 7 (middle of row) so the failed-marker's
       starting position in Phase 4 is stable across runs. */
    const trueSpenderIndex = 7;
    const trueSpenderPosition = ringPositions[trueSpenderIndex];

    return {
        ringPositions,
        trueSpenderIndex,
        trueSpenderPosition,
        treeRootPos: { cx: 0.78, cy: 0.18 },
        chainCounterPos: { cx: 0.06, cy: 0.10 },
        outroCalloutPos: { cx: 0.50, cy: 0.85 }
    };
}

function buildActors(layout, displayedUtxoCount, treeDepthShown) {
    const actors = [];

    /* Legacy ring members — visualMapping duplicated from Sim 1's
       ring-member actors (decoy-selection.js:82-110) for cross-sim
       consistency. */
    for (let i = 0; i < RING_SIZE; i++) {
        const isTrueSpender = (i === layout.trueSpenderIndex);
        actors.push({
            id: `legacy-ring-${i}`,
            role: 'ring-member',
            initialState: {
                opacity: 0,
                cx: layout.ringPositions[i].cx,
                cy: layout.ringPositions[i].cy,
                r: 8,
                glowIntensity: 0.85,
                isTrueSpender,
                outputIndex: 20000 + i * 1000,
                ageDays: 7
            },
            visualMapping: {
                shape: 'circle',
                attrs: {
                    r: 8,
                    fill: 'var(--xmr)',
                    stroke: 'rgba(0,0,0,0.5)',
                    strokeWidth: 1
                },
                webgl: { material: 'glow', blendMode: 'additive' }
            }
        });
    }

    /* Legacy spender marker — `ring` shape type matches Sim 1's
       true-spender-marker (hollow gold ring, not filled disc). */
    actors.push({
        id: 'legacy-spender-marker',
        role: 'highlight',
        initialState: {
            opacity: 0,
            cx: layout.trueSpenderPosition.cx,
            cy: layout.trueSpenderPosition.cy,
            scale: 1,
            r: 14
        },
        visualMapping: {
            shape: 'ring',
            attrs: {
                r: 14,
                fill: 'transparent',
                stroke: 'var(--gold)',
                strokeWidth: 2
            },
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    /* UTXO ocean — InstancedMesh of dim points filling the canvas with
       parallax depth. Brief 6: "the WebGL-defining visual of the
       simulation." */
    actors.push({
        id: 'utxo-ocean',
        role: 'utxo-set',
        initialState: {
            opacity: 0,
            displayedCount: displayedUtxoCount,
            parallaxDepth: 0,
            totalChainCount: STATIC_UTXO_COUNT.toLocaleString(),
            anonymitySet: '150M+ (entire chain)',
            displayNote: 'Each output on the Monero blockchain is a potential anonymity-set member under FCMP++. The on-screen rendering shows a representative subset.'
        },
        visualMapping: {
            shape: 'utxo-ocean',
            attrs: {
                count: displayedUtxoCount,
                fill: 'rgba(255, 102, 0, 0.4)',
                size: 2.5
            },
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    /* Chain-counter HTML overlay — JetBrains Mono numerals counting up. */
    actors.push({
        id: 'chain-counter',
        role: 'chain-counter',
        initialState: {
            opacity: 0,
            cx: layout.chainCounterPos.cx,
            cy: layout.chainCounterPos.cy,
            count: 0,
            source: 'Static, updated at v4.0 ship'
        },
        visualMapping: {
            shape: 'html-overlay',
            attrs: {
                template: 'chain-counter',
                fontFamily: 'var(--font-mono)',
                fontSize: '14px',
                color: 'var(--text-secondary)'
            }
        }
    });

    /* Curve Tree — branching tree converging upward toward a single root.
       Leaves animate first; root reveals last. */
    actors.push({
        id: 'curve-tree',
        role: 'membership-proof-structure',
        initialState: {
            opacity: 0,
            cx: layout.treeRootPos.cx,
            cy: layout.treeRootPos.cy,
            depth: treeDepthShown,
            collapseProgress: 0,
            setSize: '150M+ outputs (entire chain)',
            proofSize: '~2-3 KB'
        },
        visualMapping: {
            shape: 'curve-tree',
            attrs: {
                depth: treeDepthShown,
                rootCx: layout.treeRootPos.cx,
                rootCy: layout.treeRootPos.cy,
                stroke: 'rgba(255, 102, 0, 0.55)',
                strokeWidth: 1
            },
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    /* Proof artifact — small bright glowing token at the tree's root. */
    actors.push({
        id: 'proof-artifact',
        role: 'membership-proof',
        initialState: {
            opacity: 0,
            cx: layout.treeRootPos.cx,
            cy: layout.treeRootPos.cy,
            scale: 1,
            r: 10,
            replaces: 'CLSAG ring signature',
            proves: 'Spender owns one of the chain UTXOs without revealing which'
        },
        visualMapping: {
            shape: 'circle',
            attrs: {
                r: 10,
                fill: 'var(--gold)',
                stroke: 'var(--xmr)',
                strokeWidth: 2
            },
            labels: [{ text: 'FCMP++ proof', placement: 'below' }],
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    /* Failed marker — Phase 4's educational core. Same gold-ring visual as
       the legacy-spender-marker but with subtle tremor and drift behavior. */
    actors.push({
        id: 'failed-marker',
        role: 'failed-identification',
        initialState: {
            opacity: 0,
            cx: layout.trueSpenderPosition.cx,
            cy: layout.trueSpenderPosition.cy,
            r: 14,
            attemptCount: 0,
            reason: 'Anonymity set is the entire chain — no per-input decoy distribution to analyze.',
            anonymitySet: '150M+ outputs'
        },
        visualMapping: {
            shape: 'failed-marker',
            attrs: {
                r: 14,
                stroke: 'var(--gold)',
                strokeWidth: 2,
                fill: 'transparent'
            },
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    /* Outro callout — final stat overlay. */
    actors.push({
        id: 'outro-callout',
        role: 'outro-stat',
        initialState: {
            opacity: 0,
            cx: layout.outroCalloutPos.cx,
            cy: layout.outroCalloutPos.cy
        },
        visualMapping: {
            shape: 'html-overlay',
            attrs: {
                template: 'outro-callout',
                fontFamily: 'var(--font-data)',
                fontSize: '20px',
                color: 'var(--text-primary)'
            }
        }
    });

    return actors;
}

/* Generate legacy-recap transitions: 16 ring members spawn progressively
   over the first 65% of the phase, gold marker pulses on the true spender
   during the final 30%. */
function legacyRecapTransitions(layout, totalDurationMs) {
    const transitions = [];
    for (let i = 0; i < RING_SIZE; i++) {
        const delay = (i / (RING_SIZE - 1)) * totalDurationMs * 0.55;
        transitions.push({
            actorId: `legacy-ring-${i}`,
            targetState: { opacity: 1, glowIntensity: 0.85 },
            easing: 'cubic-bezier(.4,0,.2,1)',
            delayMs: delay
        });
    }
    transitions.push({
        actorId: 'legacy-spender-marker',
        targetState: { opacity: 1, scale: 1.3 },
        easing: 'cubic-bezier(.4,0,.6,1)',
        delayMs: totalDurationMs * 0.7
    });
    return transitions;
}

/* Generate failed-marker drift transitions for Phase 4. The marker visits
   `attempts` candidates over `totalDurationMs`, opacity decreasing 15% per
   attempt, then fades entirely. */
function failedMarkerTransitions(driftCandidates, totalDurationMs) {
    const transitions = [];
    const attempts = driftCandidates.length;
    const attemptDuration = totalDurationMs / (attempts + 1);

    /* First attempt — marker appears at original spender position. */
    transitions.push({
        actorId: 'failed-marker',
        targetState: {
            opacity: 1,
            cx: driftCandidates[0].cx,
            cy: driftCandidates[0].cy,
            attemptCount: 0
        },
        easing: 'ease-out',
        delayMs: 0
    });

    /* Subsequent drifts — opacity drops 15% per cycle. */
    for (let i = 1; i < attempts; i++) {
        const candidate = driftCandidates[i];
        const opacity = Math.max(0.2, 1 - (i * 0.15));
        transitions.push({
            actorId: 'failed-marker',
            targetState: {
                cx: candidate.cx,
                cy: candidate.cy,
                opacity,
                attemptCount: i
            },
            easing: 'cubic-bezier(.4,0,.2,1)',
            delayMs: i * attemptDuration
        });
    }

    /* Final fade. */
    transitions.push({
        actorId: 'failed-marker',
        targetState: { opacity: 0 },
        easing: 'ease-out',
        delayMs: attempts * attemptDuration
    });

    return transitions;
}

/**
 * Mobile / low-memory devices stall when the InstancedMesh particle count
 * climbs above ~20K. We default to 5K when we detect a small viewport so
 * the sim is usable on phones; desktop users still get the full 50K out
 * of the box. The "Displayed UTXOs" parameter remains adjustable.
 */
function _isLowEndViewport() {
    if (typeof window === 'undefined') return false;
    const w = window.innerWidth || 0;
    const memGB = navigator.deviceMemory || 0;
    return w <= 768 || (memGB > 0 && memGB <= 4);
}

export function buildSpec(params = {}) {
    const _defaultUtxo = _isLowEndViewport() ? 5000 : 50000;
    const displayedUtxoCount = params.displayedUtxoCount ?? _defaultUtxo;
    const showLegacyComparison = params.showLegacyComparison ?? true;
    const treeDepthShown = params.treeDepthShown ?? 6;

    const layout = computeLayout();

    /* Drift candidates for Phase 4 — deterministic indices for stability. */
    const driftCandidates = [
        layout.ringPositions[layout.trueSpenderIndex],
        layout.ringPositions[3],
        layout.ringPositions[12],
        layout.ringPositions[5]
    ];

    return {
        id: 'fcmp-implementation',
        title: 'FCMP++ Implementation',
        subtitle: 'How the anonymity set jumps from 16 to 150M+',
        educationalGoal: 'Once FCMP++ activates, every output ever created on the Monero blockchain becomes a member of every input\'s anonymity set — not 16 selected decoys. Statistical attacks that work against 16-member rings have no signal to operate on when the anonymity set is the entire chain.',

        actors: buildActors(layout, displayedUtxoCount, treeDepthShown),

        parameters: [
            {
                id: 'displayedUtxoCount',
                label: 'Displayed UTXOs',
                type: 'choice',
                default: String(_defaultUtxo),
                choices: [
                    { value: '5000', label: '5K' },
                    { value: '20000', label: '20K' },
                    { value: '50000', label: '50K' },
                    { value: '100000', label: '100K' }
                ],
                affects: ['expansion']
            },
            {
                id: 'showLegacyComparison',
                label: 'Show legacy ring comparison',
                type: 'boolean',
                default: true,
                affects: ['legacy-recap']
            },
            {
                id: 'treeDepthShown',
                label: 'Curve Tree depth',
                type: 'number',
                default: 6,
                min: 4,
                max: 8,
                step: 1,
                affects: ['proof-construction']
            }
        ],

        scene: {
            duration: 18000,
            autoPlay: true,
            loop: true,
            phases: [
                {
                    id: 'legacy-recap',
                    label: 'The old way',
                    startMs: 0,
                    durationMs: 5000,
                    description: 'Ring signatures: 16 decoys. RingCT era.',
                    transitions: showLegacyComparison
                        ? legacyRecapTransitions(layout, 5000)
                        : []
                },
                {
                    id: 'expansion',
                    label: 'The anonymity set expands',
                    startMs: 5000,
                    durationMs: 4000,
                    description: 'FCMP++ proves membership in the entire chain.',
                    transitions: [
                        ...layout.ringPositions.map((_, i) => ({
                            actorId: `legacy-ring-${i}`,
                            targetState: { opacity: 0.4 },
                            easing: 'ease-out',
                            delayMs: 200
                        })),
                        {
                            actorId: 'legacy-spender-marker',
                            targetState: { opacity: 0.4, scale: 1 },
                            easing: 'ease-out',
                            delayMs: 200
                        },
                        {
                            actorId: 'utxo-ocean',
                            targetState: { opacity: 1, parallaxDepth: 1 },
                            easing: 'cubic-bezier(.32,.72,.25,1)'
                        },
                        {
                            actorId: 'chain-counter',
                            targetState: { opacity: 1, count: STATIC_UTXO_COUNT },
                            easing: 'cubic-bezier(.4,0,.6,1)',
                            delayMs: 800
                        }
                    ]
                },
                {
                    id: 'proof-construction',
                    label: 'Curve Tree proof',
                    startMs: 9000,
                    durationMs: 3000,
                    description: 'Curve Trees: a logarithmic-size proof of membership in the entire set.',
                    transitions: [
                        {
                            actorId: 'curve-tree',
                            targetState: { opacity: 1, collapseProgress: 1 },
                            easing: 'cubic-bezier(.32,.72,.25,1)'
                        },
                        {
                            actorId: 'proof-artifact',
                            targetState: { opacity: 1, scale: 1.15 },
                            easing: 'cubic-bezier(.4,0,.2,1)',
                            delayMs: 2000
                        }
                    ]
                },
                {
                    id: 'failed-identification',
                    label: 'The old approach fails',
                    startMs: 12000,
                    durationMs: 4000,
                    description: '1 in 16 is guessable. 1 in 150,000,000 is not.',
                    transitions: failedMarkerTransitions(driftCandidates, 4000).concat([
                        {
                            actorId: 'legacy-spender-marker',
                            targetState: { opacity: 0 },
                            easing: 'ease-out'
                        }
                    ])
                },
                {
                    id: 'outro',
                    label: 'Anonymity set: 150M+',
                    startMs: 16000,
                    durationMs: 2000,
                    description: 'Anonymity set: 150M+. Statistical de-anonymization no longer applies at this scale.',
                    transitions: [
                        {
                            actorId: 'outro-callout',
                            targetState: { opacity: 1 },
                            easing: 'cubic-bezier(.32,.72,.25,1)'
                        },
                        ...layout.ringPositions.map((_, i) => ({
                            actorId: `legacy-ring-${i}`,
                            targetState: { opacity: 0.1 },
                            easing: 'ease-out'
                        })),
                        {
                            actorId: 'utxo-ocean',
                            targetState: { opacity: 0.8 },
                            easing: 'ease-out'
                        },
                        {
                            actorId: 'proof-artifact',
                            targetState: { opacity: 1, scale: 1.2 },
                            easing: 'ease-out'
                        }
                    ]
                }
            ]
        },

        render: {
            primaryRenderer: 'webgl',
            fallbackRenderer: 'svg',
            viewport: { width: 1200, height: 600, aspectRatio: '2 / 1' },
            backgroundColor: 'var(--surface-0)',
            motionPreference: 'full',
            fpsTarget: 60
        },

        inspectors: [
            {
                triggerActorId: 'utxo-ocean',
                panelTitle: 'UTXO ocean',
                fields: [
                    { label: 'Total UTXOs', valueFromActor: 'totalChainCount' },
                    { label: 'Anonymity set', valueFromActor: 'anonymitySet' },
                    { label: 'Note', valueFromActor: 'displayNote' }
                ]
            },
            {
                triggerActorId: 'curve-tree',
                panelTitle: 'Curve Tree',
                fields: [
                    { label: 'Set size', valueFromActor: 'setSize' },
                    { label: 'Proof size', valueFromActor: 'proofSize' }
                ]
            },
            {
                triggerActorId: 'proof-artifact',
                panelTitle: 'FCMP++ proof',
                fields: [
                    { label: 'Replaces', valueFromActor: 'replaces' },
                    { label: 'Proves', valueFromActor: 'proves' }
                ]
            },
            {
                triggerActorId: 'failed-marker',
                panelTitle: 'Failed identification',
                fields: [
                    { label: 'Reason', valueFromActor: 'reason' },
                    { label: 'Anonymity set', valueFromActor: 'anonymitySet' }
                ]
            },
            {
                triggerActorId: 'chain-counter',
                panelTitle: 'Chain UTXO count',
                fields: [
                    { label: 'Count', valueFromActor: 'count' },
                    { label: 'Source', valueFromActor: 'source' }
                ]
            }
        ]
    };
}

const spec = buildSpec();
spec.__buildSpec = buildSpec;
if (typeof window !== 'undefined' && window.GenUI) {
    window.GenUI.register(spec);
}

export { spec };
