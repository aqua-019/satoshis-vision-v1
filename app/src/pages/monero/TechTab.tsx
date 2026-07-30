/**
 * pages/monero/TechTab.tsx — Monero tech: six privacy primitives + tail emission.
 * Ported verbatim from five01 monero-pages.jsx → MoneroTech + EmissionCurve.
 */

import * as React from "react";
import { PageHeader } from "@/layout/AppShell";
import { Card } from "@/design/primitives";
import { AXIS, ChartCrosshair, ChartTip, GRID, nearestIndex, useSvgCursor, type ChartTipRow } from "@/design/chart-kit";
import { useReducedMotion } from "@/design/useReducedMotion";
import type { MoneroTabProps } from "./tabs";

const PRIMITIVES = [
  { k: "Stealth addresses", q: "Who is receiving?",      c: "var(--p-50)",
    b: "Your wallet address never appears on-chain. For every payment, the sender computes a one-time address from yours that only you can recognise. Watch every transaction in the world; you'll never see your address listed because it's not stored." },
  { k: "Ring signatures",   q: "Who is sending?",         c: "var(--tk-accent)",
    b: "The sender groups 15 random unspent outputs from the chain alongside their real one and signs as the group. A verifier can confirm the spend is valid but can't tell which of the 16 outputs was the actual source." },
  { k: "RingCT",            q: "How much was sent?",      c: "var(--tk-accent)",
    b: "Pedersen commitments hide every amount as a homomorphic blob. The math proves inputs equal outputs without revealing the numbers. The chain confirms conservation; the value remains sealed." },
  { k: "Dandelion++",       q: "Where did it come from?", c: "var(--p-50)",
    b: 'Before a transaction broadcasts widely, it travels along a "stem" of hand-picked peers. Only after several hops does it "fluff" out to the whole network. Observers see fluff peers; the origin is hidden.' },
  { k: "View tags",         q: "Faster wallet sync?",     c: "var(--c-50)",
    b: "Since 2022, every output carries a 1-byte hint that lets wallets skip 255/256 of work on outputs that aren't theirs. Sync time dropped 30–40%. No privacy loss — the tag carries no identifying information." },
  { k: "FCMP++ (Q3 2026)",  q: "How big is the crowd?",   c: "var(--g-50)",
    b: "Full-chain Membership Proofs replace the 16-member ring with a proof that the real spender is somewhere in the entire UTXO set — currently 150M+ outputs. The anonymity multiplier goes from 16× to >10,000,000×." },
] as const;

// Monero targets one block every 120s. Averaging a 365-day year:
// 365 × 24h × 60m × 60s ÷ 120s/block ≈ 262,800 blocks/year. Used below only to
// give the hovered year an *approximate* block height — the real chain has
// jitter block-to-block, so this is a reader's landmark, not a chain query.
const BLOCKS_PER_YEAR = 262_800;

function fmtXMR(v: number): string {
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// Small "nice round number" tick generator — mirrors the algorithm in
// pages/markets/charts.tsx (niceNum/niceTicks), which isn't exported for
// reuse. Kept local so this axis follows the same visual idiom.
function niceTicks(min: number, max: number, count = 5): number[] {
  if (!isFinite(min) || !isFinite(max) || min === max) return [min];
  const niceNum = (range: number, round: boolean): number => {
    const r = range || 1;
    const exp = Math.floor(Math.log10(r));
    const f = r / Math.pow(10, exp);
    const nf = round ? (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) : (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10);
    return nf * Math.pow(10, exp);
  };
  const step = niceNum(niceNum(max - min, false) / Math.max(1, count - 1), true);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step * 0.5; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

function fmtSupplyTick(v: number): string {
  if (v === 0) return "0";
  const m = v / 1_000_000;
  return (Number.isInteger(m) ? m.toFixed(0) : m.toFixed(1)) + "M";
}

function EmissionCurve() {
  const W = 900, H = 220;
  const padL = 40, padR = 20, padT = 14, padB = 30;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  // 100 years of emission computed from the protocol's emission formula
  const years = 100;
  const pts: Array<{ y: number; supply: number; emit: number }> = [];
  let supply = 0;
  for (let y = 0; y < years; y++) {
    let emitYear: number;
    if (y < 8) {
      // smooth-decay phase (2014 to 2022)
      emitYear = 7_500_000 * Math.exp(-y * 0.5);
    } else {
      emitYear = 157_680; // tail
    }
    supply += emitYear;
    pts.push({ y, supply, emit: emitYear });
  }
  const maxSupply = pts[pts.length - 1].supply;
  const maxEmit = Math.max(...pts.map((p) => p.emit));
  const xOf = (i: number): number => padL + (i / (years - 1)) * innerW;
  const yOfS = (v: number): number => padT + innerH - (v / maxSupply) * innerH;
  const yOfE = (v: number): number => padT + innerH - (Math.log10(v + 1) / Math.log10(maxEmit + 1)) * innerH;
  const supplyPath = "M" + pts.map((p, i) => `${xOf(i)},${yOfS(p.supply)}`).join(" L ");
  const emitPath = "M" + pts.map((p, i) => `${xOf(i)},${yOfE(p.emit)}`).join(" L ");
  const supplyTicks = niceTicks(0, maxSupply, 5);

  const reduced = useReducedMotion();
  const [fade, setFade] = React.useState(reduced ? 1 : 0);
  React.useEffect(() => {
    if (reduced) { setFade(1); return; }
    const id = requestAnimationFrame(() => setFade(1));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  const [ref, vx, handlers] = useSvgCursor(W);
  const hoverI = nearestIndex(vx, { padL, innerW, n: years });
  const hp = hoverI != null ? pts[hoverI] : null;
  const isTail = hp ? hp.y >= 8 : false;

  const tipRows: ChartTipRow[] = hp
    ? [
        { label: "YEAR", value: String(2014 + hp.y) },
        { label: "BLOCK ≈", value: fmtXMR(Math.round(hp.y * BLOCKS_PER_YEAR)) },
        { label: "SUPPLY", value: fmtXMR(hp.supply) + " XMR", color: "var(--tk-accent)" },
        {
          label: isTail ? "TAIL EMIT" : "EMIT (log)",
          value: fmtXMR(hp.emit) + (isTail ? " XMR/yr · flat 0.6/block tail" : " XMR/yr · decaying"),
          color: isTail ? "var(--p-50)" : undefined,
        },
      ]
    : [];

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      style={{ display: "block", touchAction: "pan-y", opacity: fade, transition: reduced ? "none" : "opacity 0.35s ease" }}
      {...handlers}
    >
      {/* supply gridlines + y ticks */}
      {supplyTicks.map((t) => (
        <g key={"gy" + t}>
          <line x1={padL} y1={yOfS(t)} x2={padL + innerW} y2={yOfS(t)} stroke={GRID} strokeDasharray="2 4" />
          <text x={padL - 6} y={yOfS(t) + 3} textAnchor="end" fontFamily="var(--f-mono)" fontSize="10" fill={AXIS}>{fmtSupplyTick(t)}</text>
        </g>
      ))}

      <line x1={xOf(8)} y1={padT} x2={xOf(8)} y2={padT + innerH} stroke="var(--ink-20)" strokeDasharray="2 3" />
      <text x={xOf(8) + 4} y={padT + 10} fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.12em">TAIL BEGINS · 2022</text>
      <path d={emitPath} fill="none" stroke="var(--p-50)" strokeWidth="1.4" />
      <path d={supplyPath} fill="none" stroke="var(--tk-accent)" strokeWidth="1.6" style={{ filter: "drop-shadow(0 0 3px var(--tk-accent))" }} />
      <text x={padL} y={padT + 10} fontFamily="var(--f-mono)" fontSize="9" fill="var(--tk-accent)" letterSpacing="0.1em">SUPPLY (linear, asymptotic ~22M)</text>
      <text x={padL + 280} y={padT + 10} fontFamily="var(--f-mono)" fontSize="9" fill="var(--p-50)" letterSpacing="0.1em">YEARLY EMISSION (log)</text>
      <text x={padL} y={H - 12} fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.18em">2014</text>
      <text x={xOf(50)} y={H - 12} fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.18em">2064</text>
      <text x={xOf(99)} y={H - 12} fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.18em">2114</text>

      {/* hover: crosshair + focus dots on both curves + tooltip */}
      {hp && hoverI != null ? (
        <>
          <ChartCrosshair x={xOf(hoverI)} y1={padT} y2={padT + innerH} />
          <g pointerEvents="none">
            <circle cx={xOf(hoverI)} cy={yOfS(hp.supply)} r={3} fill="var(--tk-accent)" />
            <circle cx={xOf(hoverI)} cy={yOfE(hp.emit)} r={3} fill="var(--p-50)" />
          </g>
          <ChartTip x={xOf(hoverI)} bounds={{ left: padL, right: padL + innerW }} rows={tipRows} />
        </>
      ) : null}
    </svg>
  );
}

export function TechTab(_props: MoneroTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        kicker="The privacy stack · ELI5"
        title='Five primitives, <em style="color:var(--p-50);text-shadow:var(--glow-p);font-style:normal">five questions</em> they answer.'
        sub="Each piece hides exactly one thing. Stack them and the chain stops talking."
      />

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {PRIMITIVES.map((p) => (
          <Card key={p.k} style={{ padding: 22 }}>
            <div className="kicker" style={{ color: p.c }}>{p.k}</div>
            <div className="serif" style={{ fontSize: 22, color: "var(--ink-100)", margin: "8px 0", fontWeight: 400 }}>{p.q}</div>
            <p className="mono dim" style={{ margin: 0, fontSize: 12, lineHeight: 1.7 }}>{p.b}</p>
          </Card>
        ))}
      </section>

      {/* Tail emission deep dive */}
      <Card style={{ padding: 26 }}>
        <div className="kicker">Tail emission · the math, and the why</div>
        <h3 className="serif" style={{ margin: "10px 0", fontSize: 26, fontWeight: 400, color: "var(--ink-100)" }}>
          <em style={{ color: "var(--tk-accent)", fontStyle: "normal", textShadow: "var(--glow-1)" }}>0.6 XMR</em> per block · forever.
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 14 }}>
          <div>
            <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.75 }}>
              From 2014 to May 2022, Monero followed a smooth-decay emission curve. The block reward dropped exponentially toward an asymptote — and in May 2022 (block 1,978,433), it crossed the floor of <b className="acc">0.6 XMR / block</b>. From that block forward, the reward is fixed at 0.6 XMR. Approximately <b className="acc">157,680 XMR per year</b> are emitted, indefinitely.
            </p>
            <p className="mono dim" style={{ fontSize: 12, lineHeight: 1.75, marginTop: 10 }}>
              At ~18.5M circulating supply (2026), that's <b>~0.85% inflation</b>. By year 2050, with ~22M circulating, inflation drops to <b>~0.72%</b>. As supply grows, the inflation rate decays asymptotically toward zero — but the absolute miner reward stays constant.
            </p>
          </div>
          <div>
            <p className="serif" style={{ fontSize: 17, color: "var(--ink-100)", margin: 0, fontWeight: 400, fontStyle: "italic" }}>
              "It costs something to verify a chain forever. That something must be paid."
            </p>
            <p className="mono dim" style={{ fontSize: 11.5, lineHeight: 1.7, marginTop: 14 }}>
              Bitcoin's halving schedule predicts zero new emission by ~2140. After that, miners must be paid entirely by fees. Whether fee revenue is sufficient — and stable — has never been empirically tested at scale. <b className="dn">The security budget cliff is real.</b>
            </p>
            <p className="mono dim" style={{ fontSize: 11.5, lineHeight: 1.7, marginTop: 8 }}>
              Monero's tail emission elects a different tradeoff: a tiny perpetual dilution buys a permanent, predictable miner subsidy. <b className="up">The hearth never goes cold.</b> Privacy networks need this even more than transparent ones: no anonymity set survives if no miner shows up.
            </p>
          </div>
        </div>

        {/* Visualization — emission curve */}
        <div style={{ marginTop: 24 }}>
          <EmissionCurve />
        </div>
      </Card>
    </div>
  );
}
