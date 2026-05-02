/**
 * Sim 5: Stealth Address Derivation
 *
 * Educational goal: Every Monero transaction goes to a one-time address only
 * the recipient can recognize. Alice and Bob compute the same shared secret
 * without communicating; from that secret an output address materializes that
 * only Bob's wallet can detect on the chain.
 *
 * See docs/v4-phase5-simulations.md Brief 5 for the canonical spec.
 *
 * Architectural notes
 * -------------------
 * Most character-driven sim of Phase 5: 13-second timeline, 7 phases, two
 * simultaneously-animated avatars (Alice/Bob), and a Diffie-Hellman
 * convergence beat where two beams arrive at the midpoint together. The
 * "compute once, expose downstream" pattern from Sim 4 is used for layout
 * positions: the convergence point is computed once and reused by the two
 * ECDH beams, the convergence flash, the derivation arc, and the recognition
 * halo so they stay pinned together if positions ever shift.
 *
 * No new shape types. The two ECDH beams and the derivation arc reuse the
 * existing `path` shape, extended in Section 2 of this prompt to handle
 * quadratic bezier curves with a `progress` parameter (0..1) for the
 * "draw the line in" effect. The convergence flash reuses Sim 2's
 * `particle-burst`. Bob's keys, the random scalar r, R-publication, and
 * the one-time address are all `circle` glow discs with `labels`.
 */

function computeLayout() {
    /* Alice on the left, Bob on the right, both vertically centered. */
    const alicePos = { cx: 0.18, cy: 0.50 };
    const bobPos = { cx: 0.82, cy: 0.50 };

    /* Bob's published keys float above his shoulders. V left of S so they
       read like the symbol (V, S) rather than (S, V). */
    const bobVKeyPos = { cx: 0.78, cy: 0.30 };
    const bobSKeyPos = { cx: 0.86, cy: 0.30 };

    /* Random scalar r appears just above Alice's shoulder. */
    const randomScalarPos = { cx: 0.22, cy: 0.30 };

    /* R-publication final resting place: middle of the canvas, slightly
       above center (the "chain" zone where it's published). */
    const rPublicationPos = { cx: 0.50, cy: 0.32 };

    /* Convergence point: middle-low. Both beams arrive here in the
       derive-shared-secret phase. */
    const convergencePos = { cx: 0.50, cy: 0.58 };

    /* One-time address P: below the convergence, distinct vertical band so
       it reads as a separate object derived FROM the shared secret. */
    const oneTimePos = { cx: 0.50, cy: 0.80 };

    return {
        alicePos,
        bobPos,
        bobVKeyPos,
        bobSKeyPos,
        randomScalarPos,
        rPublicationPos,
        convergencePos,
        oneTimePos
    };
}

function buildActors(layout) {
    const actors = [];

    /* Alice — stylized character avatar, blue-tinted disc on the left. */
    actors.push({
        id: 'alice',
        role: 'sender-figure',
        initialState: {
            opacity: 0,
            cx: layout.alicePos.cx,
            cy: layout.alicePos.cy,
            knows: "Bob's public keys (V, S)",
            computes: 'shared secret = r · V'
        },
        visualMapping: {
            shape: 'circle',
            attrs: {
                r: 18,
                fill: 'var(--blue)',
                stroke: 'var(--xmr)',
                strokeWidth: 2
            },
            labels: [{ text: 'Alice', placement: 'below' }],
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    /* Bob — recipient avatar on the right, gold-rimmed green disc. */
    actors.push({
        id: 'bob',
        role: 'recipient-figure',
        initialState: {
            opacity: 0,
            cx: layout.bobPos.cx,
            cy: layout.bobPos.cy,
            knows: 'private (v, b) and public (V, S)',
            computes: 'shared secret = v · R'
        },
        visualMapping: {
            shape: 'circle',
            attrs: {
                r: 18,
                fill: 'var(--grn)',
                stroke: 'var(--gold)',
                strokeWidth: 2
            },
            labels: [{ text: 'Bob', placement: 'below' }],
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    /* Bob's public view key V — small blue disc above his shoulder. */
    actors.push({
        id: 'bob-V-key',
        role: 'public-view-key',
        initialState: {
            opacity: 0,
            cx: layout.bobVKeyPos.cx,
            cy: layout.bobVKeyPos.cy,
            visibility: 'public — anyone can read it',
            usage: 'derive shared secrets with senders'
        },
        visualMapping: {
            shape: 'circle',
            attrs: {
                r: 8,
                fill: 'var(--blue)',
                stroke: 'rgba(0,0,0,0.5)',
                strokeWidth: 1
            },
            labels: [{ text: 'V', placement: 'above' }],
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    /* Bob's public spend key S — small orange disc above his shoulder. */
    actors.push({
        id: 'bob-S-key',
        role: 'public-spend-key',
        initialState: {
            opacity: 0,
            cx: layout.bobSKeyPos.cx,
            cy: layout.bobSKeyPos.cy,
            visibility: 'public — anyone can read it',
            usage: 'compose destination addresses'
        },
        visualMapping: {
            shape: 'circle',
            attrs: {
                r: 8,
                fill: 'var(--xmr)',
                stroke: 'rgba(0,0,0,0.5)',
                strokeWidth: 1
            },
            labels: [{ text: 'S', placement: 'above' }],
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    /* Random scalar r — green particle that pulses near Alice. */
    actors.push({
        id: 'random-scalar-r',
        role: 'ephemeral-scalar',
        initialState: {
            opacity: 0,
            cx: layout.randomScalarPos.cx,
            cy: layout.randomScalarPos.cy,
            generated: 'fresh per transaction',
            shared: 'never'
        },
        visualMapping: {
            shape: 'circle',
            attrs: {
                r: 7,
                fill: 'var(--grn)',
                stroke: 'rgba(0,0,0,0.5)',
                strokeWidth: 1
            },
            labels: [{ text: 'r', placement: 'above' }],
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    /* R-publication: starts at Alice's r position, travels to chain center.
       Represents R = r·G being published on-chain. */
    actors.push({
        id: 'R-publication',
        role: 'public-r',
        initialState: {
            opacity: 0,
            cx: layout.randomScalarPos.cx,
            cy: layout.randomScalarPos.cy,
            formula: 'R = r · G',
            visibility: 'public — recorded on-chain',
            reveals: 'nothing about r'
        },
        visualMapping: {
            shape: 'circle',
            attrs: {
                r: 9,
                fill: 'var(--blue)',
                stroke: 'var(--xmr)',
                strokeWidth: 1
            },
            labels: [{ text: 'R', placement: 'above' }],
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    /* Alice's ECDH beam: bezier curve from Alice → convergence point. */
    actors.push({
        id: 'alice-beam',
        role: 'ecdh-computation',
        initialState: {
            opacity: 0,
            from: { cx: layout.alicePos.cx, cy: layout.alicePos.cy },
            to: { cx: layout.convergencePos.cx, cy: layout.convergencePos.cy },
            controlPoint: { cx: 0.30, cy: 0.32 },
            progress: 0,
            formula: 'r · V'
        },
        visualMapping: {
            shape: 'path',
            attrs: {
                stroke: 'var(--blue)',
                strokeWidth: 2,
                fill: 'none'
            }
        }
    });

    /* Bob's ECDH beam: bezier curve from Bob → convergence point. */
    actors.push({
        id: 'bob-beam',
        role: 'ecdh-computation',
        initialState: {
            opacity: 0,
            from: { cx: layout.bobPos.cx, cy: layout.bobPos.cy },
            to: { cx: layout.convergencePos.cx, cy: layout.convergencePos.cy },
            controlPoint: { cx: 0.70, cy: 0.32 },
            progress: 0,
            formula: 'v · R'
        },
        visualMapping: {
            shape: 'path',
            attrs: {
                stroke: 'var(--gold)',
                strokeWidth: 2,
                fill: 'none'
            }
        }
    });

    /* Shared secret: appears at the convergence point when both beams arrive. */
    actors.push({
        id: 'shared-secret',
        role: 'shared-secret',
        initialState: {
            opacity: 0,
            cx: layout.convergencePos.cx,
            cy: layout.convergencePos.cy,
            scale: 1,
            formula: 'r · V = v · R = r · v · G',
            property: 'identical on both sides; never transmitted'
        },
        visualMapping: {
            shape: 'circle',
            attrs: {
                r: 14,
                fill: 'var(--gold)',
                stroke: 'var(--xmr)',
                strokeWidth: 2
            },
            labels: [{ text: 'shared secret', placement: 'right' }],
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    /* Convergence flash: particle-burst punctuating the moment both beams arrive. */
    actors.push({
        id: 'convergence-flash',
        role: 'flash',
        initialState: {
            opacity: 0,
            cx: layout.convergencePos.cx,
            cy: layout.convergencePos.cy,
            particleCount: 60,
            radius: 0
        },
        visualMapping: {
            shape: 'particle-burst',
            attrs: {
                fill: 'var(--gold)',
                particleCount: 60
            },
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    /* Derivation arc: bezier from shared-secret down to one-time-address. */
    actors.push({
        id: 'derivation-path',
        role: 'derivation',
        initialState: {
            opacity: 0,
            from: { cx: layout.convergencePos.cx, cy: layout.convergencePos.cy },
            to: { cx: layout.oneTimePos.cx, cy: layout.oneTimePos.cy },
            controlPoint: { cx: 0.40, cy: 0.72 },
            progress: 0
        },
        visualMapping: {
            shape: 'path',
            attrs: {
                stroke: 'var(--gold)',
                strokeWidth: 2,
                fill: 'none'
            }
        }
    });

    /* One-time stealth address P — visually distinct from Bob's public keys:
       larger radius, orange fill, gold border, distinct vertical band. */
    actors.push({
        id: 'one-time-address',
        role: 'stealth-address',
        initialState: {
            opacity: 0,
            cx: layout.oneTimePos.cx,
            cy: layout.oneTimePos.cy,
            scale: 1,
            recognizability: "only Bob's wallet",
            reuse: 'never — fresh per transaction',
            formula: 'P = H(r · V) · G + S'
        },
        visualMapping: {
            shape: 'circle',
            attrs: {
                r: 16,
                fill: 'var(--xmr)',
                stroke: 'var(--gold)',
                strokeWidth: 2
            },
            labels: [{ text: 'one-time address P', placement: 'below' }],
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    /* Recognition halo: ring around Bob that pulses in the final phase,
       signaling "Bob's wallet recognizes this address as his." */
    actors.push({
        id: 'recognition-halo',
        role: 'recognition',
        initialState: {
            opacity: 0,
            cx: layout.bobPos.cx,
            cy: layout.bobPos.cy,
            scale: 1.4
        },
        visualMapping: {
            shape: 'ring',
            attrs: {
                r: 28,
                stroke: 'var(--gold)',
                strokeWidth: 2
            },
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    /* Output arrival: small orange particle traveling from Alice to one-time-address.
       Models the final transaction landing at P. */
    actors.push({
        id: 'output-arrival',
        role: 'output',
        initialState: {
            opacity: 0,
            cx: layout.alicePos.cx,
            cy: layout.alicePos.cy,
            glowIntensity: 1.4
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

    return actors;
}

export function buildSpec(params = {}) {
    const showECDHMath = params.showECDHMath ?? false;
    const layout = computeLayout();

    const sharedSecretField = showECDHMath
        ? { label: 'Formula', valueFromActor: 'formula' }
        : { label: 'Property', valueFromActor: 'property' };

    const oneTimeFields = showECDHMath
        ? [
            { label: 'Formula', valueFromActor: 'formula' },
            { label: 'Recognizability', valueFromActor: 'recognizability' }
        ]
        : [
            { label: 'Recognizability', valueFromActor: 'recognizability' },
            { label: 'Reuse', valueFromActor: 'reuse' }
        ];

    return {
        id: 'stealth-address',
        title: 'Stealth Address Derivation',
        subtitle: 'How Alice and Bob compute the same secret without communicating',
        educationalGoal: 'Every Monero transaction goes to a one-time address only the recipient can recognize. The sender never learns whether the recipient saw it; the recipient knows it is theirs without scanning anyone else’s output.',

        actors: buildActors(layout),

        parameters: [
            {
                id: 'showECDHMath',
                label: 'Show ECDH math',
                type: 'boolean',
                default: false,
                affects: []
            }
        ],

        scene: {
            duration: 13000,
            autoPlay: true,
            loop: true,
            phases: [
                {
                    id: 'setup',
                    label: 'Alice and Bob',
                    startMs: 0,
                    durationMs: 2000,
                    description: 'Bob publishes his keys (V, S). Anyone can see them — including Alice.',
                    transitions: [
                        { actorId: 'alice', targetState: { opacity: 1 }, easing: 'ease-out' },
                        { actorId: 'bob', targetState: { opacity: 1 }, easing: 'ease-out', delayMs: 100 },
                        { actorId: 'bob-V-key', targetState: { opacity: 1 }, easing: 'ease-out', delayMs: 700 },
                        { actorId: 'bob-S-key', targetState: { opacity: 1 }, easing: 'ease-out', delayMs: 900 }
                    ]
                },
                {
                    id: 'random-scalar',
                    label: 'Alice picks a random secret',
                    startMs: 2000,
                    durationMs: 1500,
                    description: 'Alice picks a random scalar r. Fresh per transaction. Never reused. Never shared.',
                    transitions: [
                        { actorId: 'random-scalar-r', targetState: { opacity: 1 }, easing: 'cubic-bezier(.32,.72,.25,1)' }
                    ]
                },
                {
                    id: 'compute-R',
                    label: 'R is published',
                    startMs: 3500,
                    durationMs: 2000,
                    description: 'She publishes R = r·G on the chain. Public, but reveals nothing about r.',
                    transitions: [
                        { actorId: 'R-publication', targetState: {
                            opacity: 1,
                            cx: layout.rPublicationPos.cx,
                            cy: layout.rPublicationPos.cy
                        }, easing: 'cubic-bezier(.4,0,.2,1)' }
                    ]
                },
                {
                    id: 'derive-shared-secret',
                    label: 'Diffie–Hellman convergence',
                    startMs: 5500,
                    durationMs: 2500,
                    description: 'Alice computes r·V. Bob computes v·R. They never speak. They arrive at the same secret.',
                    transitions: [
                        /* Both beams animate simultaneously — NO delayMs.
                           The educational beat is "two lines arriving at the
                           same point at the same time without communication." */
                        { actorId: 'alice-beam', targetState: { opacity: 1, progress: 1 }, easing: 'cubic-bezier(.4,0,.2,1)' },
                        { actorId: 'bob-beam', targetState: { opacity: 1, progress: 1 }, easing: 'cubic-bezier(.4,0,.2,1)' },
                        { actorId: 'shared-secret', targetState: { opacity: 1, scale: 1.25 }, easing: 'cubic-bezier(.32,.72,.25,1)', delayMs: 1600 },
                        { actorId: 'convergence-flash', targetState: { opacity: 1, radius: 0.10 }, easing: 'cubic-bezier(.4,0,.6,1)', delayMs: 1700 }
                    ]
                },
                {
                    id: 'compute-address',
                    label: 'One-time address materializes',
                    startMs: 8000,
                    durationMs: 2000,
                    description: 'From the shared secret, an address P appears. P = H(r·V)·G + S — unique to this transaction.',
                    transitions: [
                        { actorId: 'derivation-path', targetState: { opacity: 1, progress: 1 }, easing: 'cubic-bezier(.4,0,.2,1)' },
                        { actorId: 'one-time-address', targetState: { opacity: 1, scale: 1.1 }, easing: 'cubic-bezier(.32,.72,.25,1)', delayMs: 1000 },
                        { actorId: 'convergence-flash', targetState: { opacity: 0 }, easing: 'ease-out', delayMs: 600 },
                        /* Dim the ECDH beams to direct attention to the new address */
                        { actorId: 'alice-beam', targetState: { opacity: 0.35 }, easing: 'ease-out', delayMs: 800 },
                        { actorId: 'bob-beam', targetState: { opacity: 0.35 }, easing: 'ease-out', delayMs: 800 }
                    ]
                },
                {
                    id: 'recipient-watches',
                    label: 'Bob scans every output',
                    startMs: 10000,
                    durationMs: 1500,
                    description: 'Bob watches every output on the chain. His wallet checks each one against his derivation.',
                    transitions: [
                        { actorId: 'recognition-halo', targetState: { opacity: 0.85, scale: 1.9 }, easing: 'cubic-bezier(.4,0,.6,1)' }
                    ]
                },
                {
                    id: 'output-arrives',
                    label: 'Only Bob recognizes it',
                    startMs: 11500,
                    durationMs: 1500,
                    description: 'The transaction lands at P. Bob recognizes it as his. Nobody else can.',
                    transitions: [
                        /* The output particle travels from Alice's position to the one-time address */
                        { actorId: 'output-arrival', targetState: {
                            opacity: 1,
                            cx: layout.oneTimePos.cx,
                            cy: layout.oneTimePos.cy
                        }, easing: 'cubic-bezier(.45,.85,.35,1)' },
                        { actorId: 'one-time-address', targetState: { opacity: 1, scale: 1.25 }, easing: 'cubic-bezier(.32,.72,.25,1)', delayMs: 800 },
                        { actorId: 'recognition-halo', targetState: { opacity: 1, scale: 2.2 }, easing: 'ease-out', delayMs: 800 }
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
                triggerActorId: 'alice',
                panelTitle: 'Alice (sender)',
                fields: [
                    { label: 'Knows', valueFromActor: 'knows' },
                    { label: 'Computes', valueFromActor: 'computes' }
                ]
            },
            {
                triggerActorId: 'bob',
                panelTitle: 'Bob (recipient)',
                fields: [
                    { label: 'Knows', valueFromActor: 'knows' },
                    { label: 'Computes', valueFromActor: 'computes' }
                ]
            },
            {
                triggerActorId: 'bob-V-key',
                panelTitle: 'Public view key V',
                fields: [
                    { label: 'Visibility', valueFromActor: 'visibility' },
                    { label: 'Used for', valueFromActor: 'usage' }
                ]
            },
            {
                triggerActorId: 'bob-S-key',
                panelTitle: 'Public spend key S',
                fields: [
                    { label: 'Visibility', valueFromActor: 'visibility' },
                    { label: 'Used for', valueFromActor: 'usage' }
                ]
            },
            {
                triggerActorId: 'random-scalar-r',
                panelTitle: 'Random scalar r',
                fields: [
                    { label: 'Generated', valueFromActor: 'generated' },
                    { label: 'Shared', valueFromActor: 'shared' }
                ]
            },
            {
                triggerActorId: 'R-publication',
                panelTitle: 'Public R = r·G',
                fields: [
                    { label: 'Formula', valueFromActor: 'formula' },
                    { label: 'Visibility', valueFromActor: 'visibility' },
                    { label: 'Reveals', valueFromActor: 'reveals' }
                ]
            },
            {
                triggerActorId: 'shared-secret',
                panelTitle: 'Shared secret',
                fields: [sharedSecretField]
            },
            {
                triggerActorId: 'one-time-address',
                panelTitle: 'One-time stealth address P',
                fields: oneTimeFields
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
