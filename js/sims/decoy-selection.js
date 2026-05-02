/**
 * Sim 1: Decoy Selection Algorithm
 *
 * Educational goal: The true spender is one of 16 ring members. Statistical
 * analysis cannot reliably identify which one because all 16 are sampled
 * from the same distribution.
 *
 * See docs/v4-phase5-simulations.md Brief 1 for the canonical spec.
 */

const SECONDS_PER_DAY = 86400;
const SECONDS_PER_BLOCK = 120;

function sampleLogNormalAge(meanDays = 7, sigma = 0.5) {
    const u1 = Math.max(Number.MIN_VALUE, Math.random());
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const meanS = meanDays * SECONDS_PER_DAY;
    const lnMean = Math.log(meanS);
    return Math.exp(lnMean + sigma * z);
}

function ageToCanvasX(ageDays) {
    const minLog = Math.log(0.5);
    const maxLog = Math.log(1825);
    const ageLog = Math.log(Math.max(0.5, ageDays));
    const t = (ageLog - minLog) / (maxLog - minLog);
    return 0.95 - (t * 0.85);
}

function buildActors(ringSize) {
    const actors = [];

    actors.push({
        id: 'chain-blocks',
        role: 'chain-spine',
        initialState: { opacity: 0, blockCount: 720 },
        visualMapping: {
            shape: 'instanced',
            attrs: {
                cy: 0.88,
                width: 0.92,
                height: 0.04,
                fill: 'var(--surface-2)',
                stroke: 'rgba(255,102,0,0.2)',
                strokeWidth: 1
            },
            webgl: { material: 'standard', blendMode: 'normal' }
        }
    });

    actors.push({
        id: 'density-curve',
        role: 'distribution',
        initialState: { opacity: 0, drawProgress: 0, meanDays: 7, sigma: 0.5 },
        visualMapping: {
            shape: 'path',
            attrs: {
                stroke: 'var(--xmr)',
                strokeWidth: 2,
                fill: 'rgba(255,102,0,0.08)',
                opacity: 0
            },
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    actors.push({
        id: 'output-pool',
        role: 'output-set',
        initialState: { opacity: 0, count: 5000 },
        visualMapping: {
            shape: 'instanced-points',
            attrs: {
                fill: 'rgba(255,102,0,0.15)',
                pointSize: 2
            },
            webgl: { material: 'standard', blendMode: 'normal' }
        }
    });

    for (let i = 0; i < ringSize; i++) {
        actors.push({
            id: `ring-member-${i}`,
            role: 'ring-member',
            initialState: {
                opacity: 0,
                cx: 0.5,
                cy: 0.5,
                r: 8,
                ageBlocks: 0,
                ageDays: 0,
                outputIndex: 0,
                isTrueSpender: false,
                index: i,
                glowIntensity: 1
            },
            visualMapping: {
                shape: 'circle',
                attrs: {
                    r: 8,
                    fill: 'var(--xmr)',
                    stroke: 'rgba(0,0,0,0.5)',
                    strokeWidth: 1
                },
                labels: [{ text: `#${i}`, placement: 'below' }],
                webgl: { material: 'glow', blendMode: 'additive' }
            }
        });
    }

    actors.push({
        id: 'true-spender-marker',
        role: 'highlight',
        initialState: { opacity: 0, cx: 0.5, cy: 0.5, scale: 1, r: 14 },
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

    return actors;
}

function ringMemberSpawnTransitions(ringSize, totalDurationMs, trueSpenderAgeDays, trueSpenderIndex, sampledAges) {
    const transitions = [];
    for (let i = 0; i < ringSize; i++) {
        const ageS = i === trueSpenderIndex
            ? trueSpenderAgeDays * SECONDS_PER_DAY
            : sampledAges[i];
        const ageDays = ageS / SECONDS_PER_DAY;

        const xPos = ageToCanvasX(ageDays);
        const yPos = 0.32 + ((i * 37) % 100) / 100 * 0.30;

        const delayFraction = (i / Math.max(1, ringSize - 1));
        const delayMs = delayFraction * totalDurationMs * 0.7;

        transitions.push({
            actorId: `ring-member-${i}`,
            targetState: {
                opacity: 1,
                cx: xPos,
                cy: yPos,
                ageBlocks: Math.floor(ageS / SECONDS_PER_BLOCK),
                ageDays: Number(ageDays.toFixed(1)),
                outputIndex: Math.floor(20000 + Math.random() * 80000),
                isTrueSpender: i === trueSpenderIndex
            },
            easing: 'cubic-bezier(.4,0,.2,1)',
            delayMs
        });
    }
    return transitions;
}

function ringMemberObscureTransitions(ringSize) {
    const transitions = [];
    for (let i = 0; i < ringSize; i++) {
        transitions.push({
            actorId: `ring-member-${i}`,
            targetState: { opacity: 1, glowIntensity: 0.85 },
            easing: 'ease-out'
        });
    }
    return transitions;
}

export function buildSpec(params = {}) {
    const ringSize = params.ringSize ?? 16;
    const spendOutputAge = params.spendOutputAge ?? 7;

    /* Pick true spender deterministically per build so the highlight has
       a stable target and we know which actor it should track. */
    const trueSpenderIndex = Math.floor(Math.random() * ringSize);

    /* Sample each non-spender age once at build time; transitions use these
       so the same positions are reached on every frame. */
    const sampledAges = new Array(ringSize);
    for (let i = 0; i < ringSize; i++) {
        sampledAges[i] = sampleLogNormalAge(7, 0.5);
    }

    const trueSpenderXY = (() => {
        const x = ageToCanvasX(spendOutputAge);
        const y = 0.32 + ((trueSpenderIndex * 37) % 100) / 100 * 0.30;
        return { x, y };
    })();

    return {
        id: 'decoy-selection',
        title: 'Decoy Selection',
        subtitle: 'How Monero picks 16 ring members from a distribution',
        educationalGoal: 'The true spender is one of 16 ring members. Statistical analysis cannot reliably identify which one because all 16 are sampled from the same distribution.',

        actors: buildActors(ringSize),

        parameters: [
            {
                id: 'ringSize',
                label: 'Ring members',
                type: 'number',
                default: 16,
                min: 4,
                max: 64,
                step: 1,
                affects: ['sampling', 'reveal-true-spender', 'obscure']
            },
            {
                id: 'spendOutputAge',
                label: 'True spender age (days)',
                type: 'number',
                default: 7,
                min: 1,
                max: 1825,
                step: 1,
                affects: ['sampling', 'reveal-true-spender']
            },
            {
                id: 'showAllOutputs',
                label: 'Show all outputs',
                type: 'boolean',
                default: true,
                affects: ['sampling']
            }
        ],

        scene: {
            duration: 12000,
            autoPlay: true,
            loop: true,
            phases: [
                {
                    id: 'intro',
                    label: 'Introducing the chain',
                    startMs: 0,
                    durationMs: 1000,
                    description: 'The Monero blockchain. Each block creates outputs that can later be ring members.',
                    transitions: [
                        { actorId: 'chain-blocks', targetState: { opacity: 1 }, easing: 'ease-out' }
                    ]
                },
                {
                    id: 'density-curve',
                    label: 'Sampling distribution',
                    startMs: 1000,
                    durationMs: 2500,
                    description: 'Recent outputs are weighted more heavily. The curve shows where ring members will likely come from.',
                    transitions: [
                        { actorId: 'density-curve', targetState: { opacity: 0.85, drawProgress: 1 }, easing: 'ease-out' },
                        { actorId: 'output-pool', targetState: { opacity: 0.6 }, easing: 'ease-out' }
                    ]
                },
                {
                    id: 'sampling',
                    label: 'Selecting ring members',
                    startMs: 3500,
                    durationMs: 4500,
                    description: '16 ring members chosen, mostly from recent outputs but a few from older ones.',
                    transitions: ringMemberSpawnTransitions(ringSize, 4500, spendOutputAge, trueSpenderIndex, sampledAges)
                },
                {
                    id: 'reveal-true-spender',
                    label: 'The true spender',
                    startMs: 8000,
                    durationMs: 1500,
                    description: 'One of the 16 is the actual sender. Watch which one.',
                    transitions: [
                        {
                            actorId: 'true-spender-marker',
                            targetState: { opacity: 1, scale: 1.3, cx: trueSpenderXY.x, cy: trueSpenderXY.y },
                            easing: 'cubic-bezier(.4,0,.6,1)'
                        }
                    ]
                },
                {
                    id: 'obscure',
                    label: 'Indistinguishable',
                    startMs: 9500,
                    durationMs: 2500,
                    description: 'From outside, all 16 ring members appear identical. Statistical analysis cannot determine which is the true spender.',
                    transitions: [
                        { actorId: 'true-spender-marker', targetState: { opacity: 0, scale: 1 }, easing: 'ease-out' },
                        ...ringMemberObscureTransitions(ringSize)
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
                triggerActorId: 'density-curve',
                panelTitle: 'Log-normal distribution',
                fields: [
                    { label: 'Mean', valueFromActor: 'meanDays' },
                    { label: 'Sigma', valueFromActor: 'sigma' }
                ]
            },
            {
                triggerActorId: 'chain-blocks',
                panelTitle: 'The Monero blockchain',
                fields: [
                    { label: 'Blocks shown', valueFromActor: 'blockCount' }
                ]
            },
            ...Array.from({ length: ringSize }, (_, i) => ({
                triggerActorId: `ring-member-${i}`,
                panelTitle: `Ring member #${i}`,
                fields: [
                    { label: 'Output index', valueFromActor: 'outputIndex' },
                    { label: 'Age (blocks)', valueFromActor: 'ageBlocks' },
                    { label: 'Age (days)', valueFromActor: 'ageDays' }
                ]
            }))
        ]
    };
}

const spec = buildSpec();
spec.__buildSpec = buildSpec;
if (typeof window !== 'undefined' && window.GenUI) {
    window.GenUI.register(spec);
}

export { spec };
