/**
 * Sim 4: RingCT Signature Construction
 *
 * Educational goal: A confidential transaction proves it's valid — inputs
 * balance outputs, amounts are non-negative — without revealing the amounts
 * or which input was actually spent.
 *
 * See docs/v4-phase5-simulations.md Brief 4 for the full spec.
 *
 * Architectural notes
 * -------------------
 * Densest sim in Phase 5: 18-second timeline, 8 phases, three custom shaders.
 * - Pedersen blobs use a simplex-noise fragment shader to convey "value hidden."
 * - Range-proof band layers concentric pulse rings over a base bar.
 * - CLSAG signature trail samples a precomputed multi-segment path
 *   (ring → outputs → ring) and uses a phase-attribute particle shader
 *   to render a moving leading edge.
 * - Ghost-overlay is a full-frustum dimmer that comes up during broadcast.
 *
 * The "compute once, expose downstream" pattern is critical here: ring
 * positions, output positions, and the input position are all consumed by
 * multiple downstream actors (ring-container, signature-trail, broadcast).
 * The renderer reads the gather-ring phase's transitions to recover the
 * ring's final layout when sampling the CLSAG path.
 */

/* Compute the layout positions used across multiple phases.
   Returns an object with all the position data downstream phases need. */
function computeLayout(ringSize, outputCount) {
    /* Input UTXO: left side, vertically centered */
    const inputPos = { cx: 0.15, cy: 0.50 };

    /* Ring members arranged in a circle around a center point.
       Slightly squashed ellipse so the layout reads horizontal in 2:1 canvas. */
    const ringRadius = 0.18;
    const ringCenterCx = 0.42;
    const ringCenterCy = 0.50;
    const ringPositions = [];
    for (let i = 0; i < ringSize; i++) {
        const angle = (i / ringSize) * Math.PI * 2 - Math.PI / 2;
        ringPositions.push({
            cx: ringCenterCx + Math.cos(angle) * ringRadius * 1.1,
            cy: ringCenterCy + Math.sin(angle) * ringRadius * 0.85
        });
    }

    /* Output commitments: right side, stacked vertically */
    const outputCx = 0.78;
    const outputYStart = outputCount > 1 ? 0.30 : 0.50;
    const outputYStep = outputCount > 1 ? 0.40 / (outputCount - 1) : 0;
    const outputPositions = [];
    for (let i = 0; i < outputCount; i++) {
        outputPositions.push({
            cx: outputCx,
            cy: outputYStart + i * outputYStep
        });
    }

    /* Range-proof band: below the outputs */
    const rangeProofPos = { cx: outputCx, cy: 0.84 };

    return {
        inputPos,
        ringCenter: { cx: ringCenterCx, cy: ringCenterCy },
        ringRadius,
        ringPositions,
        outputPositions,
        rangeProofPos
    };
}

function buildActors(ringSize, outputCount, layout) {
    const actors = [];

    /* Input UTXO — bright orange disc on the left */
    actors.push({
        id: 'input-utxo',
        role: 'input',
        initialState: {
            opacity: 0,
            cx: layout.inputPos.cx,
            cy: layout.inputPos.cy,
            glowIntensity: 1.4
        },
        visualMapping: {
            shape: 'circle',
            attrs: {
                r: 14,
                fill: 'var(--xmr)',
                stroke: 'rgba(0, 0, 0, 0.5)',
                strokeWidth: 1
            },
            labels: [{ text: 'input', placement: 'below' }],
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    /* Decoy ring members — start invisible, slot into ring positions during gather phase */
    for (let i = 0; i < ringSize; i++) {
        const spawnY = 0.50 + (Math.random() - 0.5) * 0.30;
        actors.push({
            id: `ring-member-${i}`,
            role: 'ring-member',
            initialState: {
                opacity: 0,
                /* Spawn from off-screen left (chain spine) */
                cx: -0.10,
                cy: spawnY,
                glowIntensity: 0.5
            },
            visualMapping: {
                shape: 'circle',
                attrs: {
                    r: 7,
                    fill: 'rgba(255, 102, 0, 0.55)',
                    stroke: 'rgba(255, 102, 0, 0.3)',
                    strokeWidth: 1
                },
                webgl: { material: 'glow', blendMode: 'additive' }
            }
        });
    }

    /* Ring container — glowing border that "closes" around the ring once members are in */
    actors.push({
        id: 'ring-container',
        role: 'ring-boundary',
        initialState: {
            opacity: 0,
            cx: layout.ringCenter.cx,
            cy: layout.ringCenter.cy,
            radius: layout.ringRadius * 1.25,
            sealProgress: 0,
            memberCount: ringSize
        },
        visualMapping: {
            shape: 'ring-boundary',
            attrs: {
                stroke: 'var(--xmr)',
                strokeWidth: 2
            }
        }
    });

    /* Output commitments — discs on the right with Pedersen-blob texture */
    for (let i = 0; i < outputCount; i++) {
        const labelText = i === 0 ? 'recipient' : (i === 1 ? 'change' : `output-${i}`);
        actors.push({
            id: `output-commitment-${i}`,
            role: 'output',
            initialState: {
                opacity: 0,
                cx: layout.outputPositions[i].cx,
                cy: layout.outputPositions[i].cy,
                blobPhase: 0,
                visibility: 'hidden (blinded)',
                formula: 'C = aG + bH'
            },
            visualMapping: {
                shape: 'pedersen-blob',
                attrs: {
                    r: 18,
                    fill: 'var(--xmr)'
                },
                labels: [{ text: labelText, placement: 'right' }]
            }
        });
    }

    /* Range-proof band — horizontal bar with concentric rings */
    actors.push({
        id: 'range-proof-band',
        role: 'range-proof',
        initialState: {
            opacity: 0,
            cx: layout.rangeProofPos.cx,
            cy: layout.rangeProofPos.cy,
            pulsePhase: 0,
            range: '[0, 2^64)',
            verifyComplexity: 'O(log n)'
        },
        visualMapping: {
            shape: 'range-proof-band',
            attrs: {
                width: 0.30,
                height: 0.06,
                stroke: 'var(--xmr)',
                fill: 'rgba(255, 102, 0, 0.18)'
            }
        }
    });

    /* CLSAG signature trail — particle stream that traces ring → outputs → ring */
    actors.push({
        id: 'clsag-signature',
        role: 'signature',
        initialState: {
            opacity: 0,
            pathProgress: 0,
            particleCount: 80,
            sizeKB: '~1.8KB'
        },
        visualMapping: {
            shape: 'signature-trail',
            attrs: {
                fill: 'var(--xmr)',
                particleCount: 80
            }
        }
    });

    /* Broadcast particle — final tx packet leaving the scene */
    actors.push({
        id: 'broadcast-particle',
        role: 'broadcast',
        initialState: {
            opacity: 0,
            cx: layout.outputPositions[0].cx,
            cy: layout.outputPositions[0].cy,
            glowIntensity: 1.6
        },
        visualMapping: {
            shape: 'circle',
            attrs: {
                r: 8,
                fill: 'var(--xmr)'
            },
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    /* Ghost-overlay — full-canvas dim layer applied during outro */
    actors.push({
        id: 'ghost-overlay',
        role: 'scene-fade',
        initialState: { opacity: 0, fadeAmount: 0 },
        visualMapping: {
            shape: 'ghost-overlay',
            attrs: { fill: 'rgba(8, 8, 10, 0.7)' }
        }
    });

    return actors;
}

/* Generate gather-ring transitions: each decoy spawns from chain spine
   (off-screen left) and slots into its ring position. */
function gatherRingTransitions(ringSize, layout, totalDurationMs) {
    const transitions = [];
    for (let i = 0; i < ringSize; i++) {
        const target = layout.ringPositions[i];
        const delay = (i / Math.max(1, ringSize - 1)) * totalDurationMs * 0.6;
        transitions.push({
            actorId: `ring-member-${i}`,
            targetState: {
                opacity: 0.85,
                cx: target.cx,
                cy: target.cy
            },
            easing: 'cubic-bezier(.32,.72,.25,1)',
            delayMs: delay
        });
    }
    return transitions;
}

/* Generate output-commitment transitions: each output fades in with the
   Pedersen blob distortion shader animating into place. */
function buildCommitmentTransitions(outputCount, totalDurationMs) {
    const transitions = [];
    for (let i = 0; i < outputCount; i++) {
        const delay = (i / Math.max(1, outputCount)) * totalDurationMs * 0.5;
        transitions.push({
            actorId: `output-commitment-${i}`,
            targetState: {
                opacity: 1,
                blobPhase: 1
            },
            easing: 'ease-out',
            delayMs: delay
        });
    }
    return transitions;
}

export function buildSpec(params = {}) {
    const ringSize = Number(params.ringSize ?? 16);
    const outputCount = Number(params.outputCount ?? 2);
    const showCommitmentMath = params.showCommitmentMath ?? false;

    const layout = computeLayout(ringSize, outputCount);

    const commitmentInspectorField = showCommitmentMath
        ? { label: 'Formula', valueFromActor: 'formula' }
        : { label: 'Visibility', valueFromActor: 'visibility' };

    return {
        id: 'ringct-construction',
        title: 'RingCT Signature Construction',
        subtitle: 'How a confidential transaction takes shape',
        educationalGoal: "A confidential transaction proves it's valid — inputs balance outputs, amounts are non-negative — without revealing the amounts or which input was actually spent.",

        actors: buildActors(ringSize, outputCount, layout),

        parameters: [
            {
                id: 'ringSize',
                label: 'Ring size',
                type: 'number',
                default: 16,
                min: 4,
                max: 64,
                step: 1,
                affects: ['gather-ring', 'seal-ring', 'sign-clsag']
            },
            {
                id: 'outputCount',
                label: 'Output count',
                type: 'number',
                default: 2,
                min: 2,
                max: 8,
                step: 1,
                affects: ['build-commitments', 'sign-clsag']
            },
            {
                id: 'showCommitmentMath',
                label: 'Show commitment math',
                type: 'boolean',
                default: false,
                affects: []
            }
        ],

        scene: {
            duration: 18000,
            autoPlay: true,
            loop: true,
            phases: [
                {
                    id: 'intro-input',
                    label: 'Input UTXO',
                    startMs: 0,
                    durationMs: 1500,
                    description: "You're spending this output.",
                    transitions: [
                        { actorId: 'input-utxo', targetState: { opacity: 1 }, easing: 'ease-out' }
                    ]
                },
                {
                    id: 'gather-ring',
                    label: 'Gathering ring members',
                    startMs: 1500,
                    durationMs: 4000,
                    description: 'Decoys flow in from the chain. The chain cannot tell which one is yours.',
                    transitions: gatherRingTransitions(ringSize, layout, 4000)
                },
                {
                    id: 'seal-ring',
                    label: 'Ring sealed',
                    startMs: 5500,
                    durationMs: 1000,
                    description: `${ringSize} ring members. Only the spender knows which is the real one.`,
                    transitions: [
                        { actorId: 'ring-container', targetState: { opacity: 1, sealProgress: 1 }, easing: 'cubic-bezier(.4,0,.2,1)' }
                    ]
                },
                {
                    id: 'build-commitments',
                    label: 'Output commitments',
                    startMs: 6500,
                    durationMs: 3000,
                    description: 'Output amounts are blinded. Sum of inputs equals sum of outputs — without revealing either.',
                    transitions: buildCommitmentTransitions(outputCount, 3000)
                },
                {
                    id: 'range-proof',
                    label: 'Range proof',
                    startMs: 9500,
                    durationMs: 2500,
                    description: 'Bulletproofs+ proves each output amount is non-negative. Verifies in O(log n).',
                    transitions: [
                        { actorId: 'range-proof-band', targetState: { opacity: 1, pulsePhase: 1 }, easing: 'cubic-bezier(.32,.72,.25,1)' }
                    ]
                },
                {
                    id: 'sign-clsag',
                    label: 'CLSAG signature',
                    startMs: 12000,
                    durationMs: 3500,
                    description: 'A signature locks the transaction. The ring proves spend authority without revealing which member.',
                    transitions: [
                        { actorId: 'clsag-signature', targetState: { opacity: 1, pathProgress: 1 }, easing: 'linear' }
                    ]
                },
                {
                    id: 'broadcast',
                    label: 'Broadcast',
                    startMs: 15500,
                    durationMs: 2000,
                    description: 'Confidential. Validated. Indistinguishable.',
                    transitions: [
                        { actorId: 'broadcast-particle', targetState: { opacity: 1, cx: 1.10 }, easing: 'cubic-bezier(.45,.85,.35,1)' },
                        { actorId: 'ghost-overlay', targetState: { opacity: 1, fadeAmount: 0.7 }, easing: 'ease-out', delayMs: 500 },
                        { actorId: 'clsag-signature', targetState: { opacity: 0.4 }, easing: 'ease-out', delayMs: 500 }
                    ]
                },
                {
                    id: 'outro',
                    label: 'Transaction confirmed',
                    startMs: 17500,
                    durationMs: 500,
                    description: 'Confidential. Validated. Indistinguishable.',
                    transitions: [
                        { actorId: 'broadcast-particle', targetState: { opacity: 0 }, easing: 'ease-out' }
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
                triggerActorId: 'input-utxo',
                panelTitle: 'Input UTXO',
                fields: [
                    { label: 'Role', valueFromActor: 'role' }
                ]
            },
            {
                triggerActorId: 'ring-container',
                panelTitle: 'Ring of decoys',
                fields: [
                    { label: 'Members', valueFromActor: 'memberCount' }
                ]
            },
            {
                triggerActorId: 'output-commitment-0',
                panelTitle: 'Pedersen commitment',
                fields: [commitmentInspectorField]
            },
            {
                triggerActorId: 'range-proof-band',
                panelTitle: 'Bulletproofs+ range proof',
                fields: [
                    { label: 'Range', valueFromActor: 'range' },
                    { label: 'Verification', valueFromActor: 'verifyComplexity' }
                ]
            },
            {
                triggerActorId: 'clsag-signature',
                panelTitle: 'CLSAG signature',
                fields: [
                    { label: 'Size', valueFromActor: 'sizeKB' }
                ]
            }
        ]
    };
}

/* Register with the global GenUI registry */
const spec = buildSpec();
spec.__buildSpec = buildSpec;
if (typeof window !== 'undefined' && window.GenUI) {
    window.GenUI.register(spec);
}

export { spec };
