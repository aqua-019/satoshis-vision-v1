// AUTO-PORTED from protocols/dandelion.jsx
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

// dandelion.jsx — BOTANICAL DANDELION
// A stem grows hop-by-hop along a chain of peers. At each hop the protocol
// rolls p=0.10 to convert to fluff. On conversion: the seedhead explodes
// into 360° propagation rays that land on the broader network.

function DandelionStage() {
  const tick = useTick(60);
  const W = 1080, H = 460;
  // Stem proceeds left → right through 10 hops; fluff fires at hop 6
  const STEM_HOPS = 10;
  const FLUFF_AT = 6;
  const cycle = (Math.floor(tick / 15) % (STEM_HOPS + 8));   // animate which hop we're at
  const currentHop = Math.min(cycle, STEM_HOPS - 1);
  const isFluff = cycle >= FLUFF_AT;

  const stem = Array.from({ length: STEM_HOPS }).map((_, i) => ({
    x: 90 + (i / (STEM_HOPS - 1)) * 520,
    y: 240 + Math.sin(i * 0.8 + tick * 0.04) * 8,
    label: i === 0 ? "ORIGIN" : `h${i}`,
  }));

  const fluffPeers = Array.from({ length: 60 }).map((_, i) => {
    const ang = (i / 60) * Math.PI * 2 + Math.sin(i) * 0.2;
    const dist = 120 + (i % 7) * 22;
    return {
      x: 730 + Math.cos(ang) * dist,
      y: 240 + Math.sin(ang) * dist * 0.72,
      delay: (i % 10) * 0.05,
    };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      <defs>
        <radialGradient id="dlOrigin">
          <stop offset="0%" stopColor="rgba(184,122,255,0.95)" />
          <stop offset="60%" stopColor="rgba(184,122,255,0.3)" />
          <stop offset="100%" stopColor="rgba(184,122,255,0)" />
        </radialGradient>
        <radialGradient id="dlSeed">
          <stop offset="0%" stopColor="#ffce8a" />
          <stop offset="60%" stopColor="rgba(255,180,80,0.8)" />
          <stop offset="100%" stopColor="rgba(255,122,26,0)" />
        </radialGradient>
        <linearGradient id="dlStem" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(184,122,255,0.95)" />
          <stop offset="100%" stopColor="rgba(255,180,80,0.95)" />
        </linearGradient>
      </defs>

      {/* ground (subtle horizon line) */}
      <line x1="40" y1="380" x2={W - 40} y2="380" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 6" />
      <text x="40" y="402" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.16em">P2P TOPOLOGY · UNROLLED HORIZONTAL</text>

      {/* stem connectors (drawn up to currentHop) */}
      {stem.slice(0, currentHop).map((p, i) => {
        const n = stem[i + 1];
        if (!n) return null;
        return (
          <line key={i} x1={p.x} y1={p.y} x2={n.x} y2={n.y}
            stroke="url(#dlStem)" strokeWidth="2.5"
            style={{ filter: "drop-shadow(0 0 4px rgba(184,122,255,0.8))" }} />
        );
      })}

      {/* stem nodes (leaf peers) */}
      {stem.map((p, i) => {
        const reached = i <= currentHop;
        const isOrigin = i === 0;
        const isCurrent = i === currentHop && !isFluff;
        return (
          <g key={i}>
            {/* leaf (decorative leaf shape at each peer) */}
            <path d={`M ${p.x} ${p.y - 14} Q ${p.x - 16} ${p.y - 26} ${p.x - 4} ${p.y - 8} Z`}
              fill={reached ? "rgba(184,122,255,0.4)" : "rgba(255,255,255,0.04)"}
              stroke={reached ? "rgba(184,122,255,0.6)" : "rgba(255,255,255,0.1)"} strokeWidth="0.5" />
            <path d={`M ${p.x} ${p.y - 14} Q ${p.x + 16} ${p.y - 26} ${p.x + 4} ${p.y - 8} Z`}
              fill={reached ? "rgba(255,180,80,0.4)" : "rgba(255,255,255,0.04)"}
              stroke={reached ? "rgba(255,180,80,0.6)" : "rgba(255,255,255,0.1)"} strokeWidth="0.5" />

            <circle cx={p.x} cy={p.y} r={isOrigin ? 11 : 7}
              fill={isOrigin ? "url(#dlOrigin)" : reached ? "rgba(184,122,255,0.9)" : "rgba(120,80,160,0.18)"} />
            <circle cx={p.x} cy={p.y} r={isOrigin ? 4 : 3}
              fill={isOrigin ? "#b87aff" : reached ? "#fff" : "rgba(255,255,255,0.25)"}
              style={isOrigin || isCurrent ? { filter: "drop-shadow(0 0 6px #b87aff)" } : undefined} />

            {/* pulse ring on current hop */}
            {isCurrent ? (
              <circle cx={p.x} cy={p.y} r="14" fill="none" stroke="#b87aff" strokeWidth="1" opacity="0.6">
                <animate attributeName="r" values="8;22;8" dur="1.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.7;0;0.7" dur="1.2s" repeatCount="indefinite" />
              </circle>
            ) : null}

            <text x={p.x} y={p.y + 24} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9"
              fill={isOrigin ? "#b87aff" : reached ? "var(--ink-100)" : "var(--ink-40)"} letterSpacing="0.1em">
              {p.label}
            </text>

            {/* hop probability annotation */}
            {i > 0 && reached ? (
              <text x={(p.x + stem[i - 1].x) / 2} y={p.y - 30} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="8.5" fill="var(--ink-60)">
                p=0.10
              </text>
            ) : null}
          </g>
        );
      })}

      {/* FLUFF EXPLOSION — only after FLUFF_AT */}
      {isFluff ? (
        <g>
          {/* seedhead at last reached node */}
          {(() => {
            const c = stem[Math.min(currentHop, STEM_HOPS - 1)];
            const t = (cycle - FLUFF_AT) / 8;
            return (
              <g>
                {/* expanding shockwave */}
                <circle cx={c.x} cy={c.y} r={20 + t * 200} fill="none"
                  stroke="rgba(255,180,80,0.6)" strokeWidth="1" opacity={1 - t} />
                <circle cx={c.x} cy={c.y} r={20 + t * 120} fill="none"
                  stroke="rgba(255,200,140,0.4)" strokeWidth="1.5" opacity={0.8 - t * 0.8} />
                {/* seed rays */}
                {fluffPeers.map((p, i) => {
                  const progress = Math.max(0, Math.min(1, t * 2 - p.delay));
                  const dx = (p.x - c.x) * progress;
                  const dy = (p.y - c.y) * progress;
                  return (
                    <g key={i} opacity={progress < 1 ? 1 : 0.85}>
                      <line x1={c.x} y1={c.y} x2={c.x + dx} y2={c.y + dy}
                        stroke="rgba(255,180,80,0.18)" strokeWidth="0.5" />
                      <circle cx={c.x + dx} cy={c.y + dy} r="2.2"
                        fill="url(#dlSeed)"
                        style={{ filter: "drop-shadow(0 0 4px rgba(255,180,80,0.9))" }} />
                    </g>
                  );
                })}
                <text x={c.x} y={c.y - 60} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="11"
                  fill="var(--tk-accent)" letterSpacing="0.16em"
                  style={{ filter: "drop-shadow(0 0 6px var(--tk-accent))" }}>
                  FLUFF ✦
                </text>
              </g>
            );
          })()}
        </g>
      ) : null}

      {/* phase divider */}
      <line x1={stem[FLUFF_AT].x - 30} y1="60" x2={stem[FLUFF_AT].x - 30} y2="340"
        stroke="rgba(255,200,120,0.2)" strokeDasharray="2 4" />
      <text x={stem[Math.floor(FLUFF_AT / 2)].x} y="40" textAnchor="middle"
        fontFamily="var(--f-mono)" fontSize="10" fill="rgba(184,122,255,0.85)"
        letterSpacing="0.22em" style={{ textShadow: "var(--glow-p)" }}>
        ── STEM PHASE ── (private, deterministic)
      </text>
      <text x={(stem[FLUFF_AT].x + W - 80) / 2} y="40" textAnchor="middle"
        fontFamily="var(--f-mono)" fontSize="10" fill="rgba(255,180,80,0.85)"
        letterSpacing="0.22em" style={{ textShadow: "var(--glow-1)" }}>
        ── FLUFF PHASE ── (gossip, broadcast)
      </text>

      {/* originator obscurity meter */}
      <g transform={`translate(40, 60)`}>
        <text fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)" letterSpacing="0.18em">ORIGINATOR · obscurity</text>
        <rect x="0" y="14" width="180" height="6" fill="rgba(255,255,255,0.04)" />
        <rect x="0" y="14" width={Math.min(180, currentHop * 18 + (isFluff ? 60 : 0))} height="6"
          fill="rgba(184,122,255,0.9)" style={{ filter: "drop-shadow(0 0 6px #b87aff)" }} />
        <text x="0" y="38" fontFamily="var(--f-mono)" fontSize="10" fill="var(--p-50)">
          {currentHop} hop{currentHop === 1 ? "" : "s"} · {isFluff ? "broadcast" : "private"} · adversary set ≈ {Math.max(1, Math.pow(2, currentHop + (isFluff ? 6 : 0)))}+
        </text>
      </g>
    </svg>
  );
}

export function DandelionView({ data, bg }: ViewProps) {
  return (
    <ProtoArtboard
      label="P2 · Dandelion++"
      kicker="MONERO PROTOCOL · 02 · NETWORK PRIVACY · BIP D++"
      title='Dandelion++ — where the <em>originator</em> gets lost'
      sub="A transaction grows along a private stem of peers. On each hop, a coin flip with p=0.1 converts the stem into a broadcast 'fluff'. By the time the network sees it, the original sender is hidden in a tree of plausible originators."
      badges={[
        { label: "Stem 10", tone: "priv" },
        { label: "p_fluff = 0.10", tone: "" },
        { label: "Ready", tone: "ready" },
      ]}
      bg={bg}
      stage={
        <>
          <div style={{ position: "absolute", top: 0, right: 0, fontFamily: "var(--f-mono)", fontSize: 10, color: "var(--ink-40)", letterSpacing: "0.18em" }}>
            FIG. 02 · BOTANICAL · STEM ⟶ FLUFF
          </div>
          <DandelionStage />
          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <Stat k="STEM PROB" v="0.90" sub="stay private" tone="p" />
            <Stat k="FLUFF PROB" v="0.10" sub="broadcast" tone="acc" />
            <Stat k="EMBARGO" v="39s" sub="if no fluff seen" />
            <Stat k="OBSCURITY" v="∞" sub="post-fluff" tone="p" />
          </div>
        </>
      }
      panel={
        <>
          <div>
            <h6>The metaphor</h6>
            <div className="lede">
              A <span style={{ color: "var(--p-50)" }}>dandelion</span>. The transaction is a single seedhead that grows along a private stem, peer to peer. At some hop the stem snaps — and the seeds <em>puff outward</em>, gossiping to the whole network at once.
            </div>
          </div>

          <div className="body">
            From the outside, by the time you see a transaction broadcast (the fluff phase), it has already passed through an unknown number of stem hops. <b>Any one of those peers could have been the originator.</b> The probability concentrates on no single node.
          </div>

          <div>
            <h6>Lifecycle</h6>
            <ProtoStep n={1} done title="Wallet originates">Tx leaves the wallet to its one stem-relay peer (chosen at startup, sticky for ~10 min).</ProtoStep>
            <ProtoStep n={2} done title="Stem forward">Each peer flips a biased coin: <b>p=0.10</b> fluff, <b>p=0.90</b> keep stemming.</ProtoStep>
            <ProtoStep n={3} on title="Embargo timer">If no fluff is seen within 39s, the peer flips to fluff anyway. Anti-stall.</ProtoStep>
            <ProtoStep n={4} title="Fluff broadcast">Standard gossip — to all 8–12 peers, then their peers, exponential reach.</ProtoStep>
            <ProtoStep n={5} title="Mempool inclusion">Block solvers see the tx, include in the next block.</ProtoStep>
          </div>

          <div>
            <h6>Parameters · canonical</h6>
            <div className="proto-ctrl-row"><span className="k">Stem length (avg)</span><span className="v">1 / 0.10 = 10 hops</span></div>
            <div className="proto-ctrl-row"><span className="k">Stem-relay TTL</span><span className="v">600 s</span></div>
            <div className="proto-ctrl-row"><span className="k">Embargo timeout</span><span className="v">39 s</span></div>
            <div className="proto-ctrl-row"><span className="k">Forwarding</span><span className="v">1-of-1 stem · N-of-N fluff</span></div>
          </div>

          <div className="body" style={{ borderTop: "1px dashed var(--ink-10)", paddingTop: 12 }}>
            <em>Why this works against deanonymization:</em> a network observer who logs the first peer to broadcast a transaction is looking at a <b>random peer at hop ~10</b>, not the originator. The originator is one of many plausible upstream nodes — and they vary per tx, per peer, per minute.
          </div>
        </>
      }
    />
  );
}


