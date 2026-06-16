// AUTO-PORTED from protocols/metaphors.jsx
import * as React from "react";
import { useTick, ArtBackground } from "@/design/ArtBackground";
import { Stat, Pill, PanelFrame, Sparkline, MiniBar, Crumbs, Card } from "@/design/primitives";
import { ProtoArtboard, ProtoStep, ProtoHeader } from "@/design/ProtoArtboard";
import { NavTop } from "@/layout/NavTop";
import { NetRail } from "@/layout/NetRail";
import { Footer } from "@/layout/Footer";
import { useMoneroLive } from "@/data/DataContext";
import { fmtN, fmtFee, fmtBytes, shortHash as ShortHash, randHex } from "@/data/types";
import { ParticleStream, SvgDefs } from "@/protocols/sim-fx";
import { POOLS, type Pool } from "@/protocols/pool-data";
import type { MoneroLive, Tx } from "@/data/types";

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

/* ════════════════════════════════════════════════════════════════
   1. ETERNAL HEARTH · tail emission · volumetric flame + particles
   ════════════════════════════════════════════════════════════════ */

function HearthStage() {
  const live = useTick(80);
  const reduce = usePrefersReducedMotion();
  const tick = reduce ? 80 : live;
  const ref = React.useRef(null);
  const t = tick % 200;
  const year = 1 + (t / 200) * 49;
  const subsidyShare = Math.max(0.01, 0.95 - Math.pow(year / 50, 0.42) * 0.94);
  const tailShare = 1 - subsidyShare;
  const W = 1080, H = 460;

  const logs = Array.from({ length: 4 }).map((_, i) => ({
    x: 200 + i * 60, base: 280, h: 90 - i * 8,
    burnt: Math.min(1, (year / 8) * (0.6 + i * 0.12)),
  }));

  // Multi-layer flame: 4 stacked elliptical glow layers with phase offset
  const flameLayers = 5;
  const baseFlameH = 130 * subsidyShare + 28;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", maxWidth: W, margin: "0 auto" }}>
      {/* Particle layer · embers floating up from hearth */}
      {!reduce && <ParticleStream
        width={W} height={H}
        count={Math.floor(60 + tailShare * 90)}
        color="rgba(255,178,90,0.95)"
        altColor="rgba(184,122,255,0.9)"
        altRatio={tailShare * 0.6}
        size={[0.8, 2.6]}
        speedMul={1.2}
        spread="bottom-up"
        gravity={-1.2}
        trail
        depth
      />}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ position: "relative", display: "block" }}>
        <SvgDefs />

        {/* depth-of-field background hearth stone */}
        <g filter="url(#fx-dof-far)" opacity="0.85">
          <rect x="118" y="78" width="504" height="284" fill="#0c0a08" stroke="rgba(255,122,26,0.1)" />
        </g>
        {/* hearth body — sharp foreground */}
        <rect x="140" y="100" width="460" height="240" fill="#050505" stroke="rgba(255,122,26,0.18)" strokeWidth="0.5" />
        <text x="148" y="92" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.16em">THE HEARTH · SECURITY BUDGET</text>

        {/* logs with rim light */}
        {logs.map((l, i) => (
          <g key={i}>
            <rect x={l.x} y={l.base - l.h * (1 - l.burnt * 0.95)} width="36" height={l.h * (1 - l.burnt * 0.95)}
              fill={l.burnt > 0.9 ? "#1a0f06" : "#3a2410"}
              stroke="rgba(255,170,70,0.45)" strokeWidth="0.8" />
            {/* glowing tip if still burning */}
            {l.burnt < 0.95 ? (
              <rect x={l.x + 2} y={l.base - l.h * (1 - l.burnt * 0.95)} width="32" height="3"
                fill="url(#fx-ember)" opacity="0.85" />
            ) : null}
            <ellipse cx={l.x + 18} cy={l.base} rx="18" ry="3" fill="#0a0604" />
          </g>
        ))}

        {/* MULTI-LAYER VOLUMETRIC FLAME */}
        {subsidyShare > 0.05 ? (
          <g filter="url(#fx-bloom-heavy)">
            {Array.from({ length: flameLayers }).map((_, layer) => {
              const scale = 1 - layer * 0.16;
              const phase = tick * 0.3 + layer * 0.8;
              const wobble = Math.sin(phase) * (4 - layer * 0.5);
              const h = baseFlameH * scale;
              return (
                <ellipse key={layer}
                  cx={370 + wobble}
                  cy={280 - h / 2}
                  rx={(54 + Math.sin(phase * 1.2) * 6) * scale}
                  ry={h / 2}
                  fill="url(#fx-flame-core)"
                  opacity={0.4 + layer * 0.1}
                />
              );
            })}
            {/* hot white core */}
            <ellipse cx={370 + Math.sin(tick * 0.4) * 2} cy={280 - baseFlameH / 3}
              rx={14} ry={baseFlameH / 3.5}
              fill="rgba(255,230,180,0.9)" />
          </g>
        ) : null}

        {/* ember bed glow */}
        <rect x="160" y="280" width="420" height="38" fill="url(#fx-ember)" opacity="0.35" />
        <rect x="160" y="280" width="420" height="38" fill="none" stroke="rgba(255,122,26,0.25)" strokeWidth="0.5" />

        {/* tail emission stream label (particles handle the visual) */}
        <g transform="translate(660, 200)">
          <text fontFamily="var(--f-mono)" fontSize="10" fill="var(--p-50)" letterSpacing="0.12em" filter="url(#fx-glow)">TAIL · 0.6 XMR</text>
          <text y="14" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.06em">forever · every block</text>
          {/* arrow into hearth */}
          <path d="M 0 30 Q -40 50 -90 30" fill="none" stroke="rgba(184,122,255,0.5)" strokeWidth="1" strokeDasharray="2 3" />
        </g>

        {/* year marker with depth */}
        <g transform="translate(870, 70)">
          <text fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.18em">YEAR</text>
          <text y="44" fontFamily="var(--f-mono)" fontSize="44" fill="var(--tk-accent)" filter="url(#fx-bloom)">
            {Math.floor(year)}
          </text>
          <text y="66" fontFamily="var(--f-mono)" fontSize="10" fill="var(--ink-60)">since fork (2014)</text>
        </g>

        {/* share bars with glow */}
        <g transform="translate(700, 320)">
          <text fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.18em">REWARD COMPOSITION</text>
          <rect y="14" width="180" height="10" fill="rgba(255,122,26,0.12)" />
          <rect y="14" width={180 * subsidyShare} height="10" fill="var(--tk-accent)" filter="url(#fx-glow)" />
          <text x="0" y="38" fontFamily="var(--f-mono)" fontSize="9" fill="var(--tk-accent)">SUBSIDY {(subsidyShare * 100).toFixed(0)}%</text>
          <rect y="50" width="180" height="10" fill="rgba(184,122,255,0.12)" />
          <rect y="50" width={180 * tailShare} height="10" fill="var(--p-50)" filter="url(#fx-glow)" />
          <text x="0" y="74" fontFamily="var(--f-mono)" fontSize="9" fill="var(--p-50)">TAIL {(tailShare * 100).toFixed(0)}%</text>
        </g>
      </svg>
    </div>
  );
}

export function HearthView({ data, bg }: ViewProps) {
  return (
    <ProtoArtboard
      label="M1 · Eternal Hearth"
      kicker="MONERO ECONOMICS · 07 · TAIL EMISSION"
      title='The <em>hearth</em> that refuses to go cold.'
      sub="Block subsidy burns down for ~8 years. Then the tail emission of 0.6 XMR per block keeps the embers glowing forever. There is no security-budget cliff."
      badges={[{ label: "Forever", tone: "priv" }, { label: "0.6 XMR / block", tone: "acc" }, { label: "Ready", tone: "ready" }]}
      bg={bg}
      stage={<><HearthStage />
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <Stat k="TAIL RATE" v="0.6" sub="XMR / block" tone="p" />
          <Stat k="TAIL APR" v="≈ 0.87%" sub="of supply" />
          <Stat k="BLOCK TIME" v="2 min" sub="constant" />
          <Stat k="EQUIVALENT" v="≈ 158K" sub="XMR / year" tone="acc" />
        </div>
      </>}
      panel={
        <>
          <h6>Why permanent emission</h6>
          <p className="lede">A coin without a security budget is a coin slowly turning into an honor system.</p>
          <div className="body">
            Bitcoin emission halves every four years and trends to zero by 2140. The security comes from miner fees — but fees only protect the chain when there's demand for blockspace. Quiet weeks erode the budget.<br /><br />
            Monero takes the opposite stance. The <b>tail emission</b> guarantees that a miner is always paid 0.6 XMR per block, regardless of fees. The hearth stays lit. The supply curve becomes asymptotically linear; inflation falls below 1% per year and keeps falling, but never reaches zero.<br /><br />
            <em>This is the only crypto economy that's been designed for the year 2200.</em>
          </div>
          <h6 style={{ marginTop: 8 }}>Pipeline</h6>
          <ProtoStep n={1} done title="Block subsidy ramps down">~9.0 → 0.6 over ~8 years per CryptoNote curve.</ProtoStep>
          <ProtoStep n={2} on   title="Tail kicks in">June 2022: subsidy reaches the floor.</ProtoStep>
          <ProtoStep n={3} title="Constant emission">Every block forever pays the miner 0.6 XMR.</ProtoStep>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════════════════════
   2. METRONOME · block target
   ════════════════════════════════════════════════════════════════ */

function MetronomeStage() {
  const live = useTick(60);
  const reduce = usePrefersReducedMotion();
  const tick = reduce ? 25 : live;
  const tCycle = (tick % 100) / 100;
  // sine swing — left at 0, right at 0.5, center at 0.25 and 0.75
  const swing = Math.sin(tCycle * Math.PI * 2);
  const angle = swing * 22;
  const W = 900, H = 460;

  // count ticks (blocks) generated
  const blocksGenerated = Math.floor(tick / 50);

  // BTC for comparison drops a block every 600s; show ratio
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      <defs>
        <linearGradient id="metroPedestal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2410" />
          <stop offset="100%" stopColor="#1a0f06" />
        </linearGradient>
        <radialGradient id="metroBlock">
          <stop offset="0%" stopColor="rgba(255,200,120,0.95)" />
          <stop offset="100%" stopColor="rgba(255,122,26,0.5)" />
        </radialGradient>
      </defs>

      {/* pedestal — wood metronome body */}
      <polygon points="350,360 540,360 510,150 380,150" fill="url(#metroPedestal)"
        stroke="rgba(255,122,26,0.35)" strokeWidth="1" />
      <rect x="365" y="170" width="160" height="20" fill="rgba(0,0,0,0.5)" />
      <text x="445" y="184" fontFamily="var(--f-mono)" fontSize="11" textAnchor="middle"
        fill="var(--tk-accent)" letterSpacing="0.14em">2:00</text>
      <text x="445" y="200" fontFamily="var(--f-mono)" fontSize="8" textAnchor="middle"
        fill="var(--ink-40)" letterSpacing="0.18em">BLOCK TARGET</text>

      {/* swinging arm + bob */}
      <g transform={`translate(445, 360) rotate(${angle})`}>
        <line x1="0" y1="0" x2="0" y2="-220" stroke="rgba(255,122,26,0.7)" strokeWidth="2" />
        <circle cx="0" cy="-200" r="9" fill="var(--tk-accent)"
          style={{ filter: "drop-shadow(0 0 6px var(--tk-accent))" }} />
        <line x1="-8" y1="-150" x2="8" y2="-150" stroke="rgba(255,200,120,0.8)" strokeWidth="3" />
      </g>

      {/* pivot */}
      <circle cx="445" cy="360" r="4" fill="#1a0f06" stroke="rgba(255,122,26,0.5)" />

      {/* block crystal — appears each tick */}
      <g transform="translate(700, 220)">
        <text fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.18em">BLOCKS GENERATED</text>
        <text y="40" fontFamily="var(--f-mono)" fontSize="38" fill="var(--tk-accent)"
          style={{ filter: "drop-shadow(0 0 5px var(--tk-accent))" }}>{blocksGenerated}</text>
        <rect y="60" width="50" height="60" fill="url(#metroBlock)"
          stroke="var(--tk-accent)" strokeWidth="1" rx="3" />
        <text x="25" y="98" fontFamily="var(--f-mono)" fontSize="10" textAnchor="middle"
          fill="#0e0805">#{blocksGenerated.toString().slice(-4)}</text>
      </g>

      {/* comparison — three metronomes' relative cadence */}
      <g transform="translate(80, 80)">
        <text fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.18em">CADENCE COMPARISON</text>
        {([
          { label: "MONERO · 2 min", w: 120, color: "var(--tk-accent)" },
          { label: "BITCOIN · 10 min", w: 24, color: "#f7931a" },
          { label: "ETHEREUM · 12 sec", w: 200 * 6, max: 200, color: "var(--c-50)" }, /* Ethereum dense — cap visually */
          { label: "SOLANA · 0.4 sec",  w: 200, color: "var(--p-50)" },
        ] as { label: string; w: number; max?: number; color: string }[]).map((m, i) => (
          <g key={i} transform={`translate(0, ${20 + i * 20})`}>
            <text x="0" y="9" fontFamily="var(--f-mono)" fontSize="9" fill={m.color}>{m.label}</text>
            <rect x="124" y="0" width={Math.min(m.w, m.max || 200)} height="10" fill={m.color} opacity="0.4" />
          </g>
        ))}
      </g>
    </svg>
  );
}

export function MetronomeView({ data, bg }: ViewProps) {
  return (
    <ProtoArtboard
      label="M2 · Metronome"
      kicker="MONERO PROTOCOL · 08 · BLOCK TARGET"
      title='Two minutes. <em>Forever.</em>'
      sub="Monero's block time is held at exactly 120 seconds by a difficulty adjustment that fires every block, not every two weeks. Predictable, undramatic, eternal."
      badges={[{ label: "120s target", tone: "acc" }, { label: "Per-block DAA", tone: "" }, { label: "Ready", tone: "ready" }]}
      bg={bg}
      stage={<><MetronomeStage />
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <Stat k="TARGET" v="120s" sub="block time" tone="acc" />
          <Stat k="DRIFT" v="±0.4s" sub="weekly mean" tone="g" />
          <Stat k="ADJUSTMENT" v="1 block" sub="cadence" />
          <Stat k="WINDOW" v="720" sub="block median" />
        </div>
      </>}
      panel={
        <>
          <h6>Per-block difficulty</h6>
          <p className="lede">Most chains adjust difficulty every 2,016 blocks. Monero adjusts every single one.</p>
          <div className="body">
            Bitcoin uses a two-week window — easy to predict, easy to manipulate near boundaries. Monero takes the median of the last <b>720 blocks</b> and recalculates difficulty every block, which means hashrate spikes or drops correct themselves in hours, not weeks.<br /><br />
            The metronome's swing speed never changes. As hashrate rises, the bob gets heavier (difficulty up). The cadence holds.
          </div>
          <h6 style={{ marginTop: 8 }}>Why 2 minutes</h6>
          <div className="body">
            Long enough that ring signatures, RingCT proofs, and large blocks have time to propagate over Tor and I2P. Short enough that confirmations feel responsive. <em>10 conf = 20 min</em>.
          </div>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════════════════════
   3. GRAIN SILO · monetary policy
   ════════════════════════════════════════════════════════════════ */

function SiloStage() {
  const live = useTick(80);
  const reduce = usePrefersReducedMotion();
  const tick = reduce ? 100 : live;
  const t = (tick % 400) / 400;       // 400-frame loop = full timeline
  const year = t * 200;               // 0 → 200 years

  // BTC: subsidy halves every 4 years, capped at 21M
  const btcSupply = Math.min(21, 21 * (1 - Math.exp(-year / 38)));
  const btcFaucetRate = year < 130 ? Math.exp(-year / 25) * 1.4 : 0;

  // XMR: subsidy curve flattens at ~18.4M then linear tail forever
  const xmrSubsidy = 18.4 * (1 - Math.exp(-year / 6));
  const xmrTail = year > 8 ? (year - 8) * 0.158 : 0;          // ~158K/year
  const xmrSupply = xmrSubsidy + xmrTail;
  const xmrFaucetRate = year < 8 ? Math.exp(-year / 3) * 4 : 0.32;

  const W = 1000, H = 460;

  const SiloViz = ({ x, supply, max, faucet, label, color, drip }: { x: number; supply: number; max: number; faucet: number; label: string; color: string; drip: number }) => (
    <g transform={`translate(${x}, 0)`}>
      <text x="80" y="20" fontFamily="var(--f-mono)" fontSize="10" textAnchor="middle"
        fill={color} letterSpacing="0.14em">{label}</text>
      {/* faucet */}
      <rect x="74" y="38" width="12" height="22" fill="#2a1810" />
      {faucet > 0.01 ? (
        Array.from({ length: Math.max(1, Math.floor(faucet * 4)) }).map((_, i) => (
          <circle key={i} cx="80" cy={64 + ((tick + i * 14 + drip) % 80)} r="2.2"
            fill={color} style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
        ))
      ) : (
        <text x="80" y="80" fontFamily="var(--f-mono)" fontSize="8" textAnchor="middle"
          fill="var(--ink-40)">[shut]</text>
      )}
      {/* silo body */}
      <rect x="22" y="160" width="116" height="220" fill="rgba(0,0,0,0.5)"
        stroke={color} strokeWidth="1" />
      {/* fill */}
      <rect x="24" y={380 - (supply / max) * 218} width="112" height={(supply / max) * 218}
        fill={color} opacity="0.35" />
      <line x1="24" y1={380 - (supply / max) * 218} x2="136" y2={380 - (supply / max) * 218}
        stroke={color} strokeWidth="1.5" />
      <text x="80" y="396" fontFamily="var(--f-mono)" fontSize="11" textAnchor="middle"
        fill={color}>{supply.toFixed(2)}M</text>
      <text x="80" y="410" fontFamily="var(--f-mono)" fontSize="8.5" textAnchor="middle"
        fill="var(--ink-40)">/ {max}M cap</text>
    </g>
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      <SiloViz x={120} supply={btcSupply} max={21} faucet={btcFaucetRate} label="BITCOIN" color="#f7931a" drip={0} />
      <SiloViz x={420} supply={xmrSupply} max={50} faucet={xmrFaucetRate} label="MONERO" color="var(--tk-accent)" drip={40} />

      {/* year marker */}
      <g transform="translate(740, 80)">
        <text fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.18em">YEAR</text>
        <text y="40" fontFamily="var(--f-mono)" fontSize="44" fill="var(--tk-accent)"
          style={{ filter: "drop-shadow(0 0 4px var(--tk-accent))" }}>{Math.floor(year)}</text>
        <text y="62" fontFamily="var(--f-mono)" fontSize="10" fill="var(--ink-60)">since launch</text>
        <text y="100" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.14em">BTC INFL</text>
        <text y="118" fontFamily="var(--f-mono)" fontSize="14" fill="#f7931a">{(btcFaucetRate * 100).toFixed(2)}%</text>
        <text y="146" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.14em">XMR INFL</text>
        <text y="164" fontFamily="var(--f-mono)" fontSize="14" fill="var(--tk-accent)">{(xmrFaucetRate * 100 / 100).toFixed(2)}%</text>
        <text y="200" fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-40)" letterSpacing="0.06em">
          {year > 130 ? "BTC faucet closed forever" : year > 8 ? "XMR tail = constant" : "both faucets pouring"}
        </text>
      </g>
    </svg>
  );
}

export function SiloView({ data, bg }: ViewProps) {
  return (
    <ProtoArtboard
      label="M3 · Grain Silo"
      kicker="MONERO ECONOMICS · 09 · MONETARY POLICY"
      title='Two silos. One stops pouring. <em>One never does.</em>'
      sub="Bitcoin's faucet halves every four years and shuts off by 2140. Monero's faucet ramps down for ~8 years and then settles at a permanent trickle of 0.6 XMR per block."
      badges={[{ label: "BTC: hard cap 21M", tone: "" }, { label: "XMR: linear tail", tone: "acc" }, { label: "Ready", tone: "ready" }]}
      bg={bg}
      stage={<><SiloStage />
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <Stat k="XMR SUPPLY (now)" v="~18.4M" sub="+0.6 / block" tone="acc" />
          <Stat k="BTC SUPPLY (now)" v="~19.7M" sub="approaching 21M" />
          <Stat k="XMR LIMIT" v="—" sub="asymptotic" tone="p" />
          <Stat k="BTC LIMIT" v="21M" sub="hard cap" />
        </div>
      </>}
      panel={
        <>
          <h6>The honest cliff</h6>
          <p className="lede">Sound money is not the same as zero-emission money.</p>
          <div className="body">
            Bitcoin's "hard cap" is also its security cliff. When the subsidy goes to zero, miner revenue depends entirely on fees. If fees can't fund proof-of-work in 2140, the chain inherits the security of whoever pays them.<br /><br />
            Monero accepts a small <em>perpetual</em> dilution as the price of a perpetually-paid miner. The two silos look almost identical for the first decade. They diverge for the next two centuries.<br /><br />
            <b className="acc">"You cannot eat a hard cap."</b> — Fluffypony, defending the tail at the 2017 fork.
          </div>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════════════════════
   4. THERMOSTAT · difficulty adjustment
   ════════════════════════════════════════════════════════════════ */

function ThermostatStage() {
  const live = useTick(60);
  const reduce = usePrefersReducedMotion();
  const tick = reduce ? 0 : live;
  // Hashrate "ambient temperature" oscillates
  const hashrate = 6.5 + Math.sin(tick * 0.04) * 0.6 + Math.sin(tick * 0.015) * 0.3;
  const difficulty = hashrate * 119.5;     // tracks closely, lag ~1 block
  const W = 900, H = 460;

  const dial = (cx: number, cy: number, label: string, val: number, units: string, color: string, range: [number, number], animLag?: boolean) => {
    const min = range[0], max = range[1];
    const pct = Math.max(0, Math.min(1, (val - min) / (max - min)));
    const angle = -135 + pct * 270;
    const rad = (angle * Math.PI) / 180;
    const r = 80;
    return (
      <g transform={`translate(${cx}, ${cy})`}>
        {/* outer ring */}
        <circle r={r + 14} fill="none" stroke="rgba(255,122,26,0.08)" strokeWidth="1" />
        {/* arc */}
        <path d={`M ${Math.cos((-135 * Math.PI) / 180) * r} ${Math.sin((-135 * Math.PI) / 180) * r}
                  A ${r} ${r} 0 1 1 ${Math.cos((135 * Math.PI) / 180) * r} ${Math.sin((135 * Math.PI) / 180) * r}`}
          fill="none" stroke="rgba(255,122,26,0.12)" strokeWidth="4" />
        {/* progress */}
        <path d={`M ${Math.cos((-135 * Math.PI) / 180) * r} ${Math.sin((-135 * Math.PI) / 180) * r}
                  A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${Math.cos(rad) * r} ${Math.sin(rad) * r}`}
          fill="none" stroke={color} strokeWidth="4" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
        {/* needle */}
        <line x1="0" y1="0" x2={Math.cos(rad) * (r - 6)} y2={Math.sin(rad) * (r - 6)}
          stroke={color} strokeWidth="2.5" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        <circle r="4" fill={color} />
        {/* labels */}
        <text y="-100" fontFamily="var(--f-mono)" fontSize="9" textAnchor="middle"
          fill="var(--ink-40)" letterSpacing="0.16em">{label}</text>
        <text y="106" fontFamily="var(--f-mono)" fontSize="22" textAnchor="middle"
          fill={color}>{val.toFixed(2)}{units}</text>
        <text y="124" fontFamily="var(--f-mono)" fontSize="9" textAnchor="middle"
          fill="var(--ink-40)">
          {animLag ? "tracking · " : ""}
          {min}…{max}
        </text>
      </g>
    );
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      {dial(220, 220, "AMBIENT · HASHRATE", hashrate, " GH/s", "#5ed3f4", [5.5, 7.5])}
      {dial(450, 220, "THERMOSTAT · DIFFICULTY", difficulty, "G", "var(--tk-accent)", [650, 900], true)}
      {dial(680, 220, "ROOM TEMP · BLOCK TIME", 120 + Math.sin(tick * 0.04 + 0.1) * 2, "s", "var(--g-50)", [110, 130])}

      {/* arrow chain */}
      <text x="335" y="225" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="18" fill="var(--ink-40)">→</text>
      <text x="335" y="244" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.14em">adjusts</text>
      <text x="565" y="225" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="18" fill="var(--ink-40)">→</text>
      <text x="565" y="244" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.14em">keeps stable</text>

      {/* explanation */}
      <text x="450" y="400" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="10" fill="var(--ink-60)" letterSpacing="0.06em">
        Hashrate drifts. Difficulty chases it every block. Block time stays at 2:00.
      </text>
    </svg>
  );
}

export function ThermostatView({ data, bg }: ViewProps) {
  return (
    <ProtoArtboard
      label="M4 · Thermostat"
      kicker="MONERO PROTOCOL · 10 · DIFFICULTY ADJUSTMENT"
      title='The chain runs hotter, the <em>thermostat</em> turns down.'
      sub="Difficulty isn't a setpoint — it's a feedback loop. The 720-block sliding median chases hashrate every single block so room temperature (block time) holds at 2:00."
      badges={[{ label: "720-block window", tone: "acc" }, { label: "Tracks every block", tone: "" }, { label: "Ready", tone: "ready" }]}
      bg={bg}
      stage={<><ThermostatStage />
        <div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <Stat k="HASHRATE NOW" v={(data.hashrate / 1e9).toFixed(2) + " GH/s"} sub="ambient" tone="g" />
          <Stat k="DIFFICULTY" v={(data.difficulty / 1e9).toFixed(0) + "G"} sub="setpoint" tone="acc" />
          <Stat k="BLOCK TIME" v="120s" sub="±0.4 weekly" tone="g" />
          <Stat k="LAG" v="≈ 1 blk" sub="median window" />
        </div>
      </>}
      panel={
        <>
          <h6>How fast it learns</h6>
          <p className="lede">If hashrate doubles, difficulty doubles within an hour — not two weeks.</p>
          <div className="body">
            The DAA (Difficulty Adjustment Algorithm) takes the 720-block sliding window, trims outliers, takes the median, and computes the next block's difficulty target. <em>Every</em> block.<br /><br />
            That tight loop is why ASIC attacks on Monero have failed: by the time a miner pivots, the difficulty has already absorbed them. The block time barely flinches.
          </div>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════════════════════
   5. BIDDING AUCTION · mempool fees
   ════════════════════════════════════════════════════════════════ */

function AuctionStage({ mempool, height }: { mempool: Tx[]; height: number }) {
  const live = useTick(80);
  const reduce = usePrefersReducedMotion();
  const tick = reduce ? 0 : live;
  const slots = 80;          // seats per block (approx)
  // sort mempool by perB desc
  const sorted = [...mempool].sort((a, b) => b.perB - a.perB).slice(0, 120);
  const blockNum = Math.floor(tick / 80);

  // Each tx → a paddle. Show ~24 paddles, the top 8 highlighted as "seated".
  const visible = sorted.slice(0, 24);

  const W = 1000, H = 460;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      {/* podium */}
      <rect x="40" y="60" width="920" height="60" fill="rgba(0,0,0,0.55)" stroke="rgba(255,122,26,0.18)" />
      <text x="60" y="84" fontFamily="var(--f-mono)" fontSize="10" fill="var(--tk-accent)" letterSpacing="0.18em">BLOCK #{(height || 3676070) + blockNum}</text>
      <text x="60" y="104" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.14em">
        ACCEPTING TOP {slots} PADDLES · 2:00 UNTIL HAMMER ↓ ·
        <tspan fill="var(--y-50)" letterSpacing="0.14em"> {((100 - ((tick % 80) / 80) * 100) | 0)}%</tspan>
      </text>

      {/* auction hall floor */}
      {visible.map((t, i) => {
        const cols = 12;
        const x = 70 + (i % cols) * 75;
        const y = 170 + Math.floor(i / cols) * 110;
        const isSeated = i < 8;
        const fee = t.fee;
        const wave = Math.sin((tick + i * 7) * 0.1) * 4;
        return (
          <g key={i} transform={`translate(${x}, ${y + (isSeated ? 0 : wave)})`}>
            {/* paddle stick */}
            <rect x="20" y="46" width="3" height="40" fill={isSeated ? "var(--tk-accent)" : "var(--ink-20)"} />
            {/* paddle head */}
            <rect x="0" y="0" width="44" height="52"
              fill={isSeated ? "rgba(255,122,26,0.32)" : "rgba(255,255,255,0.04)"}
              stroke={isSeated ? "var(--tk-accent)" : "var(--ink-20)"}
              strokeWidth="1"
              style={isSeated ? { filter: "drop-shadow(0 0 5px rgba(255,122,26,0.5))" } : undefined} />
            <text x="22" y="22" fontFamily="var(--f-mono)" fontSize="8" textAnchor="middle"
              fill={isSeated ? "var(--tk-accent)" : "var(--ink-40)"}>FEE</text>
            <text x="22" y="38" fontFamily="var(--f-mono)" fontSize="10" textAnchor="middle"
              fill={isSeated ? "#fff1e0" : "var(--ink-60)"}>{(t.perB / 1000).toFixed(1)}</text>
            <text x="22" y="48" fontFamily="var(--f-mono)" fontSize="7" textAnchor="middle"
              fill={isSeated ? "var(--ink-80)" : "var(--ink-40)"}>k/B</text>
          </g>
        );
      })}

      {/* legend */}
      <g transform="translate(40, 410)">
        <rect x="0" y="0" width="14" height="14" fill="rgba(255,122,26,0.32)" stroke="var(--tk-accent)" />
        <text x="20" y="11" fontFamily="var(--f-mono)" fontSize="9" fill="var(--tk-accent)">SEATED · paid the price</text>
        <rect x="220" y="0" width="14" height="14" fill="rgba(255,255,255,0.04)" stroke="var(--ink-20)" />
        <text x="240" y="11" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-60)">RETURNED TO ROOM · waits for next block</text>
      </g>
    </svg>
  );
}

export function AuctionView({ data, bg }: ViewProps) {
  return (
    <ProtoArtboard
      label="M5 · Bidding Auction"
      kicker="MONERO ECONOMICS · 11 · FEE MARKET"
      title='Two minutes. <em>Highest paddles get a seat.</em>'
      sub="Every 120 seconds the auction hammer drops. The top ~80 paddles by fee rate are seated in the next block. The rest return to the room and bid again."
      badges={[{ label: "Per-byte auction", tone: "acc" }, { label: "Median guarantees", tone: "" }, { label: "Ready", tone: "ready" }]}
      bg={bg}
      stage={<><AuctionStage mempool={data.mempool} height={data.height} />
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <Stat k="MEMPOOL DEPTH" v={data.mempool.length + " tx"} sub="bidding now" />
          <Stat k="SEATS / BLOCK" v="≈ 80" sub="at median size" tone="acc" />
          <Stat k="MEDIAN FEE" v="~0.5K" sub="piconero / B" />
          <Stat k="TOP FEE" v="~1.0K" sub="piconero / B" tone="acc" />
        </div>
      </>}
      panel={
        <>
          <h6>How the auction stays cheap</h6>
          <p className="lede">When the room is half-empty, the floor price drops to the mandatory minimum.</p>
          <div className="body">
            Bitcoin's fee market gets <em>brutal</em> under congestion — paddles bid each other into orbit. Monero's design dampens this with a <b>median block size</b> mechanism: blocks can grow when demand grows, so paddles rarely have to bid against each other.<br /><br />
            The result is the median Monero fee is ~$0.005 — about ten thousand times cheaper than Bitcoin during a mempool storm.
          </div>
          <h6 style={{ marginTop: 8 }}>The hammer</h6>
          <div className="body">
            Every 120s, miner runs the auction. Highest paddles win. Pays in coinbase + sum of seated fees. <em>Repeat forever.</em>
          </div>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════════════════════
   6. CITY SKYLINE · pool decentralization
   ════════════════════════════════════════════════════════════════ */

function SkylineStage({ poolDist }: { poolDist: Pool[] }) {
  const live = useTick(120);
  const reduce = usePrefersReducedMotion();
  const tick = reduce ? 0 : live;
  const sky = poolDist
    .filter(p => p.name !== "Solo / Unknown")
    .sort((a, b) => b.share - a.share);

  // HHI (Herfindahl-Hirschman Index) = Σ (share*100)² → 0-10000
  const hhi = poolDist.reduce((acc, p) => acc + Math.pow(p.share * 100, 2), 0);
  const hhiColor = hhi < 1500 ? "var(--g-50)" : hhi < 2500 ? "var(--y-50)" : "var(--r-50)";
  const hhiLabel = hhi < 1500 ? "DECENTRALIZED" : hhi < 2500 ? "MODERATE" : "CONCENTRATED";

  const W = 1000, H = 460;
  const baseY = 380;
  const maxBldHeight = 240;
  const buildingW = 56;
  const gap = 8;
  const startX = 80;

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: W, margin: "0 auto" }}>
      {/* Atmospheric particles — fog + sparks rising from city */}
      {!reduce && <ParticleStream
        width={W} height={H}
        count={100}
        color="rgba(255,178,90,0.6)"
        altColor="rgba(74,222,128,0.6)"
        altRatio={0.32}
        size={[0.6, 1.6]}
        speedMul={0.5}
        spread="bottom-up"
        gravity={-0.3}
        trail
        depth
      />}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ position: "relative", display: "block" }}>
        <SvgDefs />
        {/* deep sky gradient */}
        <defs>
          <linearGradient id="cityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(20,15,8,0)" />
            <stop offset="100%" stopColor="rgba(20,15,8,0.6)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill="url(#cityGrad)" opacity="0.5" />

        {/* horizon */}
        <line x1="0" y1={baseY} x2={W} y2={baseY} stroke="rgba(255,122,26,0.25)" />
        {/* stars in sky */}
        {Array.from({ length: 28 }).map((_, i) => {
          const x = (i * 37 + tick * 0.4) % W;
          const y = 30 + (i * 11) % 100;
          return <circle key={i} cx={x} cy={y} r="0.8" fill="rgba(255,255,255,0.4)" />;
        })}

        {/* BACKGROUND silhouette layer (parallax depth) */}
        <g opacity="0.35" filter="url(#fx-dof-far)">
          {sky.map((p, i) => {
            const h = (p.share / 0.4) * maxBldHeight + 30;
            const x = startX + i * (buildingW + gap) + 30;
            return (
              <rect key={"bg-" + p.name} x={x} y={baseY - h * 0.7} width={buildingW * 1.3} height={h * 0.7}
                fill="rgba(0,0,0,0.5)" />
            );
          })}
        </g>

        {sky.map((p, i) => {
          const h = (p.share / 0.4) * maxBldHeight + 30;
          const x = startX + i * (buildingW + gap);
          const dec = p.type === "decentralized";
          return (
            <g key={p.name}>
              {/* building bloom halo */}
              <rect x={x - 4} y={baseY - h - 4} width={buildingW + 8} height={h + 4}
                fill={dec ? "rgba(74,222,128,0.18)" : "rgba(255,77,109,0.16)"}
                filter="url(#fx-bloom)" />
              <rect x={x} y={baseY - h} width={buildingW} height={h}
                fill={dec ? "rgba(74,222,128,0.35)" : "rgba(255,77,109,0.32)"}
                stroke={dec ? "var(--g-50)" : "var(--r-50)"}
                strokeWidth="1" />
              {/* windows with sparkling phase */}
              {Array.from({ length: Math.floor(h / 14) }).map((_, wi) => (
                <rect key={wi} x={x + 6 + (wi % 3) * 14} y={baseY - h + 8 + Math.floor(wi / 3) * 14}
                  width="6" height="6"
                  fill={Math.sin(tick * 0.05 + i + wi) > 0.4 ? (dec ? "var(--g-50)" : "var(--r-50)") : "rgba(0,0,0,0.4)"}
                  opacity="0.65" />
              ))}
              {/* light shaft rising from building */}
              <rect x={x + buildingW / 2 - 2} y={baseY - h - 60} width="4" height="60"
                fill={dec ? "url(#fx-orb-cyan)" : "url(#fx-flame-core)"} opacity="0.2" />
              {/* label */}
              <text x={x + buildingW / 2} y={baseY + 16} fontFamily="var(--f-mono)" fontSize="9"
                textAnchor="middle" fill={dec ? "var(--g-50)" : "var(--r-50)"} letterSpacing="0.04em">
                {p.name.slice(0, 8)}
              </text>
              <text x={x + buildingW / 2} y={baseY + 28} fontFamily="var(--f-mono)" fontSize="9"
                textAnchor="middle" fill="var(--ink-60)">
                {(p.share * 100).toFixed(0)}%
              </text>
              {/* cathedral spire for P2Pool with extra glow */}
              {p.name === "P2Pool" ? (
                <g filter="url(#fx-bloom-heavy)">
                  <polygon points={`${x + buildingW / 2 - 6},${baseY - h - 14} ${x + buildingW / 2},${baseY - h - 28} ${x + buildingW / 2 + 6},${baseY - h - 14}`}
                    fill="var(--g-50)" />
                </g>
              ) : null}
            </g>
          );
        })}

        {/* HHI gauge */}
        <g transform="translate(740, 60)">
          <text fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.18em">HHI · CONCENTRATION</text>
          <rect x="0" y="14" width="220" height="10" fill="rgba(0,0,0,0.5)" stroke="var(--ink-20)" />
          <rect x="0" y="14" width={Math.min(220, (hhi / 5000) * 220)} height="10" fill={hhiColor}
            filter="url(#fx-glow)" />
          <line x1={(1500 / 5000) * 220} y1="14" x2={(1500 / 5000) * 220} y2="24" stroke="rgba(255,255,255,0.3)" />
          <text x={(1500 / 5000) * 220} y="36" fontFamily="var(--f-mono)" fontSize="8" textAnchor="middle"
            fill="var(--ink-40)">1.5K</text>
          <line x1={(2500 / 5000) * 220} y1="14" x2={(2500 / 5000) * 220} y2="24" stroke="rgba(255,255,255,0.3)" />
          <text x={(2500 / 5000) * 220} y="36" fontFamily="var(--f-mono)" fontSize="8" textAnchor="middle"
            fill="var(--ink-40)">2.5K</text>
          <text x="0" y="60" fontFamily="var(--f-mono)" fontSize="24" fill={hhiColor} filter="url(#fx-bloom)">{Math.round(hhi).toLocaleString()}</text>
          <text x="0" y="80" fontFamily="var(--f-mono)" fontSize="10" fill={hhiColor} letterSpacing="0.16em">{hhiLabel}</text>
        </g>
      </svg>
    </div>
  );
}

export function SkylineView({ data, bg }: ViewProps) {
  return (
    <ProtoArtboard
      label="M6 · Skyline"
      kicker="MONERO PROTOCOL · 12 · POOL DECENTRALIZATION"
      title='A skyline of <em>mining pools</em>. The cathedral is the goal.'
      sub="Each pool is a building, height = hashrate share. Tall red towers are centralized custodial pools. The cathedral is P2Pool — decentralized, no fee, no operator. Pool shares here are illustrative: Monero coinbases don't tag pools, so distribution can't be measured on-chain."
      badges={[{ label: "P2Pool ↑", tone: "ready" }, { label: "HHI · illustrative", tone: "" }, { label: "Educational", tone: "ready" }]}
      bg={bg}
      stage={<><SkylineStage poolDist={POOLS} />
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <Stat k="POOLS TRACKED" v={POOLS.length} sub="illustrative" />
          <Stat k="P2POOL SHARE" v={((POOLS.find(p => p.name === "P2Pool")?.share ?? 0) * 100).toFixed(1) + "%"} sub="decentralized" tone="g" />
          <Stat k="TOP-3 SHARE" v={Math.round([...POOLS].sort((a,b)=>b.share-a.share).slice(0,3).reduce((a,p)=>a+p.share*100,0)) + "%"} sub="centralized" tone="dn" />
          <Stat k="HHI" v={Math.round(POOLS.reduce((a, p) => a + Math.pow(p.share * 100, 2), 0)).toLocaleString()} sub="concentration" tone="acc" />
        </div>
      </>}
      panel={
        <>
          <h6>What HHI means</h6>
          <p className="lede">The Herfindahl-Hirschman Index measures market concentration. Sub-1,500 is competitive; over 2,500 is concentrated.</p>
          <div className="body">
            Monero's skyline rotates over months. A pool dominates, miners migrate, a competitor rises. P2Pool sits at the center because it's the one structure that doesn't compete — it lets thousands of solo miners pool their hashes without giving up custody.<br /><br />
            <b className="acc">Goal:</b> P2Pool over 50%. <b className="dn">Risk:</b> any single pool over 33%.<br /><br />
            <span className="dim">The per-pool shares shown are illustrative, not live measurement: Monero coinbase transactions don't identify the mining pool, and this site queries no third-party pool API, so on-chain pool distribution is unknowable.</span>
          </div>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════════════════════
   7. BLOODHOUND · privacy attacks
   ════════════════════════════════════════════════════════════════ */

function BloodhoundStage() {
  const live = useTick(60);
  const reduce = usePrefersReducedMotion();
  const tick = reduce ? 200 : live;
  const stage = Math.floor((tick % 240) / 40);
  const W = 1000, H = 460;
  const stations = [
    { x: 160, label: "RING SIGS",      defeat: "15 false trails" },
    { x: 300, label: "STEALTH",        defeat: "no recurring scent" },
    { x: 440, label: "RINGCT",         defeat: "amounts erased" },
    { x: 580, label: "DANDELION++",    defeat: "false origin" },
    { x: 720, label: "VIEW TAGS",      defeat: "scent unrelated" },
    { x: 860, label: "FCMP++",         defeat: "forest smells same" },
  ];
  const houndX = 80 + Math.min(stage + 1, stations.length) * 130 + Math.sin(tick * 0.1) * 4;

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: W, margin: "0 auto" }}>
      {/* Forest mist particles + spore haze */}
      {!reduce && <ParticleStream
        width={W} height={H}
        count={120}
        color="rgba(184,122,255,0.7)"
        altColor="rgba(255,178,90,0.5)"
        altRatio={0.25}
        size={[0.5, 1.4]}
        speedMul={0.4}
        spread="rect"
        gravity={0}
        trail
        depth
      />}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ position: "relative", display: "block" }}>
        <SvgDefs />

        {/* layered forest depth — background trees */}
        <g opacity="0.25" filter="url(#fx-dof-far)">
          {Array.from({ length: 18 }).map((_, i) => {
            const x = i * 60 + Math.sin(i * 7) * 12;
            const h = 100 + (i % 5) * 40;
            return <rect key={"bg-" + i} x={x} y={H - h - 50} width="3" height={h}
              fill="rgba(184,122,255,0.5)" />;
          })}
        </g>
        <g opacity="0.4">
          {Array.from({ length: 14 }).map((_, i) => {
            const x = 30 + i * 75 + Math.sin(i * 11) * 16;
            const h = 130 + (i % 4) * 50;
            return <g key={"mid-" + i}>
              <rect x={x} y={H - h - 40} width="4" height={h} fill="rgba(184,122,255,0.7)" />
              <ellipse cx={x + 2} cy={H - h - 40} rx="22" ry="16" fill="rgba(184,122,255,0.18)" />
            </g>;
          })}
        </g>

        {/* ground with subtle gradient */}
        <line x1="0" y1="320" x2={W} y2="320" stroke="rgba(255,122,26,0.18)" strokeDasharray="3 4" />
        <rect x="0" y="320" width={W} height={H - 320} fill="rgba(184,122,255,0.04)" />
        <text x="20" y="340" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.16em">TRAIL ↓</text>

        {/* stations — gates */}
        {stations.map((s, i) => {
          const passed = i < stage;
          return (
            <g key={i} transform={`translate(${s.x}, 200)`}>
              <rect x="-12" y="0" width="4" height="120" fill={passed ? "rgba(184,122,255,0.5)" : "var(--ink-20)"}
                filter={passed ? "url(#fx-glow)" : undefined} />
              <rect x="8"   y="0" width="4" height="120" fill={passed ? "rgba(184,122,255,0.5)" : "var(--ink-20)"}
                filter={passed ? "url(#fx-glow)" : undefined} />
              <line x1="-14" y1="0" x2="14" y2="0" stroke={passed ? "var(--p-50)" : "var(--ink-20)"} strokeWidth="2"
                filter={passed ? "url(#fx-glow)" : undefined} />
              {passed ? <circle cx="0" cy="60" r="32" fill="url(#fx-orb-purple)" opacity="0.18" /> : null}
              <text x="0" y="-12" fontFamily="var(--f-mono)" fontSize="9" textAnchor="middle"
                fill={passed ? "var(--p-50)" : "var(--ink-60)"} letterSpacing="0.06em">{s.label}</text>
              {passed ? (
                <text x="0" y="142" fontFamily="var(--f-mono)" fontSize="8.5" textAnchor="middle"
                  fill="var(--p-50)" letterSpacing="0.02em">{s.defeat}</text>
              ) : null}
            </g>
          );
        })}

        {/* bloodhound — slightly more detailed */}
        <g transform={`translate(${houndX}, 286)`}>
          {/* halo */}
          <ellipse cx="0" cy="0" rx="40" ry="22" fill="url(#fx-orb-purple)" opacity="0.2" />
          <ellipse cx="0" cy="0" rx="22" ry="10" fill="rgba(184,122,255,0.18)" />
          <ellipse cx="0" cy="0" rx="22" ry="10" fill="none" stroke="var(--p-50)" strokeWidth="1" />
          <circle cx="22" cy="-6" r="6" fill="rgba(184,122,255,0.3)" stroke="var(--p-50)" strokeWidth="1" />
          <circle cx="24" cy="-8" r="1.5" fill="var(--p-50)" filter="url(#fx-glow)" />
          <line x1="-22" y1="0" x2="-30" y2="-6" stroke="var(--p-50)" strokeWidth="1.5" />
          <line x1="-10" y1="10" x2="-10" y2="18" stroke="var(--p-50)" strokeWidth="1.2" />
          <line x1="0"   y1="10" x2="0"   y2="18" stroke="var(--p-50)" strokeWidth="1.2" />
          <line x1="10"  y1="10" x2="10"  y2="18" stroke="var(--p-50)" strokeWidth="1.2" />
          <text x="36" y="-12" fontFamily="var(--f-mono)" fontSize="14" fill="var(--p-50)" filter="url(#fx-glow)">?</text>
          <text x="32" y="-22" fontFamily="var(--f-mono)" fontSize="10" fill="var(--p-50)" opacity="0.6">?</text>
          <text x="0" y="40" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9"
            fill="var(--p-50)" letterSpacing="0.1em">CHAINALYSIS</text>
        </g>

        {/* fading trail */}
        <g>
          {Array.from({ length: 14 }).map((_, i) => {
            const x = 60 + i * 60;
            const stageAlpha = Math.max(0, 1 - Math.abs(stage * 2 - i) / 3);
            return (
              <circle key={i} cx={x} cy="324" r="2.4"
                fill="var(--p-50)" opacity={stageAlpha * 0.7}
                filter={stageAlpha > 0.5 ? "url(#fx-glow)" : undefined} />
            );
          })}
        </g>

        <text x={W / 2} y={400} fontFamily="var(--f-mono)" fontSize="10" textAnchor="middle"
          fill="var(--ink-60)" letterSpacing="0.06em">
          Each station erases one dimension of the trail. By station 6 there's nothing left to chase.
        </text>
      </svg>
    </div>
  );
}

export function BloodhoundView({ data, bg }: ViewProps) {
  return (
    <ProtoArtboard
      label="M7 · Bloodhound"
      kicker="MONERO ATTACKS · 13 · PRIVACY DEFENSE"
      title='Six stations. The <em>bloodhound</em> loses the scent at every one.'
      sub="Chainalysis. CipherTrace. Integra Labs. They follow the trail until they hit a Monero privacy primitive — and the scent is gone. After ten years and $1.25M in bounties, the hound is still confused."
      badges={[{ label: "$1.25M failed", tone: "priv" }, { label: "10 yrs holding", tone: "" }, { label: "Ready", tone: "ready" }]}
      bg={bg}
      stage={<><BloodhoundStage />
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <Stat k="ACTIVE ATTACKERS" v="3+" sub="known bounties" tone="dn" />
          <Stat k="SUCCESS RATE" v="0%" sub="reported" tone="g" />
          <Stat k="LARGEST BOUNTY" v="$625K" sub="2020 · IRS" tone="acc" />
          <Stat k="YEARS HOLDING" v="10+" sub="since 2014" tone="p" />
        </div>
      </>}
      panel={
        <>
          <h6>The bounties that didn't work</h6>
          <p className="lede">Every privacy primitive masks one dimension of the trail. None of them can be defeated independently.</p>
          <div className="body">
            <b style={{ color: "var(--p-50)" }}>Ring signatures</b> hide which input was spent. <b style={{ color: "var(--p-50)" }}>Stealth addresses</b> hide who received. <b style={{ color: "var(--p-50)" }}>RingCT</b> hides how much. <b style={{ color: "var(--p-50)" }}>Dandelion++</b> hides where it came from. <b style={{ color: "var(--p-50)" }}>View tags</b> hide who's scanning. <b style={{ color: "var(--p-50)" }}>FCMP++</b> hides everything in a sea of 150M+ outputs.<br /><br />
            Each layer alone could be broken with effort. Together, they create a problem that's <em>statistically intractable</em>. The bloodhound is good — Monero is, by construction, scentless.
          </div>
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════════════════════
   8. BALANCE · confidential amounts
   ════════════════════════════════════════════════════════════════ */

function BalanceStage() {
  const live = useTick(80);
  const reduce = usePrefersReducedMotion();
  const tick = reduce ? 0 : live;
  const lean = Math.sin(tick * 0.08) * 6;
  const W = 900, H = 460;

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: W, margin: "0 auto" }}>
      {/* Crypto-particle field: signed commitments drifting */}
      {!reduce && <ParticleStream
        width={W} height={H}
        count={70}
        color="rgba(255,178,90,0.6)"
        altColor="rgba(184,122,255,0.7)"
        altRatio={0.5}
        size={[0.4, 1.2]}
        speedMul={0.4}
        trail
        depth
      />}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ position: "relative", display: "block" }}>
        <SvgDefs />
        <defs>
          <linearGradient id="envelopeGrad">
            <stop offset="0%" stopColor="rgba(255,200,140,0.6)" />
            <stop offset="100%" stopColor="rgba(255,122,26,0.2)" />
          </linearGradient>
          <linearGradient id="purpleEnv">
            <stop offset="0%" stopColor="rgba(220,180,255,0.55)" />
            <stop offset="100%" stopColor="rgba(184,122,255,0.18)" />
          </linearGradient>
        </defs>

        {/* fulcrum with depth */}
        <polygon points="445,360 415,400 475,400" fill="rgba(255,122,26,0.4)" stroke="var(--tk-accent)" filter="url(#fx-glow)" />
        <rect x="440" y="280" width="10" height="80" fill="rgba(255,122,26,0.5)" />
        <rect x="438" y="280" width="14" height="4" fill="rgba(255,200,140,0.3)" />

        {/* beam with bloom */}
        <g transform={`translate(445, 280) rotate(${lean})`}>
          <rect x="-220" y="-3" width="440" height="6" fill="rgba(255,122,26,0.8)" filter="url(#fx-bloom)" />
          <rect x="-220" y="-3" width="440" height="2" fill="rgba(255,230,180,0.9)" />

          {/* left pan (inputs) — orange */}
          <line x1="-180" y1="3" x2="-180" y2="48" stroke="rgba(255,122,26,0.6)" />
          <ellipse cx="-180" cy="58" rx="80" ry="10" fill="rgba(0,0,0,0.5)" stroke="var(--tk-accent)" filter="url(#fx-glow)" />
          <g transform="translate(-220, 18)">
            {[0, 1, 2].map((i) => (
              <g key={i} transform={`translate(${i * 24}, 0)`}>
                <rect x="0" y="0" width="40" height="28" fill="url(#envelopeGrad)" stroke="var(--tk-accent)" strokeWidth="0.5" filter="url(#fx-glow)" />
                <line x1="0" y1="0" x2="20" y2="14" stroke="var(--tk-accent)" strokeWidth="0.5" />
                <line x1="40" y1="0" x2="20" y2="14" stroke="var(--tk-accent)" strokeWidth="0.5" />
                {/* wax seal */}
                <circle cx="20" cy="14" r="4" fill="rgba(255,77,109,0.5)" stroke="var(--r-50)" strokeWidth="0.4" />
                <text x="20" y="22" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--y-50)">?</text>
              </g>
            ))}
          </g>
          <text x="-180" y="84" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--tk-accent)" letterSpacing="0.16em">INPUTS · 3 sealed</text>

          {/* right pan (outputs) — purple */}
          <line x1="180" y1="3" x2="180" y2="48" stroke="rgba(184,122,255,0.6)" />
          <ellipse cx="180" cy="58" rx="80" ry="10" fill="rgba(0,0,0,0.5)" stroke="var(--p-50)" filter="url(#fx-glow)" />
          <g transform="translate(150, 18)">
            {[0, 1].map((i) => (
              <g key={i} transform={`translate(${i * 30}, 0)`}>
                <rect x="0" y="0" width="40" height="28" fill="url(#purpleEnv)" stroke="var(--p-50)" strokeWidth="0.5" filter="url(#fx-glow)" />
                <line x1="0" y1="0" x2="20" y2="14" stroke="var(--p-50)" strokeWidth="0.5" />
                <line x1="40" y1="0" x2="20" y2="14" stroke="var(--p-50)" strokeWidth="0.5" />
                <circle cx="20" cy="14" r="4" fill="rgba(94,211,244,0.5)" stroke="var(--c-50)" strokeWidth="0.4" />
                <text x="20" y="22" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--y-50)">?</text>
              </g>
            ))}
          </g>
          <text x="180" y="84" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--p-50)" letterSpacing="0.16em">OUTPUTS · 2 sealed</text>
        </g>

        {/* sum-equation with bloom */}
        <text x={W / 2} y="80" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="15"
          fill="var(--ink-100)" letterSpacing="0.06em" filter="url(#fx-glow)">
          Σ <tspan fill="var(--tk-accent)">inputs</tspan> = Σ <tspan fill="var(--p-50)">outputs</tspan> + <tspan fill="var(--y-50)">fee</tspan>
        </text>
        <text x={W / 2} y="106" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="11"
          fill="var(--ink-40)" letterSpacing="0.08em">
          verifiable by anyone · without opening any envelope
        </text>

        {/* annotation */}
        <text x={W / 2} y="436" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="10"
          fill="var(--g-50)" letterSpacing="0.06em" filter="url(#fx-glow)">
          <tspan>✓</tspan> commitment balance verified <tspan fill="var(--ink-40)">·</tspan> bulletproofs+ range proof valid
        </text>
      </svg>
    </div>
  );
}

export function BalanceView({ data, bg }: ViewProps) {
  return (
    <ProtoArtboard
      label="M8 · Confidential Balance"
      kicker="MONERO PROTOCOL · 14 · CONFIDENTIAL AMOUNTS"
      title='A balance that <em>verifies</em> without opening the envelopes.'
      sub="The two pans hold sealed envelopes of unknown value. The balance still verifies. That is the magic of Pedersen commitments and Bulletproofs+ — proof of equality, without disclosure."
      badges={[{ label: "RingCT", tone: "acc" }, { label: "BP+ range proof", tone: "priv" }, { label: "Ready", tone: "ready" }]}
      bg={bg}
      stage={<><BalanceStage />
        <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          <Stat k="COMMITMENT" v="32 B" sub="Pedersen · per envelope" tone="acc" />
          <Stat k="RANGE PROOF" v="≈ 96 B" sub="BP+ · per output" tone="p" />
          <Stat k="HIDDEN ADD-OP" v="C₁ + C₂" sub="equals C₃" />
          <Stat k="VERIFICATION" v="log(n)" sub="bulletproofs" tone="g" />
        </div>
      </>}
      panel={
        <>
          <h6>How commitments hide and prove at once</h6>
          <p className="lede">A Pedersen commitment C = aG + rH lets you publish "a sealed envelope" whose value you can later prove, but never reveal.</p>
          <div className="body">
            G and H are two elliptic-curve generators. <em>a</em> is the value (amount). <em>r</em> is a random blinding factor. Anyone can verify that C₁ + C₂ = C₃ — that the inputs equal the outputs — <b>without ever seeing</b> the individual values.<br /><br />
            Bulletproofs+ adds the second proof: "every <em>a</em> is in [0, 2⁶⁴)" — i.e. nobody minted a negative amount. The two proofs together make confidential transactions mathematically airtight.
          </div>
          <h6 style={{ marginTop: 8 }}>Why it matters</h6>
          <div className="body">
            Without confidential amounts, Monero would still leak who's rich. With them, every transaction is a sealed-envelope equation that any node can audit but no node can read.
          </div>
        </>
      }
    />
  );
}
