/**
 * Sim 3: View Tag Matching
 *
 * Educational goal: View tags let wallets skip ~99% of outputs without
 * compromising privacy — a 256× scan speedup that nobody can attribute
 * to a specific user.
 *
 * See docs/v4-phase5-simulations.md Brief 3 for the canonical spec.
 *
 * Architectural notes
 * -------------------
 * The engine collapses every transition in a phase into a single end-state
 * snapshot, then interpolates from prev-phase end → current-phase end. So
 * giving the cursor 150 per-output transitions in one phase is wasted — only
 * the LAST cursor cx/cy survives. We use one cursor transition per phase
 * (cursor sweeps diagonally from grid start to grid end). The per-output
 * scan rhythm comes from each output actor having a single transition with
 * a delayMs proportional to its grid index. Phase 2's 7s duration vs phase
 * 4's 4s duration is the visible "slow vs fast" rhythm; the 256× ratio is
 * reserved for the literal width difference of the comparison bars.
 */

function generateOutputGrid(outputCount) {
    const positions = [];
    const aspectRatio = 16 / 9;
    const cols = Math.ceil(Math.sqrt(outputCount * aspectRatio));
    const rows = Math.ceil(outputCount / cols);

    const xStart = 0.08;
    const xEnd = 0.92;
    const yStart = 0.20;
    const yEnd = 0.74;

    const xStep = cols > 1 ? (xEnd - xStart) / (cols - 1) : 0;
    const yStep = rows > 1 ? (yEnd - yStart) / (rows - 1) : 0;

    for (let i = 0; i < outputCount; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        positions.push({
            cx: xStart + col * xStep,
            cy: yStart + row * yStep
        });
    }

    return { positions, cols, rows };
}

function chooseUserOwnedIndices(outputCount, userOwnedRatio) {
    const ownedCount = Math.max(1, Math.round(outputCount * userOwnedRatio));
    const indices = new Set();
    while (indices.size < ownedCount && indices.size < outputCount) {
        indices.add(Math.floor(Math.random() * outputCount));
    }
    return indices;
}

function buildActors(outputCount, grid, userOwnedIndices) {
    const actors = [];

    for (let i = 0; i < outputCount; i++) {
        actors.push({
            id: `output-${i}`,
            role: 'wallet-output',
            initialState: {
                opacity: 0,
                cx: grid.positions[i].cx,
                cy: grid.positions[i].cy,
                scanState: 'idle',
                isUserOwned: userOwnedIndices.has(i),
                glowIntensity: 0.6
            },
            visualMapping: {
                shape: 'circle',
                attrs: {
                    r: 5,
                    fill: 'var(--xmr)',
                    stroke: 'rgba(255, 102, 0, 0.5)',
                    strokeWidth: 1
                },
                webgl: { material: 'glow', blendMode: 'additive' }
            }
        });
    }

    actors.push({
        id: 'scan-cursor',
        role: 'scan-indicator',
        initialState: {
            opacity: 0,
            cx: grid.positions[0].cx,
            cy: grid.positions[0].cy,
            scanMode: 'idle',
            glowIntensity: 1
        },
        visualMapping: {
            shape: 'circle',
            attrs: {
                r: 12,
                fill: 'var(--gold)',
                stroke: 'rgba(255, 215, 0, 0.7)',
                strokeWidth: 2
            },
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    actors.push({
        id: 'comparison-bar-without',
        role: 'comparison-bar',
        initialState: {
            opacity: 0,
            cx: 0.50,
            cy: 0.86,
            barWidth: 0,
            color: 'var(--red)',
            msPerOutput: 50,
            totalMs: 50 * outputCount
        },
        visualMapping: {
            shape: 'comparison-bar',
            attrs: {
                height: 0.04,
                anchorX: 0.10,
                fill: 'var(--red)'
            },
            labels: [{ text: 'Without view tags', placement: 'below' }]
        }
    });

    actors.push({
        id: 'comparison-bar-with',
        role: 'comparison-bar',
        initialState: {
            opacity: 0,
            cx: 0.50,
            cy: 0.94,
            barWidth: 0,
            color: 'var(--grn)',
            msPerOutput: 0.2,
            totalMs: Math.round(0.2 * outputCount * 10) / 10
        },
        visualMapping: {
            shape: 'comparison-bar',
            attrs: {
                height: 0.04,
                anchorX: 0.10,
                fill: 'var(--grn)'
            },
            labels: [{ text: 'With view tags  (256× faster)', placement: 'below' }]
        }
    });

    return actors;
}

function spawnOutputTransitions(outputCount, totalDurationMs) {
    const transitions = [];
    for (let i = 0; i < outputCount; i++) {
        const delay = (i / Math.max(1, outputCount - 1)) * totalDurationMs * 0.7;
        transitions.push({
            actorId: `output-${i}`,
            targetState: { opacity: 0.55, scanState: 'idle' },
            easing: 'ease-out',
            delayMs: delay
        });
    }
    return transitions;
}

function resetOutputTransitions(outputCount) {
    const transitions = [];
    for (let i = 0; i < outputCount; i++) {
        transitions.push({
            actorId: `output-${i}`,
            targetState: { opacity: 0.55, scanState: 'idle', glowIntensity: 0.6 },
            easing: 'linear'
        });
    }
    return transitions;
}

/* Per-output transitions for a scan phase.
   - 'full-decrypt-all': every output flashes brightly with a slow rhythm
   - 'view-tag-fast': only user-owned outputs flash brightly; the rest get
     a barely-visible blip. Stagger speed reflects the cursor sweep rate. */
function scanOutputTransitions(outputCount, userOwnedIndices, totalDurationMs, mode, viewTagsEnabled) {
    const transitions = [];
    const msPerOutput = totalDurationMs / Math.max(1, outputCount);

    for (let i = 0; i < outputCount; i++) {
        const delay = i * msPerOutput;
        const isOwned = userOwnedIndices.has(i);

        let opacity, glowIntensity, scanState;
        if (mode === 'full-decrypt-all' || !viewTagsEnabled) {
            opacity = 1;
            glowIntensity = 1.6;
            scanState = 'full-decrypt';
        } else if (isOwned) {
            opacity = 1;
            glowIntensity = 2.0;
            scanState = 'full-decrypt';
        } else {
            opacity = 0.65;
            glowIntensity = 0.6;
            scanState = 'view-tag-skip';
        }

        transitions.push({
            actorId: `output-${i}`,
            targetState: { opacity, glowIntensity, scanState },
            easing: 'ease-out',
            delayMs: delay
        });
    }

    return transitions;
}

export function buildSpec(params = {}) {
    const outputCount = Number(params.outputCount ?? 150);
    const userOwnedRatio = Number(params.userOwnedRatio ?? 0.02);
    const viewTagsEnabled = params.viewTagsEnabled ?? true;

    const grid = generateOutputGrid(outputCount);
    const userOwnedIndices = chooseUserOwnedIndices(outputCount, userOwnedRatio);

    const scanWithoutDuration = 7000;
    const scanWithDuration = 4000;

    const firstPos = grid.positions[0];
    const lastPos = grid.positions[outputCount - 1];

    /* Bar widths represent the educational story: 256× ratio.
       barWidth is in canvas-fraction units (0..1). The "without" bar is
       sized to nearly fill the available width (0.78 of canvas), and the
       "with" bar is exactly 1/256th of that — typically ~0.003, which
       at a 1200px canvas renders ~3.6px wide. Tiny but visible: that IS
       the lesson. */
    const withoutBarWidth = 0.78;
    const withBarWidth = withoutBarWidth / 256;

    return {
        id: 'view-tag-matching',
        title: 'View Tag Matching',
        subtitle: 'How view tags speed up wallet scans 256×',
        educationalGoal: 'View tags let wallets skip ~99% of outputs without compromising privacy — a 256× scan speedup that nobody can attribute to a specific user.',

        actors: buildActors(outputCount, grid, userOwnedIndices),

        parameters: [
            {
                id: 'outputCount',
                label: 'Output count',
                type: 'number',
                default: 150,
                min: 50,
                max: 500,
                step: 10,
                affects: ['setup', 'scan-without-tags', 'scan-with-tags']
            },
            {
                id: 'userOwnedRatio',
                label: 'User-owned ratio',
                type: 'number',
                default: 0.02,
                min: 0.01,
                max: 0.1,
                step: 0.01,
                affects: ['scan-with-tags']
            },
            {
                id: 'viewTagsEnabled',
                label: 'View tags',
                type: 'boolean',
                default: true,
                affects: ['scan-with-tags', 'comparison']
            }
        ],

        scene: {
            duration: 16000,
            autoPlay: true,
            loop: true,
            phases: [
                {
                    id: 'setup',
                    label: 'Output pool',
                    startMs: 0,
                    durationMs: 2000,
                    description: 'A wallet starts a scan. The blockchain has many outputs to check — most are not yours.',
                    transitions: spawnOutputTransitions(outputCount, 2000)
                },
                {
                    id: 'scan-without-tags',
                    label: 'Without view tags',
                    startMs: 2000,
                    durationMs: 7000,
                    description: 'Every output requires a full decrypt — slow. The wallet scans them one at a time.',
                    transitions: [
                        ...scanOutputTransitions(outputCount, userOwnedIndices, scanWithoutDuration, 'full-decrypt-all', viewTagsEnabled),
                        {
                            actorId: 'scan-cursor',
                            targetState: {
                                opacity: 1,
                                cx: lastPos.cx,
                                cy: lastPos.cy,
                                scanMode: 'slow',
                                glowIntensity: 1.6
                            },
                            easing: 'linear'
                        }
                    ]
                },
                {
                    id: 'transition',
                    label: 'Now with view tags…',
                    startMs: 9000,
                    durationMs: 1000,
                    description: 'The wallet rests. Now imagine a 1-byte tag attached to each output.',
                    transitions: [
                        ...resetOutputTransitions(outputCount),
                        {
                            actorId: 'scan-cursor',
                            targetState: {
                                opacity: 0.4,
                                cx: firstPos.cx,
                                cy: firstPos.cy,
                                scanMode: 'transition',
                                glowIntensity: 1
                            },
                            easing: 'ease-in-out'
                        }
                    ]
                },
                {
                    id: 'scan-with-tags',
                    label: 'With view tags',
                    startMs: 10000,
                    durationMs: 4000,
                    description: 'A 1-byte check rules out 99% of outputs in microseconds. Full decrypt only on the few that match.',
                    transitions: [
                        ...scanOutputTransitions(outputCount, userOwnedIndices, scanWithDuration, 'view-tag-fast', viewTagsEnabled),
                        {
                            actorId: 'scan-cursor',
                            targetState: {
                                opacity: 1,
                                cx: lastPos.cx,
                                cy: lastPos.cy,
                                scanMode: viewTagsEnabled ? 'fast' : 'slow',
                                glowIntensity: viewTagsEnabled ? 0.9 : 1.6
                            },
                            easing: 'linear'
                        }
                    ]
                },
                {
                    id: 'comparison',
                    label: 'The speedup',
                    startMs: 14000,
                    durationMs: 2000,
                    description: 'Same outputs scanned. View tags finish in a fraction of the time, with no privacy cost.',
                    transitions: [
                        {
                            actorId: 'scan-cursor',
                            targetState: { opacity: 0, scanMode: 'idle' },
                            easing: 'ease-out'
                        },
                        {
                            actorId: 'comparison-bar-without',
                            targetState: { opacity: 1, barWidth: withoutBarWidth },
                            easing: 'cubic-bezier(.4,0,.2,1)'
                        },
                        {
                            actorId: 'comparison-bar-with',
                            targetState: {
                                opacity: 1,
                                barWidth: viewTagsEnabled ? withBarWidth : withoutBarWidth
                            },
                            easing: 'cubic-bezier(.4,0,.2,1)',
                            delayMs: 600
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
                triggerActorId: 'scan-cursor',
                panelTitle: 'Scan operation',
                fields: [
                    { label: 'Mode', valueFromActor: 'scanMode' }
                ]
            },
            {
                triggerActorId: 'comparison-bar-without',
                panelTitle: 'Without view tags',
                fields: [
                    { label: 'Per output (ms)', valueFromActor: 'msPerOutput' },
                    { label: 'Total scan (ms)', valueFromActor: 'totalMs' }
                ]
            },
            {
                triggerActorId: 'comparison-bar-with',
                panelTitle: 'With view tags',
                fields: [
                    { label: 'Per output (ms)', valueFromActor: 'msPerOutput' },
                    { label: 'Total scan (ms)', valueFromActor: 'totalMs' }
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
