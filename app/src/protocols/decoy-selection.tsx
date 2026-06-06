// AUTO-PORTED from protocols/decoy-selection.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import { useTick, ArtBackground } from "@/design/ArtBackground";
import {
  Stat, Pill, PanelFrame, Sparkline, MiniBar, Crumbs, Card,
} from "@/design/primitives";
import { ProtoArtboard, ProtoStep, ProtoHeader } from "@/design/ProtoArtboard";
import { NavTop } from "@/layout/NavTop";
import { NetRail } from "@/layout/NetRail";
import { Footer } from "@/layout/Footer";
import { useMoneroLive } from "@/data/DataContext";
import { fmtN, fmtFee, fmtBytes, shortHash as ShortHash, randHex } from "@/data/types";
import type { MoneroLive } from "@/data/types";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

// decoy-selection.jsx — TIME TIDE
// Outputs bob on a horizontal age-axis tide. Log-normal sampling density
// IS the wave height. 16 ring members surface as glowing buoys. The real
// spender is statistically indistinguishable from its 15 decoys.

export function TimeTide({ ringSize = 16, trueAge = 7, total = 380 }: any) {
  const tick = useTick(60);
  // Generate stable outputs across an age axis (0 → 365 days)
  const outputs = React.useMemo(() => {
    return Array.from({ length: total }, (_, i) => {
      // Outputs are denser at recent ages (Monero's UTXO age distribution)
      const u = Math.pow(Math.random(), 2.5);
      return { age: u * 365, y: Math.random() };
    });
  }, [total]);

  // Log-normal CDF approximation for ring sampling
  // f(x) = (1/(xσ√2π)) exp(-(ln x − μ)²/(2σ²))
  // We use μ=1.7, σ=0.85 days (close to Monero's actual sampling)
  const lognormPdf = (x: number) => {
    if (x <= 0) return 0;
    const mu = 1.7, sigma = 0.85;
    return (1 / (x * sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-Math.pow(Math.log(x) - mu, 2) / (2 * sigma * sigma));
  };

  // Pick 16 ring members deterministically from sampling distribution
  const ring = React.useMemo(() => {
    const picks = [];
    // 1 real spender at age=trueAge
    picks.push({ age: trueAge, real: true });
    for (let i = 0; i < ringSize - 1; i++) {
      // Sample from log-normal via inverse-CDF approximation
      const u = Math.random();
      const z = Math.sqrt(-2 * Math.log(u || 0.001)) * Math.cos(2 * Math.PI * Math.random());
      const days = Math.exp(1.7 + z * 0.85);
      picks.push({ age: Math.min(360, days), real: false });
    }
    return picks.sort((a, b) => a.age - b.age);
  }, [ringSize, trueAge]);

  const W = 1080, H = 380;
  const padL = 56, padR = 32, padT = 30, padB = 60;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const ageMax = 90; // show first 90 days; older outputs compressed in tail
  const xOf = (age: number) => padL + (Math.min(age, ageMax) / ageMax) * innerW;

  // Wave curve samples
  const wavePts = [];
  const sample = 200;
  for (let i = 0; i <= sample; i++) {
    const age = (i / sample) * ageMax;
    const p = lognormPdf(age + 0.1);
    wavePts.push([xOf(age), padT + innerH - p * 1400]);
  }
  const wavePath = "M " + wavePts.map((p) => p.join(",")).join(" L ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      <defs>
        <linearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="rgba(255,122,26,0.45)" />
          <stop offset="60%" stopColor="rgba(255,122,26,0.12)" />
          <stop offset="100%" stopColor="rgba(255,122,26,0)" />
        </linearGradient>
        <linearGradient id="tideStroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"  stopColor="rgba(255,200,120,1)" />
          <stop offset="100%" stopColor="rgba(255,122,26,0.4)" />
        </linearGradient>
        <radialGradient id="buoyReal">
          <stop offset="0%" stopColor="#ffce8a" />
          <stop offset="60%" stopColor="rgba(255,180,80,0.9)" />
          <stop offset="100%" stopColor="rgba(255,122,26,0)" />
        </radialGradient>
      </defs>

      {/* depth grid */}
      {Array.from({ length: 10 }).map((_, i) => {
        const x = padL + (i / 9) * innerW;
        const days = ((i / 9) * ageMax).toFixed(0);
        return (
          <g key={i}>
            <line x1={x} y1={padT} x2={x} y2={padT + innerH} stroke="rgba(255,122,26,0.05)" />
            <text x={x} y={padT + innerH + 16} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)">
              {days}d
            </text>
          </g>
        );
      })}
      <text x={padL} y={padT + innerH + 36} fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.18em">
        AGE OF OUTPUT  ⟶ (days since mined)
      </text>
      <text x={W - padR} y={padT + innerH + 36} fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" textAnchor="end" letterSpacing="0.18em">
        ◀ MORE RECENT · OLDER ▶
      </text>

      {/* depth ruler — outputs in the "sea" below the wave */}
      {outputs.map((o, i) => {
        const x = xOf(o.age);
        const y = padT + innerH * 0.6 + o.y * (innerH * 0.36);
        const dim = Math.max(0.06, 0.25 - o.age / 360 * 0.18);
        return <circle key={i} cx={x} cy={y} r="0.9" fill={`rgba(255,200,140,${dim})`} />;
      })}

      {/* wave fill */}
      <path d={wavePath + ` L ${padL + innerW} ${padT + innerH} L ${padL} ${padT + innerH} Z`} fill="url(#tideFill)" />
      {/* wave line */}
      <path d={wavePath} fill="none" stroke="url(#tideStroke)" strokeWidth="1.5"
        style={{ filter: "drop-shadow(0 0 6px rgba(255,122,26,0.5))" }} />

      {/* ring members surface as buoys */}
      {ring.map((r: any, i: number) => {
        const x = xOf(r.age);
        const p = lognormPdf(r.age + 0.1);
        const yWave = padT + innerH - p * 1400;
        const bob = Math.sin((tick + i * 12) * 0.06) * 3;
        return (
          <g key={i}>
            {/* tether line down to sea floor */}
            <line x1={x} y1={yWave} x2={x} y2={padT + innerH} stroke="rgba(255,122,26,0.18)" strokeDasharray="2 3" />
            {/* buoy */}
            <circle cx={x} cy={yWave + bob} r={r.real ? 14 : 8} fill={r.real ? "url(#buoyReal)" : "none"} opacity={r.real ? 0.7 : 0} />
            <circle cx={x} cy={yWave + bob} r={r.real ? 5 : 4}
              fill={r.real ? "#ffce8a" : "rgba(255,180,80,0.95)"}
              stroke={r.real ? "#ffd9a0" : "rgba(255,200,120,0.4)"} strokeWidth="1"
              style={{ filter: r.real ? "drop-shadow(0 0 4px #ff7a1a)" : "drop-shadow(0 0 4px rgba(255,122,26,0.8))" }} />
            {/* label */}
            <text x={x} y={yWave + bob - 12} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9"
              fill={r.real ? "#ffce8a" : "rgba(255,200,140,0.7)"}
              opacity={r.real ? 1 : 0.6}>
              #{i.toString().padStart(2, "0")}
            </text>
          </g>
        );
      })}

      {/* "true spender" marker - HIDDEN BY DEFAULT; small annotation underneath */}
      {(() => {
        const realIdx = ring.findIndex((r) => r.real);
        const r = ring[realIdx];
        const x = xOf(r.age);
        const yWave = padT + innerH - lognormPdf(r.age + 0.1) * 1400;
        return (
          <g>
            <text x={x} y={padT - 8} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="#ffd400"
              style={{ filter: "drop-shadow(0 0 4px #ffd400)" }}>
              ↓ TRUE SPENDER
            </text>
            <line x1={x} y1={padT - 4} x2={x} y2={yWave - 10} stroke="#ffd400" strokeDasharray="2 2" opacity="0.6" />
          </g>
        );
      })()}
    </svg>
  );
}

export function IndistinguishabilityProbe({ ring }: any) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="kicker">SPOTLIGHT TEST — pick the real spender</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(16, 1fr)", gap: 4 }}>
        {ring.map((r: any, i: number) => (
          <div key={i} style={{
            aspectRatio: "1",
            border: "1px solid var(--ink-20)",
            background: r.real ? "linear-gradient(135deg, rgba(255,180,80,0.4), rgba(255,122,26,0.25))" : "rgba(255,122,26,0.18)",
            display: "grid", placeItems: "center",
            fontFamily: "var(--f-mono)", fontSize: 9,
            color: r.real ? "var(--ink-100)" : "var(--ink-60)",
          }}>
            #{i.toString().padStart(2, "0")}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--f-mono)", fontSize: 9.5, color: "var(--ink-40)", marginTop: 4 }}>
        <span>Verifier sees: <span className="acc">16 valid signatures</span></span>
        <span>P(spotting real spender) → <span className="acc">1/16</span></span>
      </div>
    </div>
  );
}

export function DecoySelectionView({ data, bg }: ViewProps) {
  const [ringSize] = React.useState(16);
  const [trueAge] = React.useState(7);
  const ring = React.useMemo(() => {
    const picks = [{ age: trueAge, real: true }];
    for (let i = 0; i < ringSize - 1; i++) {
      const u = Math.random() || 0.001;
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
      const days = Math.exp(1.7 + z * 0.85);
      picks.push({ age: Math.min(360, days), real: false });
    }
    return picks.sort(() => Math.random() - 0.5);
  }, [ringSize, trueAge]);

  return (
    <ProtoArtboard
      label="P1 · Decoy Selection"
      kicker="MONERO PROTOCOL · 01 · RING SIGNATURES · CLSAG"
      title='Decoy <em>selection</em> — 16 statistical twins'
      sub="The signer chooses 15 decoys from the chain's own UTXO set, weighted toward recent ages. From the verifier's seat, none of the 16 is distinguishable from any other."
      badges={[
        { label: "Ring 16", tone: "acc" },
        { label: "log-normal μ=1.7 σ=0.85", tone: "" },
        { label: "Ready", tone: "ready" },
      ]}
      bg={bg}
      stage={
        <>
          <div style={{ position: "absolute", top: 0, right: 0, fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--ink-40)", letterSpacing: "0.18em" }}>
            FIG. 01 · TIME TIDE · DENSITY CURVE = SAMPLING WEIGHT
          </div>
          <TimeTide ringSize={ringSize} trueAge={trueAge} />
          <div style={{ marginTop: 32 }}>
            <IndistinguishabilityProbe ring={ring} />
          </div>
        </>
      }
      panel={
        <>
          <div>
            <h6>What you're seeing</h6>
            <div className="lede">
              The curve is the <span style={{ color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>sampling density</span>. The buoys are 16 UTXOs the wallet pulled up from the chain. One of them is the real spender. <em>Fifteen are statistical doppelgängers.</em>
            </div>
          </div>

          <div className="body">
            Monero samples each ring member from a log-normal distribution over output <b>age</b> — heavy near recent outputs (where most real spends occur), tapering into older outputs. The shape of the curve matches the <em>actual</em> spending behavior of the network, so the real spender's age is always <em>somewhere</em> on the wave the verifier already expects.
          </div>

          <div>
            <h6>Parameters</h6>
            <div className="proto-ctrl">
              <div className="proto-ctrl-row"><span className="k">Ring size</span><span className="v acc">{ringSize}</span></div>
              <div className="proto-ctrl-row"><span className="k">μ (log-mean)</span><span className="v">1.70</span></div>
              <div className="proto-ctrl-row"><span className="k">σ (log-sd)</span><span className="v">0.85</span></div>
              <div className="proto-ctrl-row"><span className="k">True spender age</span><span className="v">{trueAge}d</span></div>
              <div className="proto-ctrl-row"><span className="k">Anonymity set</span><span className="v acc">16</span></div>
              <div className="proto-ctrl-row"><span className="k">P(guess)</span><span className="v">1/16 ≈ 6.25%</span></div>
            </div>
          </div>

          <div>
            <h6>Sampling procedure</h6>
            <ProtoStep n={1} done title="Sample 15 ages">From log-normal(1.7, 0.85). Most land in the last week.</ProtoStep>
            <ProtoStep n={2} done title="Resolve to UTXOs">Pick a random output that existed at each sampled age.</ProtoStep>
            <ProtoStep n={3} done title="Shuffle">Mix the real spender in among the 15. Order is uniform.</ProtoStep>
            <ProtoStep n={4} on title="Sign ring">CLSAG — one of the 16 keys produces a valid signature.</ProtoStep>
          </div>

          <div className="body" style={{ borderTop: "1px dashed var(--ink-10)", paddingTop: 12 }}>
            <em>Cracks in the wall:</em> heuristic analysis can sometimes shift probability away from 1/16 toward a smaller set (output-age outliers, multi-input pattern matching). FCMP++ retires this surface entirely — see <span style={{ color: "var(--p-50)" }}>F6 · FCMP++</span>.
          </div>
        </>
      }
    />
  );
}


