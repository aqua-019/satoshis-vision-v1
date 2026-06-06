// AUTO-PORTED from protocols/fcmp.jsx
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

// fcmp.jsx — MURMURATION
// 16 candle flames (Ring 16) dissolve into a 150M+ starling cloud. Every
// output ever minted joins the anonymity set. Statistical attacks that
// worked at n=16 evaporate at n=150M. Curve Trees rendered as a fractal
// commitment tree below.

export function Murmuration({ tick, t }: any) {
  // t in [0, 1] : 0 = ring of 16 candles, 1 = full murmuration cloud
  const W = 920, H = 360;
  const cx = W / 2, cy = H / 2;
  // 16 stable ring points
  const ringPts = React.useMemo(() => {
    return Array.from({ length: 16 }).map((_, i) => {
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
      return { x: cx + Math.cos(a) * 100, y: cy + Math.sin(a) * 100 };
    });
  }, []);

  // Many particles — represent the 150M+ swarm
  const N = 700;
  const swarm = React.useMemo(() => {
    return Array.from({ length: N }).map((_, i) => ({
      i,
      // anchor scatter inside a wide ellipse
      ax: cx + (Math.random() - 0.5) * (W - 80),
      ay: cy + (Math.random() - 0.5) * (H - 80),
      // phase for drift
      px: Math.random() * Math.PI * 2,
      py: Math.random() * Math.PI * 2,
    }));
  }, []);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      <defs>
        <radialGradient id="murmCore">
          <stop offset="0%"  stopColor="rgba(255,200,140,0.95)" />
          <stop offset="60%" stopColor="rgba(255,122,26,0.3)" />
          <stop offset="100%" stopColor="rgba(255,122,26,0)" />
        </radialGradient>
      </defs>

      {/* candle rings — only when t < 0.5 */}
      {ringPts.map((p, i) => {
        const ringOpacity = Math.max(0, 1 - t * 2);
        const cloudOpacity = Math.min(1, t * 2);
        const flicker = 0.7 + 0.3 * Math.sin((tick + i * 12) * 0.15);
        return (
          <g key={i} opacity={ringOpacity}>
            <circle cx={p.x} cy={p.y} r="11" fill="url(#murmCore)" opacity={flicker} />
            <circle cx={p.x} cy={p.y} r="3.6" fill="#ffce8a"
              style={{ filter: "drop-shadow(0 0 4px var(--tk-accent))" }} />
            <text x={p.x} y={p.y + 24} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-60)">#{i}</text>
          </g>
        );
      })}

      {/* the swarm — appears as t grows */}
      {swarm.map((p) => {
        // particles drift on Lissajous curves around their anchor
        const drift = 24 + t * 26;
        const x = p.ax + Math.sin(p.px + tick * 0.04) * drift;
        const y = p.ay + Math.cos(p.py + tick * 0.04 * 1.1) * drift * 0.7;
        const opacity = Math.min(1, t * 1.6) * (0.25 + Math.random() * 0.5);
        return (
          <circle key={p.i} cx={x} cy={y} r={1.0 + (p.i % 3) * 0.4}
            fill={p.i % 14 === 0 ? "#b87aff" : "#ff7a1a"}
            opacity={opacity}
            style={p.i % 80 === 0 && t > 0.5 ? { filter: "drop-shadow(0 0 3px var(--tk-accent))" } : undefined} />
        );
      })}

      {/* label at left transitioning */}
      <text x={40} y={36} fontFamily="var(--f-mono)" fontSize="11" fill="var(--ink-60)" letterSpacing="0.22em">ANON SET</text>
      <text x={40} y={68} fontFamily="var(--f-serif)" fontSize="42" fontWeight="500"
        fill="var(--tk-accent)" style={{ textShadow: "var(--glow-2)" }}>
        {t < 0.05 ? "16" : t < 0.3 ? Math.floor(16 + t * 4000) :
         t < 0.6 ? (Math.floor(16 + t * 50000)).toLocaleString() :
         t < 0.9 ? (Math.floor(t * 150e6 / 0.9)).toLocaleString() :
         "150,824,007"}
      </text>
      <text x={40} y={92} fontFamily="var(--f-mono)" fontSize="10" fill="var(--ink-60)" letterSpacing="0.16em">
        {t < 0.1 ? "RING-16 · CLSAG" :
         t < 0.5 ? "TRANSITIONING…" :
         t < 0.9 ? "GROWING…" :
         "ENTIRE CHAIN · FCMP++"}
      </text>

      {/* progress bar */}
      <rect x={W - 220} y="40" width="180" height="6" fill="rgba(255,255,255,0.06)" />
      <rect x={W - 220} y="40" width={180 * t} height="6"
        fill="var(--tk-accent)" style={{ filter: "drop-shadow(0 0 6px var(--tk-accent))" }} />
      <text x={W - 220} y="62" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-60)" letterSpacing="0.16em">UPGRADE PROGRESS</text>
      <text x={W - 40} y="62" textAnchor="end" fontFamily="var(--f-mono)" fontSize="9" fill="var(--tk-accent)">{Math.round(t * 100)}%</text>

      {/* center label */}
      {t > 0.85 ? (
        <g>
          <text x={cx} y={cy + 4} textAnchor="middle" fontFamily="var(--f-serif)" fontSize="22" fontWeight="500"
            fill="var(--tk-accent)" style={{ textShadow: "var(--glow-3)" }} opacity={Math.min(1, (t - 0.85) / 0.1)}>
            ALL OF IT
          </text>
          <text x={cx} y={cy + 26} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="10"
            fill="var(--ink-60)" letterSpacing="0.18em" opacity={Math.min(1, (t - 0.85) / 0.1)}>
            EVERY OUTPUT EVER MINED
          </text>
        </g>
      ) : null}
    </svg>
  );
}

export function CurveTree({ depth = 4 }: any) {
  // Cute fractal commitment tree
  const W = 920, H = 220;
  const lines: { x1: number; y1: number; x2: number; y2: number; d: number }[] = [];
  const dots: { x: number; y: number; d: number }[] = [];
  const recurse = (x: number, y: number, len: number, ang: number, d: number) => {
    if (d > depth) return;
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    lines.push({ x1: x, y1: y, x2, y2, d });
    dots.push({ x: x2, y: y2, d });
    if (d < depth) {
      recurse(x2, y2, len * 0.7, ang - 0.55, d + 1);
      recurse(x2, y2, len * 0.7, ang + 0.55, d + 1);
    }
  };
  recurse(W / 2, H - 10, 56, -Math.PI / 2, 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      <text x={20} y={20} fontFamily="var(--f-mono)" fontSize="10" fill="var(--ink-40)" letterSpacing="0.2em">CURVE TREE · depth-bounded commitment hierarchy</text>
      {lines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke={`rgba(184,122,255,${0.85 - l.d * 0.15})`}
          strokeWidth={Math.max(0.6, 2.4 - l.d * 0.4)}
          style={{ filter: l.d <= 2 ? "drop-shadow(0 0 3px rgba(184,122,255,0.5))" : undefined }} />
      ))}
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={Math.max(1.4, 3.6 - d.d * 0.6)}
          fill={d.d === depth ? "var(--tk-accent)" : "#b87aff"}
          style={d.d === 0 ? { filter: "drop-shadow(0 0 4px #b87aff)" } : undefined} />
      ))}
      <text x={W / 2} y={H - 26} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="10" fill="var(--p-50)" letterSpacing="0.16em" style={{ textShadow: "var(--glow-p)" }}>
        ROOT · O(log n) membership proof
      </text>
    </svg>
  );
}

export function FcmpView({ data, bg }: ViewProps) {
  const tick = useTick(60);
  // animate the t parameter for the murmuration on a 12s cycle, with a long
  // hold at full anonymity set
  const cy = (tick % 220);
  const t = cy < 30 ? 0 : cy < 130 ? (cy - 30) / 100 : 1;

  return (
    <ProtoArtboard
      label="P6 · FCMP++"
      kicker="MONERO PROTOCOL · 06 · FULL-CHAIN MEMBERSHIP PROOFS · Q3 2026"
      title='FCMP++ — when the anonymity set becomes <em>everything</em>'
      sub="Today: a transaction hides among 16 ring members. With FCMP++ it hides among every output that has ever existed. The statistical attacks that bound ring-signature privacy to 1/16 no longer apply — they require finite, addressable candidate sets."
      badges={[
        { label: "Curve Trees", tone: "priv" },
        { label: "Helios + Selene", tone: "priv" },
        { label: "Eligible ETA Q3 2026", tone: "acc" },
      ]}
      bg={bg}
      stage={
        <>
          <div style={{ position: "absolute", top: 0, right: 0, fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--ink-40)", letterSpacing: "0.18em" }}>
            FIG. 06 · MURMURATION · 16 → 150M+ · LIVE
          </div>

          <Murmuration tick={tick} t={t} />

          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <PanelFrame title="● Before · ring 16">
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                <div className="dim">Anonymity set</div><div className="acc">16</div>
                <div className="dim">P(guess real spender)</div><div>1/16 = 6.25%</div>
                <div className="dim">Tx weight</div><div>1.5 KB</div>
                <div className="dim">Heuristic exposure</div><div className="dn">small</div>
                <div className="dim">EAE class attacks</div><div className="dn">applicable</div>
                <div className="dim">Output-age sampling</div><div>required, gameable</div>
              </div>
            </PanelFrame>
            <PanelFrame title="◇ After · FCMP++">
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                <div className="dim">Anonymity set</div><div style={{ color: "var(--p-50)", textShadow: "var(--glow-p)" }}>150,824,007</div>
                <div className="dim">P(guess real spender)</div><div>~0 · {"<"} 1/n</div>
                <div className="dim">Tx weight</div><div>~3 KB</div>
                <div className="dim">Heuristic exposure</div><div className="up">none (asymptotic)</div>
                <div className="dim">EAE class attacks</div><div className="up">retired</div>
                <div className="dim">Output-age sampling</div><div className="up">N/A</div>
              </div>
            </PanelFrame>
          </div>

          {/* curve trees */}
          <div style={{ marginTop: 24 }}>
            <CurveTree depth={5} />
          </div>
        </>
      }
      panel={
        <>
          <div>
            <h6>The metaphor</h6>
            <div className="lede">
              A <span style={{ color: "var(--tk-accent)" }}>murmuration of starlings</span>. Pick one bird. Now pick one of the same kind out of a flock of 150 million birds, all flying together, all indistinguishable. Where ring signatures hand the analyst <em>15 alternatives</em>, FCMP++ hands them <em>every output ever made</em>.
            </div>
          </div>

          <div className="body">
            FCMP++ replaces ring signatures with a <b>membership proof</b>: prove that the spent output is somewhere in a commitment tree (the chain's entire UTXO set) without identifying which leaf. Combined with linkability — to prevent double-spending — the construction is privacy-preserving with no sampling step at all.
          </div>

          <div>
            <h6>Mechanics · short version</h6>
            <ProtoStep n={1} done title="Commitment forest">All outputs are inserted into a Curve Tree, a depth-bounded hierarchy of group commitments. New leaves are added per block.</ProtoStep>
            <ProtoStep n={2} done title="Proof of inclusion">Spender proves, in zero knowledge, that <em>their</em> output's commitment is one of the leaves under the current root.</ProtoStep>
            <ProtoStep n={3} done title="Key image / linkability">A deterministic image of the spent key is published — duplicate keys = double spend, detectable without revealing which output.</ProtoStep>
            <ProtoStep n={4} on title="Compose with stealth + view-tags">Output ownership and scanning machinery (P3, P5) carry over unchanged.</ProtoStep>
          </div>

          <div>
            <h6>What changes for users</h6>
            <div className="proto-ctrl-row"><span className="k">Tx fees</span><span className="v">slight increase (larger proofs)</span></div>
            <div className="proto-ctrl-row"><span className="k">Wallet sync</span><span className="v g">unchanged</span></div>
            <div className="proto-ctrl-row"><span className="k">Existing outputs</span><span className="v">migrated into the tree on upgrade</span></div>
            <div className="proto-ctrl-row"><span className="k">Ring size selector</span><span className="v">retired from UI — there is no ring</span></div>
            <div className="proto-ctrl-row"><span className="k">Decoy selection education</span><span className="v p">historical context</span></div>
          </div>

          <div>
            <h6>Cryptographic primitives</h6>
            <div className="body">
              FCMP++ stacks <b>Curve Trees</b> (two-cycle elliptic groups, Helios + Selene) with <b>generalized Schnorr proofs</b> and a Bulletproofs+ inner argument. Net result: a ~3 KB proof per spend, verifiable in batches, that the leaf is under the root.
            </div>
          </div>

          <div className="body" style={{ borderTop: "1px dashed var(--ink-10)", paddingTop: 12 }}>
            <em>Why the wait:</em> the math is correct; the audit surface is enormous. MRL is being careful — this is the largest privacy upgrade since RingCT in 2017. Expected hardfork Q3 2026.
          </div>
        </>
      }
    />
  );
}


