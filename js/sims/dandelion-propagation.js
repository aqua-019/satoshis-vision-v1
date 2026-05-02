/**
 * Sim 2: Dandelion++ Stem-Phase Propagation
 *
 * Educational goal: Before broadcast, transactions take a randomized walk
 * through stem nodes. Observers can't easily trace the originator from the
 * broadcast pattern because the originating node is hidden several hops
 * upstream.
 *
 * See docs/v4-phase5-simulations.md Brief 2 for the canonical spec.
 */

/* Real Dandelion++ uses a 2-regular stem subgraph — each node has exactly two
   stem neighbors. We approximate with a high marking probability so generated
   topologies stay traversable; visually the remaining ~25% of edges read as
   "fluff-only" (dimmer). */
const STEM_EDGE_PROBABILITY = 0.75;

function generateTopology(networkSize) {
    const nodes = [];
    const edges = [];

    for (let i = 0; i < networkSize; i++) {
        const angle = (i / networkSize) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const radius = 0.15 + Math.random() * 0.30;
        const cx = 0.5 + Math.cos(angle) * radius;
        const cy = 0.5 + Math.sin(angle) * radius * 0.85;

        nodes.push({
            id: `mempool-node-${i}`,
            cx,
            cy,
            connections: [],
            stemConnections: []
        });
    }

    const edgeKeys = new Set();
    for (let i = 0; i < nodes.length; i++) {
        const distances = [];
        for (let j = 0; j < nodes.length; j++) {
            if (i === j) continue;
            const dx = nodes[i].cx - nodes[j].cx;
            const dy = nodes[i].cy - nodes[j].cy;
            distances.push({ idx: j, dist: Math.sqrt(dx * dx + dy * dy) });
        }
        distances.sort((a, b) => a.dist - b.dist);

        const connectionCount = 3 + Math.floor(Math.random() * 3);
        for (let k = 0; k < Math.min(connectionCount, distances.length); k++) {
            const targetIdx = distances[k].idx;
            const lo = Math.min(i, targetIdx);
            const hi = Math.max(i, targetIdx);
            const edgeKey = `${lo}-${hi}`;
            if (edgeKeys.has(edgeKey)) continue;
            edgeKeys.add(edgeKey);

            const isStem = Math.random() < STEM_EDGE_PROBABILITY;
            edges.push({ key: edgeKey, from: lo, to: hi, isStem });
            nodes[lo].connections.push(hi);
            nodes[hi].connections.push(lo);
            if (isStem) {
                nodes[lo].stemConnections.push(hi);
                nodes[hi].stemConnections.push(lo);
            }
        }
    }

    return { nodes, edges };
}

function computeStemPath(topology, stemLength, fluffProbability) {
    const { nodes } = topology;

    let originatorIdx = -1;
    for (let attempt = 0; attempt < 30; attempt++) {
        const candidate = Math.floor(Math.random() * nodes.length);
        if (nodes[candidate].stemConnections.length > 0) {
            originatorIdx = candidate;
            break;
        }
    }
    if (originatorIdx === -1) originatorIdx = Math.floor(Math.random() * nodes.length);

    const path = [originatorIdx];
    const visited = new Set([originatorIdx]);

    let currentIdx = originatorIdx;
    let hopCount = 0;

    while (hopCount < stemLength) {
        const stemNeighbors = nodes[currentIdx].stemConnections.filter(n => !visited.has(n));
        if (stemNeighbors.length === 0) break;

        if (hopCount > 0 && Math.random() < fluffProbability) break;

        const nextIdx = stemNeighbors[Math.floor(Math.random() * stemNeighbors.length)];
        path.push(nextIdx);
        visited.add(nextIdx);
        currentIdx = nextIdx;
        hopCount++;
    }

    return { path, originatorIdx, fluffNodeIdx: currentIdx };
}

function buildActors(networkSize, topology) {
    const actors = [];

    for (let i = 0; i < networkSize; i++) {
        const node = topology.nodes[i];
        actors.push({
            id: `mempool-node-${i}`,
            role: 'network-node',
            initialState: {
                opacity: 0,
                cx: node.cx,
                cy: node.cy,
                glowIntensity: 0.4
            },
            visualMapping: {
                shape: 'circle',
                attrs: {
                    r: 5,
                    fill: 'var(--xmr)',
                    stroke: 'rgba(255, 102, 0, 0.4)',
                    strokeWidth: 1
                },
                webgl: { material: 'glow', blendMode: 'additive' }
            }
        });
    }

    actors.push({
        id: 'network-edges',
        role: 'graph-edges',
        initialState: {
            opacity: 0,
            count: networkSize,
            stemCount: topology.edges.filter(e => e.isStem).length
        },
        visualMapping: {
            shape: 'graph-edge',
            attrs: {
                edges: topology.edges.map(e => ({
                    from: { cx: topology.nodes[e.from].cx, cy: topology.nodes[e.from].cy },
                    to: { cx: topology.nodes[e.to].cx, cy: topology.nodes[e.to].cy },
                    isStem: e.isStem
                })),
                stroke: 'rgba(255, 102, 0, 0.18)',
                stemStroke: 'rgba(255, 102, 0, 0.42)',
                strokeWidth: 1
            },
            webgl: { material: 'standard', blendMode: 'normal' }
        }
    });

    actors.push({
        id: 'tx-packet',
        role: 'transaction',
        initialState: {
            opacity: 0,
            cx: 0.5,
            cy: 0.5,
            phase: 'pending',
            hopCount: 0
        },
        visualMapping: {
            shape: 'particle-trail',
            attrs: {
                r: 7,
                fill: 'var(--xmr)',
                trailLength: 12,
                trailFade: 0.85
            },
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    actors.push({
        id: 'originator-mark',
        role: 'highlight-fading',
        initialState: {
            opacity: 0,
            cx: 0.5,
            cy: 0.5,
            scale: 1,
            glowIntensity: 0.6,
            hopsUpstream: 0
        },
        visualMapping: {
            shape: 'circle',
            attrs: {
                r: 16,
                fill: 'var(--xmr)',
                stroke: 'rgba(255, 102, 0, 0.7)',
                strokeWidth: 2
            },
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    actors.push({
        id: 'fluff-burst',
        role: 'broadcast',
        initialState: {
            opacity: 0,
            cx: 0.5,
            cy: 0.5,
            radius: 0
        },
        visualMapping: {
            shape: 'particle-burst',
            attrs: {
                fill: 'var(--xmr)',
                particleCount: 80
            },
            webgl: { material: 'glow', blendMode: 'additive' }
        }
    });

    return actors;
}

function spawnNodeTransitions(networkSize, totalDurationMs) {
    const transitions = [];
    for (let i = 0; i < networkSize; i++) {
        const delay = (i / Math.max(1, networkSize - 1)) * totalDurationMs * 0.6;
        transitions.push({
            actorId: `mempool-node-${i}`,
            targetState: { opacity: 1 },
            easing: 'ease-out',
            delayMs: delay
        });
    }
    return transitions;
}

function buildStemWalkPhases(stemPath, topology, totalDurationMs, startMs) {
    const phases = [];
    const hops = Math.max(0, stemPath.path.length - 1);
    if (hops === 0) {
        phases.push({
            id: 'stem-walk-noop',
            label: 'Stem walk (no stem neighbors)',
            startMs,
            durationMs: totalDurationMs,
            description: 'Originator has no stem-edge neighbors; transaction stays put before fluffing.',
            transitions: []
        });
        return phases;
    }

    const hopDuration = totalDurationMs / hops;

    for (let h = 0; h < hops; h++) {
        const targetNodeIdx = stemPath.path[h + 1];
        const targetNode = topology.nodes[targetNodeIdx];
        const hopsCompleted = h + 1;
        const originatorOpacity = Math.max(0.05, 0.50 - hopsCompleted * 0.05);

        phases.push({
            id: `stem-walk-${h}`,
            label: `Stem hop ${hopsCompleted}/${hops}`,
            startMs: startMs + h * hopDuration,
            durationMs: hopDuration,
            description: `Hop ${hopsCompleted} of ${hops}: originator now ${hopsCompleted} ${hopsCompleted === 1 ? 'hop' : 'hops'} upstream.`,
            transitions: [
                {
                    actorId: 'tx-packet',
                    targetState: {
                        cx: targetNode.cx,
                        cy: targetNode.cy,
                        phase: 'stem',
                        hopCount: hopsCompleted
                    },
                    easing: 'cubic-bezier(.4,0,.2,1)'
                },
                {
                    actorId: 'originator-mark',
                    targetState: {
                        opacity: originatorOpacity,
                        hopsUpstream: hopsCompleted
                    },
                    easing: 'linear'
                }
            ]
        });
    }

    return phases;
}

export function buildSpec(params = {}) {
    const networkSize = Number(params.networkSize ?? 30);
    const stemLength = Number(params.stemLength ?? 10);
    const fluffProbability = Number(params.fluffProbability ?? 0.1);

    const topology = generateTopology(networkSize);
    const stemPath = computeStemPath(topology, stemLength, fluffProbability);

    /* "Compute once, expose downstream" — pinned positions for downstream phases */
    const originatorPos = topology.nodes[stemPath.originatorIdx];
    const fluffPos = topology.nodes[stemPath.fluffNodeIdx];

    const stemWalkPhases = buildStemWalkPhases(stemPath, topology, 7000, 3000);

    const phases = [
        {
            id: 'network-spawn',
            label: 'Network appears',
            startMs: 0,
            durationMs: 2000,
            description: 'Mempool nodes connect into a peer-to-peer network. Stem edges (brighter) carry private propagation.',
            transitions: [
                ...spawnNodeTransitions(networkSize, 2000),
                { actorId: 'network-edges', targetState: { opacity: 1 }, easing: 'ease-out', delayMs: 800 }
            ]
        },
        {
            id: 'tx-origin',
            label: 'Transaction emerges',
            startMs: 2000,
            durationMs: 1000,
            description: 'A transaction is created at one node. Watch closely — by the time it broadcasts, you will lose track of where it came from.',
            transitions: [
                {
                    actorId: 'tx-packet',
                    targetState: {
                        opacity: 1,
                        cx: originatorPos.cx,
                        cy: originatorPos.cy,
                        phase: 'origin',
                        hopCount: 0
                    },
                    easing: 'ease-out'
                },
                {
                    actorId: 'originator-mark',
                    targetState: {
                        opacity: 0.50,
                        cx: originatorPos.cx,
                        cy: originatorPos.cy,
                        hopsUpstream: 0
                    },
                    easing: 'ease-out'
                }
            ]
        },
        ...stemWalkPhases,
        {
            id: 'fluff-trigger',
            label: 'Fluff phase begins',
            startMs: 10000,
            durationMs: 1000,
            description: 'A node decides to broadcast. The transaction transitions from stem to fluff.',
            transitions: [
                {
                    actorId: 'tx-packet',
                    targetState: {
                        cx: fluffPos.cx,
                        cy: fluffPos.cy,
                        phase: 'fluff'
                    },
                    easing: 'ease-out'
                },
                {
                    actorId: 'fluff-burst',
                    targetState: {
                        opacity: 1,
                        cx: fluffPos.cx,
                        cy: fluffPos.cy,
                        radius: 0
                    },
                    easing: 'ease-out'
                }
            ]
        },
        {
            id: 'broadcast',
            label: 'Network broadcast',
            startMs: 11000,
            durationMs: 2500,
            description: 'Transaction propagates to every connected node simultaneously.',
            transitions: [
                {
                    actorId: 'fluff-burst',
                    targetState: { opacity: 1, radius: 0.5 },
                    easing: 'cubic-bezier(.4,0,.6,1)'
                },
                {
                    actorId: 'tx-packet',
                    targetState: { opacity: 0 },
                    easing: 'ease-out'
                }
            ]
        },
        {
            id: 'outro',
            label: 'Originator hidden',
            startMs: 13500,
            durationMs: 500,
            description: 'The original sender is several hops upstream. You have already lost track.',
            transitions: [
                {
                    actorId: 'originator-mark',
                    targetState: { opacity: 0.05 },
                    easing: 'ease-out'
                },
                {
                    actorId: 'fluff-burst',
                    targetState: { opacity: 0 },
                    easing: 'ease-out'
                }
            ]
        }
    ];

    return {
        id: 'dandelion-propagation',
        title: 'Dandelion++ Propagation',
        subtitle: 'How transactions hide their origin in the mempool',
        educationalGoal: "Before broadcast, transactions take a randomized walk through stem nodes. Observers can't easily trace the originator from the broadcast pattern because the originating node is hidden several hops upstream.",

        actors: buildActors(networkSize, topology),

        parameters: [
            {
                id: 'stemLength',
                label: 'Stem hops',
                type: 'number',
                default: 10,
                min: 1,
                max: 30,
                step: 1,
                affects: ['stem-walk']
            },
            {
                id: 'fluffProbability',
                label: 'Fluff probability',
                type: 'number',
                default: 0.1,
                min: 0,
                max: 1,
                step: 0.05,
                affects: ['stem-walk']
            },
            {
                id: 'networkSize',
                label: 'Network nodes',
                type: 'choice',
                default: 30,
                choices: [
                    { value: 10, label: '10' },
                    { value: 30, label: '30' },
                    { value: 100, label: '100' },
                    { value: 300, label: '300' }
                ],
                affects: ['network-spawn']
            }
        ],

        scene: {
            duration: 14000,
            autoPlay: true,
            loop: true,
            phases
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
                triggerActorId: 'network-edges',
                panelTitle: 'Network topology',
                fields: [
                    { label: 'Nodes', valueFromActor: 'count' },
                    { label: 'Stem edges', valueFromActor: 'stemCount' }
                ]
            },
            {
                triggerActorId: 'tx-packet',
                panelTitle: 'Transaction in flight',
                fields: [
                    { label: 'Phase', valueFromActor: 'phase' },
                    { label: 'Hop count', valueFromActor: 'hopCount' }
                ]
            },
            {
                triggerActorId: 'originator-mark',
                panelTitle: 'Original sender',
                fields: [
                    { label: 'Hops upstream', valueFromActor: 'hopsUpstream' }
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
