// protocols/stressnet.tsx — WIND TUNNEL
// A model of the Umbrel Superstress Net: dial the storm up and watch Monero's
// dynamic block size, the fee market and FCMP++ verification load respond.
//
// The finding the stage is built to deliver: at stressnet scale the binding
// constraint is the block-size ratchet, NOT proof verification. Verification
// load climbs and stays well inside the 2-minute budget; what actually breaks
// is the hard 2× median cap, which the long-term median only relaxes slowly.
// A stress test that never fails proves nothing, so the failure is explicit.
//
// Pure MODEL surface — the `data` prop is intentionally never read, and after
// p3·19 that is a PERMANENT property rather than a state to revisit. The real
// superstress net is self-hosted and runs its own daemon, so there is no
// public endpoint for this file to consume — not "not yet wired", but no such
// thing to wire (see AUTOMATION_ROWS in pages/future/data.ts, and the answer
// on /operate/superstress). Nothing here may read as a measurement from it.
//
// ── p4·07 AMENDS THAT PARAGRAPH, DELIBERATELY, AND NARROWS NOTHING ──────
// The sentence above is a claim about DIRECTION, and it still holds exactly as
// written: the `data` prop is still never read, `ViewProps.data` is still
// destructured away unused, and no live feed reaches this file. What changed is
// the OTHER direction — this model now FEEDS a surface. p4·07's
// `/operate/superstress/explorer` renders a simulated beta-chain explorer whose
// every number comes from `model()`, which moved to the pure leaf
// `stressnet-model.ts` so the explorer could import the arithmetic without
// importing this component.
//
// The distinction is the whole reason the amendment is safe to make, so it is
// written down rather than left implied: "this file consumes no measurement"
// and "this file's output is consumed" are different properties, and only the
// first was ever the permanent one. A model that nothing reads is a model
// nobody can be misled by; a model that feeds a page is exactly where the
// misleading starts, which is why that page carries a persistent
// BETANET · NOT MAINNET · TEST FUNDS ONLY banner, the word SIMULATED, its own
// accent and a MODEL provenance badge — the rule /operate/superstress wrote
// down in p3·19 before there was anything to apply it to.
//
// What has NOT changed and must not: nothing here, and nothing downstream of
// here, may read as a measurement of the real Superstress Net. The chain
// parameters remain undocumented and un-invented.

import * as React from "react";
import { Link } from "react-router-dom";
import { ProtoArtboard, ProtoStep } from "@/design/ProtoArtboard";
import { ProtoCanvas } from "@/protocols/use-proto-canvas";
import type { ProtoDrawFn } from "@/protocols/use-proto-canvas";
import { Stat } from "@/design/primitives";
import { Provenance } from "@/design/provenance";
import type { MoneroLive } from "@/data/types";
import {
  model, kb, FLOOR_KB, CAP_KB, BLOCK_SEC, PROOF_KB, VERIFY_MS,
} from "@/protocols/stressnet-model";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

const MONO = '"JetBrains Mono", ui-monospace, monospace';

export function StressnetView({ bg }: ViewProps) {
  const [intensity, setIntensity] = React.useState(28);
  const m = React.useMemo(() => model(intensity), [intensity]);
  const mRef = React.useRef(m);
  mRef.current = m;

  const draw: ProtoDrawFn = (ctx, w, h, t) => {
    const s = mRef.current;
    ctx.clearRect(0, 0, w, h);
    const padX = 14;
    const innerW = w - padX * 2;

    // ── storm band · inflow particles, bounded by canvas area so a 390px
    // phone never draws the desktop's sprite count.
    const bandH = h * 0.3;
    const maxN = Math.max(18, Math.min(130, Math.floor((w * h) / 2600)));
    const n = Math.round(maxN * (0.12 + 0.88 * (intensity / 100)));
    for (let i = 0; i < n; i++) {
      const sp = 0.16 + (i % 7) * 0.03 + (intensity / 100) * 0.5;
      const x = ((t * sp + i * 0.137) % 1.12) * innerW + padX;
      const y = 16 + (((i * 53) % 100) / 100) * (bandH - 20);
      ctx.strokeStyle = `rgba(255,120,50,${0.25 + 0.4 * (intensity / 100)})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.textAlign = "left"; ctx.font = `11px ${MONO}`;
    ctx.fillStyle = "rgba(168,160,148,0.75)";
    ctx.fillText(`INCOMING · ${kb(s.demandKB)} of demand per block`, padX, 12);

    // ── block box · width tracks weight against the median and the 2× cap
    const scale = innerW / (CAP_KB * 1.25);
    const boxY = bandH + 26;
    const boxH = Math.max(34, h * 0.2);
    const blkW = Math.max(4, s.blockKB * scale);

    ctx.fillStyle = s.broken ? "rgba(255,77,109,0.16)" : "rgba(74,222,128,0.13)";
    ctx.fillRect(padX, boxY, blkW, boxH);
    ctx.strokeStyle = s.broken ? "#ff4d6d" : "#4ade80";
    ctx.lineWidth = 1.6;
    ctx.strokeRect(padX, boxY, blkW, boxH);

    const marks: Array<[number, string, string]> = [
      [padX + s.medianKB * scale, "median", "rgba(255,212,0,0.9)"],
      [padX + CAP_KB * scale, "2× median · hard cap", "rgba(255,77,109,0.9)"],
    ];
    for (const [x, text, col] of marks) {
      ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(x, boxY - 8); ctx.lineTo(x, boxY + boxH + 8); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.font = `11px ${MONO}`; ctx.textAlign = "left";
      ctx.fillText(text, Math.min(x + 4, Math.max(padX, w - 150)), boxY - 12);
    }
    ctx.fillStyle = "rgba(240,236,228,0.95)";
    ctx.font = `700 12px ${MONO}`; ctx.textAlign = "left";
    ctx.fillText(`BLOCK ${kb(s.blockKB)}`, padX + 6, boxY + boxH / 2 + 4);

    // ── verification + backlog meters
    const mY = boxY + boxH + 28;
    const mH = 12;
    const meter = (y: number, frac: number, col: string, text: string) => {
      ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(padX, y, innerW, mH);
      ctx.fillStyle = col; ctx.fillRect(padX, y, Math.max(2, innerW * Math.min(1, frac)), mH);
      ctx.fillStyle = "rgba(168,160,148,0.85)"; ctx.font = `11px ${MONO}`; ctx.textAlign = "left";
      ctx.fillText(text, padX, y - 5);
    };
    meter(mY, s.verifyPct / 100, "rgba(94,211,244,0.8)",
      `FCMP++ VERIFY · ${(s.verifyMs / 1000).toFixed(1)}s of the ${BLOCK_SEC}s budget (${s.verifyPct.toFixed(1)}%)`);
    meter(mY + 36, s.broken ? Math.min(1, s.backlogKB / 1400) : 0,
      s.broken ? "rgba(255,77,109,0.85)" : "rgba(74,222,128,0.45)",
      s.broken
        ? `MEMPOOL BACKLOG · +${kb(s.backlogKB)} per block, growing`
        : "MEMPOOL BACKLOG · none — demand fits under the cap");
  };

  const label =
    `Wind tunnel at storm intensity ${intensity} of 100. Demand ${kb(m.demandKB)} per block; ` +
    `block weight ${kb(m.blockKB)} against a ${kb(m.medianKB)} median and a ${kb(CAP_KB)} hard cap. ` +
    `Block-reward penalty ${m.penaltyPct.toFixed(1)} percent; fee multiplier ${m.feeMult.toFixed(1)} times, ${m.tier} tier. ` +
    `FCMP++ verification ${(m.verifyMs / 1000).toFixed(1)} of the ${BLOCK_SEC} second budget. ` +
    (m.broken
      ? `Breaking: demand exceeds the hard cap, so ${kb(m.backlogKB)} per block backs up in the mempool and fees escalate.`
      : `Stable: all demand fits beneath the cap and the mempool drains each block.`);

  return (
    <ProtoArtboard
      label="Stressnet · Wind Tunnel"
      kicker="MONERO PROTOCOL · CONSENSUS · WIND TUNNEL"
      title='Stressnet — put FCMP++ in a <em>wind tunnel</em>'
      sub="Before FCMP++ activates on mainnet the community runs it under deliberate abuse: storm campaigns, dynamic-block-size pressure, proof-verification load — measured, shared, fixed, repeated. Turn the dial and watch which constraint gives first."
      badges={[
        { label: "Dynamic block size", tone: "acc" },
        { label: "FCMP++ beta chain", tone: "priv" },
        { label: m.broken ? "⚠ cap exceeded — backlog" : "✓ within cap", tone: m.broken ? "" : "ready" },
      ]}
      right={<Provenance source="model" />}
      bg={bg}
      stage={
        <>
          <div style={{ position: "absolute", top: 0, right: 0, fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-40)", letterSpacing: "0.18em" }}>
            FIG. S1 · WIND TUNNEL · MODELLED, NOT MEASURED
          </div>

          <ProtoCanvas draw={draw} height={340} label={label} />

          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <label htmlFor="storm-intensity" style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", color: "var(--ink-80)" }}>
              Storm intensity
            </label>
            <input
              id="storm-intensity" type="range" min={0} max={100} step={1} value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              style={{ flex: "1 1 180px", minWidth: 150, accentColor: "var(--tk-accent)" }}
            />
            <span style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", color: "var(--tk-accent)" }}>
              {intensity} / 100
            </span>
            <span style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", color: m.broken ? "#ff4d6d" : "var(--g-50)" }}>
              {m.broken ? "✗ FAILING · block-size cap exceeded" : "✓ HOLDING · demand fits"}
            </span>
          </div>

          <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <Stat k="BLOCK WEIGHT" v={kb(m.blockKB)} sub={`median ${kb(m.medianKB)}`} tone="acc" />
            <Stat k="REWARD PENALTY" v={m.penaltyPct.toFixed(1) + "%"} sub="((B/M)−1)² of base" tone={m.penaltyPct > 20 ? "dn" : undefined} />
            <Stat k="FEE MULTIPLIER" v={m.feeMult.toFixed(1) + "×"} sub={m.tier + " tier"} tone="p" />
            <Stat k="VERIFY LOAD" v={(m.verifyMs / 1000).toFixed(1) + "s"} sub={`${m.verifyPct.toFixed(1)}% of ${BLOCK_SEC}s`} tone={m.verifyPct > 60 ? "dn" : "g"} />
          </div>
        </>
      }
      panel={
        <>
          <div>
            <h6>The metaphor</h6>
            <div className="lede">
              A <span style={{ color: "#4ade80" }}>wind tunnel</span>. You don't learn an airframe's limits by flying it gently — you clamp it down and raise the wind until something deforms. The superstress net is that tunnel, and FCMP++ is the airframe.
            </div>
          </div>

          <div className="body">
            Monero has no fixed block size. A block may grow past the rolling <b>median</b> of recent blocks, but the miner pays a <b>penalty</b> on the base reward proportional to <em>((B/M) − 1)²</em>, and no block may exceed <b>2× the median</b>. Below a {FLOOR_KB} kB floor there is no penalty at all. The median is itself ratcheted by a long-term median, so capacity can rise — but only slowly, and deliberately so.
          </div>

          <div>
            <h6>Turn the dial · what gives first</h6>
            <ProtoStep n={1} done title="Calm — the penalty-free zone">Under {FLOOR_KB} kB nothing happens. Blocks absorb the load, fees sit at the floor, miners pay no penalty.</ProtoStep>
            <ProtoStep n={2} on={m.blockKB > FLOOR_KB && !m.broken} title="Blocks expand, miners pay for it">Past the median every extra byte costs the miner reward. That penalty is what stops a spammer buying unbounded blockspace cheaply.</ProtoStep>
            <ProtoStep n={3} on={m.feeMult > 4} title="The fee market answers">Competition for scarce blockspace escalates through the priority tiers. Fees are the second brake, after the penalty.</ProtoStep>
            <ProtoStep n={4} on={m.broken} title={`Where it breaks — the ${kb(CAP_KB)} cap`}>Push past the cap and the excess simply cannot be mined this block. The mempool backs up and keeps backing up, because the ratchet will not let capacity double on demand. <b>This is the binding constraint — not FCMP++ verification, which never leaves single-digit percentages of the block budget here.</b></ProtoStep>
            <ProtoStep n={5} on={!m.broken && intensity > 0} title="What recovers">Drop the dial. Backlog drains, the median relaxes toward the long-term median, penalties fall away. Capacity is elastic upward and sticky downward — by design.</ProtoStep>
          </div>

          <div>
            <h6>Model parameters · illustrative</h6>
            <div className="proto-ctrl-row"><span className="k">Penalty-free floor</span><span className="v">{FLOOR_KB} kB</span></div>
            <div className="proto-ctrl-row"><span className="k">Hard cap</span><span className="v acc">2 × median = {kb(CAP_KB)}</span></div>
            <div className="proto-ctrl-row"><span className="k">FCMP++ proof</span><span className="v">~{PROOF_KB} kB · ~{VERIFY_MS} ms</span></div>
            <div className="proto-ctrl-row"><span className="k">Block target</span><span className="v">{BLOCK_SEC}s</span></div>
            <div className="proto-ctrl-row"><span className="k">Numbers</span><span className="v">modelled, not measured</span></div>
          </div>

          <div className="body" style={{ borderTop: "1px dashed var(--ink-10)", paddingTop: 12 }}>
            {/* No provenance claim about MoneroSpace here either — see the
                note on ECOSYSTEM[0] in pages/future/data.ts. */}
            <em>The real tunnel:</em> the <b>Umbrel Superstress Net</b> is a live community FCMP++ beta chain. Nothing on this page is a reading from it: the chain is self-hosted, so the only way to read it is to run a node on it.{" "}
            <Link to="/future" style={{ color: "var(--tk-accent)" }}>See the Superstress Net card →</Link>
          </div>
        </>
      }
    />
  );
}
