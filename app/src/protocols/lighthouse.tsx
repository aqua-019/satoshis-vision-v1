// protocols/lighthouse.tsx — HASHRATE · the lighthouse rotation.
//
// Roadmap metaphor (METAPHORS.md): a massive rotating lighthouse lamp whose
// sweep IS the hashrate. As difficulty adjusts, the lamp gets heavier or
// lighter, but the rotation speed — the perceived block time — is held constant
// at 2:00. "Difficulty tracks hashrate" without a single graph.
//
// Same chrome + animation idiom as the consensus/economics metaphors in
// metaphors.tsx: ProtoArtboard {stage, panel}, useTick for motion, a local
// usePrefersReducedMotion, and a live data-driven Stat grid.

import * as React from "react";
import { useTick } from "@/design/ArtBackground";
import { Stat } from "@/design/primitives";
import { ProtoArtboard } from "@/design/ProtoArtboard";
import type { MoneroLive } from "@/data/types";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

function LighthouseStage({ hashrate, difficulty }: { hashrate: number; difficulty: number }) {
  const live = useTick(60);
  const reduce = usePrefersReducedMotion();
  const tick = reduce ? 0 : live;

  const W = 1000;
  const H = 460;
  const cx = 500; // lamp centre x
  const cy = 120; // lamp centre y

  // Rotation period is HELD CONSTANT — difficulty/hashrate never change how fast
  // the beam sweeps (that is the whole point: perceived block time stays at 2:00).
  const angle = (tick * 2.2) % 360;

  // The lamp's "weight" (glow + size) tracks difficulty; its driving power
  // (beam reach + opacity) tracks hashrate. Both bounded for a stable visual.
  const diffG = difficulty / 1e9;
  const hashG = hashrate / 1e9;
  const lampR = 14 + Math.min(16, Math.log10(Math.max(diffG, 1)) * 6);
  const beamOpacity = 0.28 + Math.min(0.42, hashG / 10);
  const beamLen = 540 + Math.min(160, hashG * 12);
  const beamHalf = 64; // half-width of the cone at its far end

  const beamPts = `${cx},${cy} ${cx + beamLen},${cy - beamHalf} ${cx + beamLen},${cy + beamHalf}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      <defs>
        <linearGradient id="lhBeam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,210,130,0.95)" />
          <stop offset="45%" stopColor="rgba(255,170,70,0.35)" />
          <stop offset="100%" stopColor="rgba(255,140,40,0)" />
        </linearGradient>
        <radialGradient id="lhLamp">
          <stop offset="0%" stopColor="rgba(255,240,200,1)" />
          <stop offset="55%" stopColor="rgba(255,170,70,0.9)" />
          <stop offset="100%" stopColor="rgba(255,122,26,0)" />
        </radialGradient>
        <linearGradient id="lhTower" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2b1a0c" />
          <stop offset="100%" stopColor="#160d05" />
        </linearGradient>
      </defs>

      {/* sea / horizon */}
      <rect x="0" y="392" width={W} height={H - 392} fill="rgba(255,122,26,0.05)" />
      <line x1="0" y1="392" x2={W} y2="392" stroke="rgba(255,122,26,0.18)" strokeWidth="1" />

      {/* rotating beams — apex pinned at the lamp, the whole group spins at a
          CONSTANT rate. A faint back-beam 180° opposite for the classic sweep. */}
      <g transform={`rotate(${angle} ${cx} ${cy})`}>
        <polygon points={beamPts} fill="url(#lhBeam)" opacity={beamOpacity} />
      </g>
      <g transform={`rotate(${angle + 180} ${cx} ${cy})`}>
        <polygon points={beamPts} fill="url(#lhBeam)" opacity={beamOpacity * 0.5} />
      </g>

      {/* tower — tapered body */}
      <polygon points={`${cx - 26},150 ${cx + 26},150 ${cx + 40},392 ${cx - 40},392`} fill="url(#lhTower)" stroke="rgba(255,122,26,0.4)" strokeWidth="1" />
      {/* candy stripes */}
      {[200, 250, 300, 350].map((y, i) => (
        <rect key={i} x={cx - 30 - i * 3.5} y={y} width={60 + i * 7} height="14" fill="rgba(255,122,26,0.16)" />
      ))}
      {/* lamp room housing */}
      <rect x={cx - 34} y="92" width="68" height="58" fill="#1a1006" stroke="rgba(255,122,26,0.5)" strokeWidth="1" />
      <polygon points={`${cx - 40},92 ${cx + 40},92 ${cx},58`} fill="#1a1006" stroke="rgba(255,122,26,0.5)" strokeWidth="1" />

      {/* the lamp — glow scales with difficulty ("heavier / lighter") */}
      <circle cx={cx} cy={cy} r={lampR + 22} fill="url(#lhLamp)" opacity="0.7" />
      <circle cx={cx} cy={cy} r={lampR} fill="rgba(255,240,200,0.95)" style={{ filter: "drop-shadow(0 0 12px rgba(255,180,90,0.9))" }} />

      {/* labels */}
      <text x="40" y="44" fontFamily="var(--f-mono)" fontSize="11" fill="var(--tk-accent)" letterSpacing="0.16em">
        SWEEP = HASHRATE · {hashG.toFixed(2)} GH/s
      </text>
      <text x="40" y="64" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.12em">
        LAMP WEIGHT = DIFFICULTY · {diffG.toFixed(0)}G
      </text>
      <text x={cx} y="430" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="10" fill="var(--ink-60)" letterSpacing="0.06em">
        Hashrate rises, the lamp grows heavier — but the beam still sweeps once every 2:00.
      </text>
    </svg>
  );
}

export function LighthouseView({ data, bg }: ViewProps) {
  return (
    <ProtoArtboard
      label="M9 · Lighthouse"
      kicker="MONERO CONSENSUS · 14 · HASHRATE ROTATION"
      title='The beam sweeps at the same rhythm — <em>no matter the storm.</em>'
      sub="Hashrate is the spinning lamp; difficulty is its weight. As miners pour in, the difficulty adjustment makes the lamp heavier so the rotation — the perceived 2-minute block time — never changes pace."
      badges={[{ label: "Constant rhythm", tone: "acc" }, { label: "Per-block DAA", tone: "" }, { label: "Ready", tone: "ready" }]}
      bg={bg}
      stage={
        <>
          <LighthouseStage hashrate={data.hashrate} difficulty={data.difficulty} />
          <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <Stat k="HASHRATE NOW" v={(data.hashrate / 1e9).toFixed(2) + " GH/s"} sub="sweep power" tone="g" />
            <Stat k="DIFFICULTY" v={(data.difficulty / 1e9).toFixed(0) + "G"} sub="lamp weight" tone="acc" />
            <Stat k="SWEEP" v="120s / rev" sub="held constant" />
            <Stat k="HEIGHT" v={data.height.toLocaleString()} sub="revolutions" />
          </div>
        </>
      }
      panel={
        <>
          <h6>Sweep speed = hashrate</h6>
          <p className="lede">A lighthouse keepers can't see can still be timed by its beam. Monero times itself the same way.</p>
          <div className="body">
            The lamp spins because miners turn it — total <b>hashrate</b> is the force on the axle. If that force changes, the rotation would speed up or slow down… except Monero's difficulty adjustment fires <em>every block</em>, adding or shedding weight on the lamp to exactly cancel the change.
          </div>
          <h6 style={{ marginTop: 8 }}>Difficulty keeps the rhythm</h6>
          <div className="body">
            The result: the beam crosses the horizon once every <em>120 seconds</em>, whether the network is running at 2 GH/s or 4. Sailors (and wallets) can trust the cadence without ever reading a difficulty chart. <em>Difficulty tracks hashrate so block time doesn't have to.</em>
          </div>
        </>
      }
    />
  );
}
