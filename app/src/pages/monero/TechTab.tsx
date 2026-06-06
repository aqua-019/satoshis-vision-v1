/**
 * pages/monero/TechTab.tsx — Monero tech: six privacy primitives + tail emission.
 * Ported verbatim from five01 monero-pages.jsx → MoneroTech + EmissionCurve.
 */

import * as React from "react";
import { PageHeader } from "@/layout/AppShell";
import { Card } from "@/design/primitives";
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

function EmissionCurve() {
  const W = 900, H = 220;
  const padL = 40, padR = 20, padT = 14, padB = 30;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  // 100 years of simulated emission curve
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
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      <line x1={xOf(8)} y1={padT} x2={xOf(8)} y2={padT + innerH} stroke="var(--ink-20)" strokeDasharray="2 3" />
      <text x={xOf(8) + 4} y={padT + 10} fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.12em">TAIL BEGINS · 2022</text>
      <path d={emitPath} fill="none" stroke="var(--p-50)" strokeWidth="1.4" />
      <path d={supplyPath} fill="none" stroke="var(--tk-accent)" strokeWidth="1.6" style={{ filter: "drop-shadow(0 0 3px var(--tk-accent))" }} />
      <text x={padL} y={padT + 10} fontFamily="var(--f-mono)" fontSize="9" fill="var(--tk-accent)" letterSpacing="0.1em">SUPPLY (linear, asymptotic ~22M)</text>
      <text x={padL + 280} y={padT + 10} fontFamily="var(--f-mono)" fontSize="9" fill="var(--p-50)" letterSpacing="0.1em">YEARLY EMISSION (log)</text>
      <text x={padL} y={H - 12} fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.18em">2014</text>
      <text x={xOf(50)} y={H - 12} fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.18em">2064</text>
      <text x={xOf(99)} y={H - 12} fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.18em">2114</text>
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
