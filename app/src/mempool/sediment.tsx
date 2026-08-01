// AUTO-PORTED from sediment.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import { useReducedMotion } from "@/design/useReducedMotion";
import { Provenance } from "@/design/primitives";
import { fmtBytes, shortHash as ShortHash } from "@/data/types";
import { MemViewShell, TrackChip, useMempoolTracking, type Tracking, MemTxTable} from "@/mempool/mempool-shared";
import { useMemStats, BlockEta } from "@/mempool/mem-stats";
import { CONF_UNLOCK, confOf } from "@/mempool/conf";
import { AreaSeries, BarSeries } from "@/pages/markets/charts";
import type { MoneroLive, Tx } from "@/data/types";

/* Chart formatters are hoisted to module scope so their identity is stable
   across renders. `AreaSeries`/`BarSeries` are React.memo'd (see
   pages/markets/charts.tsx) and an inline `format={(v) => …}` arrow allocates
   a fresh function every render, which defeats the boundary entirely. None of
   these close over anything, so module scope is where they belonged anyway. */
const fmtTx = (v: number): string => v + " tx";
const fmtPerB = (v: number): string => Math.round(v).toLocaleString() + " p/B";
const fmtRound = (v: number): string => String(Math.round(v));


export const BLOCKS_CAP = 100;

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

// sediment.jsx — SEDIMENT · hi-fi core sample
//
// The mempool drawn as a chemistry core: pending txs suspended by fee-per-byte
// (high floats, low sinks), crossing a bright confirmation meniscus into
// stratigraphic bands of confirmed blocks below. Around the core sit a grain-
// size scatter, a ring-16 fan, a stratigraphy log, a fee depth-profile and a
// live clearance trace.
//
// All helpers prefixed `Sed` to avoid the shared-scope collisions.

export function SedCard({ title, right, children, pad = "14px 16px", style }: any) {
  return (
    <div style={{ background: "var(--surface-raised)", border: "1px solid var(--rule)", borderRadius: 8, padding: pad, position: "relative", ...style }}>
      {(title || right) ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 12 }}>
          <span className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-40)" }}>{title}</span>
          <span className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-40)", display: "flex", alignItems: "center", gap: 6 }}>{right}</span>
        </div>
      ) : null}
      {children}
    </div>
  );
}

/* ── the core column — suspended txs → meniscus → strata ────── */
export function SedColumn({ data, tracking, w = 360, h = 624 }: { data: MoneroLive; tracking?: Tracking; w?: number; h?: number }) {
  // v6.1.3 audit: this was read but applied to ONE of four loops (the tracked-tx
  // halo). The streamers, the per-tx bob and the meniscus bob all kept running
  // under reduce — 13 CSS animations measured. All four are gated now. Nothing
  // is lost: a tx's y-position encodes fee/byte and is set by `perB`, not by the
  // bob; the meniscus is a static line either way; the streamers are decoration
  // over the same txs the `table` slot lists as rows.
  const reduced = useReducedMotion();
  const txs = data.mempool.slice(0, 70);
  const max = Math.max(...txs.map((t) => t.perB), 1);
  const memH = h * 0.56;
  const blocks = data.blocks.slice(0, 12);

  // Tracking, expressed in the core's own terms: a pending tx is a "you are
  // here" depth line in the suspended column; a confirmed one lights up its
  // stratum. Mirrors reactor.tsx / classic.tsx's tx-derived trackedHeight so
  // the arrow/badge semantics agree across every mempool surface (never
  // guess a height from a bare block-search — only a resolved tx pins one).
  const trackedTxId = tracking?.kind === "tx" ? tracking.id : null;
  const trackedPending = tracking?.kind === "tx" && tracking.blockHeight == null;
  const trackedHeight = tracking?.kind === "tx" ? (tracking.blockHeight ?? null) : null;

  const trackedTx = trackedPending && trackedTxId ? data.mempool.find((t) => t.id === trackedTxId) : null;
  const trackedY = trackedTx ? (1 - Math.min(1, trackedTx.perB / max)) * (memH - 26) + 5 : null;

  // One pass to fix each stratum's vertical band — shared by the strata
  // themselves and the tracked-stratum depth-annotation marker so they can
  // never disagree on where a block sits.
  let cursor = memH + 8;
  const strata = blocks.map((b, i) => {
    const stratH = 13 + Math.min(34, b.txs * 0.55);
    const top = cursor;
    cursor += stratH + 2;
    return { b, i, top, stratH };
  });
  const trackedStratum = trackedHeight != null ? strata.find((s) => s.b.height === trackedHeight) : null;

  return (
    <div style={{ position: "relative", width: w, height: h, maxWidth: "100%", marginLeft: "clamp(8px, 4vw, 78px)", flex: "none", boxSizing: "border-box" }}>
      {/* mouth label */}
      <div style={{ position: "absolute", top: -26, left: 0, right: 0, textAlign: "center", fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", letterSpacing: "0.2em", color: "var(--ink-40)" }}>
        ▼ INCOMING · STEM ⟶ FLUFF
      </div>

      {/* tube */}
      <div style={{ position: "absolute", inset: 0, border: "1px solid color-mix(in srgb, var(--accent-structural) 32%, transparent)", borderRadius: "4px 4px 0 0",
        background: "linear-gradient(180deg, color-mix(in srgb, var(--bg-0) 60%, transparent) 0%, color-mix(in srgb, var(--accent-structural) 4%, transparent) 52%, color-mix(in srgb, var(--accent-structural) 7%, transparent) 100%)",
        boxShadow: "inset 0 0 60px color-mix(in srgb, var(--accent-structural) 8%, transparent), 0 0 70px color-mix(in srgb, var(--accent-structural) 10%, transparent)" }} />

      {/* incoming streamers — D0651: per-item duration/delay is deterministic desync (index-
          derived, like styles-ambient.css's per-plate offsets), not an interaction; a shared
          --d-* token would collapse the desync back into 12 streamers ticking in lockstep. */}
      <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: 70, overflow: "hidden", pointerEvents: "none" }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", left: (10 + (i * 31) % (w - 24)) + "px", top: -12, width: 2.5, height: 13,
            background: "linear-gradient(to bottom, transparent, var(--tk-accent))", boxShadow: "0 0 6px var(--tk-accent)",
            animation: reduced ? undefined : `sed-stream ${(1.9 + (i % 5) * 0.4).toFixed(2)}s linear ${(i * -0.22).toFixed(2)}s infinite` }} />
        ))}
      </div>

      {/* suspended txs */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: memH, padding: 10 }}>
        {txs.map((tx, i) => {
          const y = (1 - tx.perB / max) * (memH - 26);
          const x = 10 + ((i * 47) % (w - 40));
          const sz = Math.max(4, Math.min(17, 3 + tx.size / 260));
          const t = tx.perB / max;
          const isTracked = trackedTxId != null && tx.id === trackedTxId;
          return (
            <React.Fragment key={tx.id}>
              <div title={ShortHash(tx.id)} data-tracked-tx={isTracked ? tx.id : undefined} style={{ position: "absolute", left: x, top: y, width: sz, height: sz, borderRadius: "50%",
                background: `radial-gradient(circle at 32% 30%, color-mix(in srgb, var(--accent-data-hi) ${Math.round((0.5 + t * 0.5) * 100)}%, transparent), color-mix(in srgb, var(--accent-data) ${Math.round((0.2 + t * 0.5) * 100)}%, transparent) 60%, transparent 80%)`,
                boxShadow: isTracked
                  ? `0 0 ${6 + t * 13}px color-mix(in srgb, var(--accent-data) ${Math.round((0.4 + t * 0.6) * 100)}%, transparent), 0 0 0 3px var(--y-50)`
                  : `0 0 ${6 + t * 13}px color-mix(in srgb, var(--accent-data) ${Math.round((0.4 + t * 0.6) * 100)}%, transparent)`,
                zIndex: isTracked ? 2 : 1,
                // D0651: per-tx duration/delay is deterministic desync (index-derived, same
                // reasoning as the streamers above) — ambient float, not an interaction.
                animation: reduced ? undefined : `sed-bob ${(3 + (i % 7) * 0.5).toFixed(2)}s ease-in-out ${(i * 0.09).toFixed(2)}s infinite` }} />
              {/* halo ring — "you are here" on the core log. D0651: sed-track-pulse 1.8s is
                  an ambient "you are here" marker, same category as view-tags.tsx's pulseScale
                  — not an interaction. Literal. */}
              {isTracked ? (
                <div aria-hidden style={{
                  position: "absolute", left: x - 7, top: y - 7, width: sz + 14, height: sz + 14, borderRadius: "50%",
                  border: "1.5px solid var(--y-50)", pointerEvents: "none", zIndex: 2,
                  animation: reduced ? undefined : "sed-track-pulse 1.8s ease-in-out infinite",
                }} />
              ) : null}
            </React.Fragment>
          );
        })}
        {/* tracked depth line — spans the tube at the tracked tx's fee depth,
            labelled toward the ruler side, even if the tx fell outside the
            rendered top-70 particles above. */}
        {trackedTx && trackedY != null ? (
          <div data-tracked-tx={trackedTxId ?? undefined} style={{ position: "absolute", left: 5, right: 5, top: trackedY, height: 0 }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: -1, height: 2, background: "var(--y-50)", boxShadow: "0 0 8px var(--y-50)" }} />
            <span style={{ position: "absolute", right: -150, top: -7, width: 140, textAlign: "right", fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--y-50)", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
              TRACKED · {ShortHash(trackedTxId)}
            </span>
          </div>
        ) : null}
        {/* fee ruler */}
        <div style={{ position: "absolute", right: -62, top: 0, bottom: 0, width: 56, display: "flex", flexDirection: "column", justifyContent: "space-between", fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-40)" }}>
          <div><div className="acc">320 p/B</div><div className="dim2" style={{ fontSize: "var(--fs-label)" }}>HIGH</div></div>
          <div>240</div><div>160</div><div>80</div>
          <div><div>0 p/B</div><div className="dim2" style={{ fontSize: "var(--fs-label)" }}>LOW</div></div>
        </div>
      </div>

      {/* meniscus — D0651: sed-bob 7s is an ambient bob loop (the liquid surface breathing),
          not an interaction, same category as styles.css's panel-breathe/tilt-pulse. Literal. */}
      <div style={{ position: "absolute", left: 5, right: 5, top: memH - 2, height: 4, background: "linear-gradient(to right, transparent, color-mix(in srgb, var(--accent-structural) 85%, transparent), transparent)", boxShadow: "0 0 14px var(--tk-accent)", animation: reduced ? undefined : "sed-bob 7s ease-in-out infinite" }} />
      <div style={{ position: "absolute", right: -78, top: memH - 12, fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--tk-accent)", letterSpacing: "0.12em" }}>⟵ CONFIRMATION</div>

      {/* strata = confirmed blocks */}
      {strata.map(({ b, i, top, stratH }) => {
        const isTrackedStratum = trackedHeight != null && b.height === trackedHeight;
        return (
          <div key={b.height}
            data-tracked-block={isTrackedStratum ? b.height : undefined}
            data-tracked-tx={isTrackedStratum ? trackedTxId ?? undefined : undefined}
            style={{ position: "absolute", left: 5, right: 5, top, height: stratH,
            background: `linear-gradient(180deg, color-mix(in srgb, var(--accent-structural) ${Math.round((0.55 - i * 0.04) * 100)}%, transparent) 0%, color-mix(in srgb, var(--accent-structural-dim) ${Math.round((0.85 - i * 0.05) * 100)}%, transparent) 100%)`,
            borderTop: isTrackedStratum ? "2px solid var(--y-50)" : (i === 0 ? "1px solid color-mix(in srgb, var(--accent-structural) 85%, transparent)" : "1px solid color-mix(in srgb, var(--accent-structural-dim) 40%, transparent)"),
            borderBottom: "1px solid color-mix(in srgb, var(--accent-structural-dim) 60%, transparent)",
            boxShadow: isTrackedStratum
              ? "0 0 18px var(--y-50), inset 0 1px 0 color-mix(in srgb, var(--accent-structural) 50%, transparent)"
              : (i === 0 ? "0 0 22px color-mix(in srgb, var(--accent-structural) 50%, transparent), inset 0 1px 0 color-mix(in srgb, var(--accent-structural) 50%, transparent)" : "inset 0 0 8px color-mix(in srgb, var(--bg-0) 40%, transparent)"),
            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)",
            color: i < 3 ? "var(--bg-0)" : "color-mix(in srgb, var(--bg-0) 80%, transparent)", fontWeight: 600, opacity: 1 - i * 0.06 }}>
            <span>#{b.height.toLocaleString()}</span>
            <span style={{ fontSize: "var(--fs-label)", opacity: 0.72 }}>{b.txs}tx · {b.conf}c</span>
            {isTrackedStratum && tracking ? (
              <TrackChip tracking={tracking} data={data} />
            ) : (
              <span style={{ fontSize: "var(--fs-label)", opacity: 0.72 }}>{b.age < 60 ? b.age + "s" : Math.floor(b.age / 60) + "m"}</span>
            )}
          </div>
        );
      })}

      {/* depth annotations */}
      <div style={{ position: "absolute", left: -76, top: 0, bottom: 0, width: 70, fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", color: "var(--ink-40)" }}>
        <div style={{ position: "absolute", top: 0, right: 0, textAlign: "right" }}><div className="acc">T=0</div><div className="dim2" style={{ fontSize: "var(--fs-label)" }}>NOW</div></div>
        <div style={{ position: "absolute", top: memH * 0.5 - 8, right: 0, textAlign: "right" }}><div>~120s</div><div className="dim2" style={{ fontSize: "var(--fs-label)" }}>STEM</div></div>
        <div style={{ position: "absolute", top: memH - 14, right: 0, textAlign: "right" }}><div className="acc">CONF</div><div className="dim2" style={{ fontSize: "var(--fs-label)" }}>+1 blk</div></div>
        <div style={{ position: "absolute", top: memH + 96, right: 0, textAlign: "right" }}><div>+{CONF_UNLOCK}c</div><div className="dim2" style={{ fontSize: "var(--fs-label)" }}>UNLOCK</div></div>
        {trackedStratum ? (
          <div data-tracked-block={trackedStratum.b.height} data-tracked-tx={trackedTxId ?? undefined}
            style={{ position: "absolute", top: trackedStratum.top - 8, right: 0, textAlign: "right", color: "var(--y-50)" }}>
            <div style={{ fontSize: "var(--fs-mono)" }}>▲ TRACKED</div>
            <div style={{ fontSize: "var(--fs-label)", color: "var(--y-50)" }}>{confOf(trackedStratum.b.height, data)}/{CONF_UNLOCK}</div>
          </div>
        ) : null}
      </div>

      {/* stopper */}
      <div style={{ position: "absolute", left: -4, right: -4, bottom: -10, height: 12, background: "linear-gradient(to bottom, color-mix(in srgb, var(--accent-structural) 50%, transparent), color-mix(in srgb, var(--accent-structural-dim) 95%, transparent))", borderBottom: "1px solid var(--tk-accent)", boxShadow: "0 6px 24px color-mix(in srgb, var(--accent-structural) 40%, transparent)" }} />

      <style>{`
        @keyframes sed-stream { from { transform: translateY(-12px); opacity: 0; } 12% { opacity: 1; } to { transform: translateY(64px); opacity: 0; } }
        @keyframes sed-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(4px); } }
        @keyframes sed-track-pulse { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.14); } }
      `}</style>
    </div>
  );
}

/* ── grain-size scatter — fee/B vs weight ───────────────────── */
export function SedGrainScatter({ data }: { data: MoneroLive }) {
  // No tick here: this body reads only `data.mempool`, which already changes
  // on the 2.5s feed poll — a `useTick(1100)` used to sit here but its return
  // value was never read, so it bought nothing except an extra full-subtree
  // React re-render 0.9x/sec (v6.0.8 perf pass).
  const W = 300, H = 188, padL = 30, padR = 10, padT = 12, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const pts = data.mempool.slice(0, 60);
  const maxFee = Math.max(...pts.map((t) => t.perB), 1);
  const maxSz = Math.max(...pts.map((t) => t.size), 1);
  return (
    <SedCard title="Grain-size analysis" right={<span className="dim">fee/B × weight</span>}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <line key={t} x1={padL} x2={W - padR} y1={padT + ih * t} y2={padT + ih * t} stroke="var(--line-d)" strokeDasharray="2 3" />)}
        <line x1={padL} y1={padT} x2={padL} y2={padT + ih} stroke="var(--ink-20)" strokeWidth="1" />
        <line x1={padL} y1={padT + ih} x2={W - padR} y2={padT + ih} stroke="var(--ink-20)" strokeWidth="1" />
        {/* settling trend */}
        <line x1={padL} y1={padT + ih} x2={W - padR} y2={padT} stroke="var(--accent-structural)" strokeOpacity={0.2} strokeDasharray="3 4" strokeWidth="1" />
        {pts.map((t, i) => {
          const x = padL + (t.size / maxSz) * iw;
          const y = padT + ih - (t.perB / maxFee) * ih;
          const f = t.perB / maxFee;
          return <circle key={t.id} cx={x} cy={y} r={2 + (t.size / maxSz) * 2.2} fill="var(--tk-accent)" opacity={0.4 + f * 0.5} style={f > 0.6 ? { filter: "drop-shadow(0 0 3px var(--tk-accent))" } : undefined} />;
        })}
        <text x={padL} y={H - 6} fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-40)">weight →</text>
        <text x={6} y={padT + 6} fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-40)" transform={`rotate(-90 8 ${padT + 6})`}>fee/B →</text>
      </svg>
    </SedCard>
  );
}

/* ── ring-16 anonymity fan ──────────────────────────────────── */
function SedRingFan() {
  // v6.1.3 audit: SMIL cannot be stopped from CSS — the elements have to not be
  // rendered. Both keep their static geometry and fill, so the halo and the one
  // real member among 15 decoys still read exactly as they do mid-animation.
  const reduced = useReducedMotion();
  const N = 16, cx = 100, cy = 96, r = 74;
  return (
    <SedCard title="Ring · 16 anonymity" right={<span className="dim">1 real · 15 decoys</span>}>
      <svg width="100%" viewBox="0 0 200 188" style={{ display: "block" }}>
        <defs>
          <radialGradient id="sed-ringpulse"><stop offset="0%" stopColor="var(--accent-structural)" stopOpacity="0.55" /><stop offset="100%" stopColor="var(--accent-structural)" stopOpacity="0" /></radialGradient>
          <linearGradient id="sed-ringline" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="var(--accent-structural)" stopOpacity="0.05" /><stop offset="60%" stopColor="var(--accent-structural)" stopOpacity="0.5" /><stop offset="100%" stopColor="var(--accent-structural)" stopOpacity="0.95" /></linearGradient>
        </defs>
        {/* D0651: SMIL <animate>'s dur attribute is XML, not a CSS property — it cannot
            consume a CSS custom property (var()) token at all, here or at any of the other
            SVG animate durations in src. Reported as its own not-applicable count, not
            folded into "literal, justified" or silently dropped — see the handoff. */}
        <circle cx={cx} cy={cy} r="50" fill="url(#sed-ringpulse)">{reduced ? null : <animate attributeName="r" values="46;66;46" dur="3.4s" repeatCount="indefinite" />}</circle>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--accent-structural)" strokeOpacity={0.18} strokeDasharray="3 3" />
        {Array.from({ length: N }).map((_, i) => {
          const ang = (i / N) * Math.PI * 2 - Math.PI / 2;
          const x2 = cx + Math.cos(ang) * r, y2 = cy + Math.sin(ang) * r;
          const real = i === 11;
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={x2} y2={y2} stroke={real ? "url(#sed-ringline)" : "var(--accent-structural-dim)"} strokeOpacity={real ? undefined : 0.15} strokeWidth={real ? 1.6 : 0.5} />
              <circle cx={x2} cy={y2} r={real ? 4 : 2.4} fill={real ? "var(--accent-structural)" : "var(--accent-structural-dim)"} fillOpacity={real ? undefined : 0.65} style={{ filter: `drop-shadow(0 0 ${real ? 4 : 2}px ${real ? "var(--accent-structural)" : "color-mix(in srgb, var(--accent-structural-dim) 60%, transparent)"})` }}>
                {real && !reduced ? <animate attributeName="opacity" values="0.4;1;0.4" dur="1.6s" repeatCount="indefinite" /> : null}
              </circle>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r="6" fill="var(--accent-structural)" style={{ filter: "drop-shadow(0 0 5px var(--accent-structural))" }} />
      </svg>
    </SedCard>
  );
}

/* ── stratigraphy log — confirmed blocks as a depth core ────── */
export function SedStrataLog({ data, trackedHeight }: { data: MoneroLive; trackedHeight?: number | null }) {
  const blocks = data.blocks.slice(0, BLOCKS_CAP);
  const maxTx = Math.max(...blocks.map((b) => b.txs), 1);
  return (
    <SedCard title={"Stratigraphy log · " + blocks.length + " strata"} right={<><Provenance source="node" fresh="live" /><span className="acc">surface → unlock</span></>}>
      {/* top pane — markets-grade tx-count-per-stratum bars (oldest → newest) */}
      <BarSeries
        data={blocks.slice().reverse().map((b) => b.txs)}
        labels={blocks.slice().reverse().map((b) => "#" + b.height)}
        format={fmtTx}
        color="var(--tk-accent)"
        baseline="zero"
        height={150}
      />

      {/* bottom pane — scrollable per-stratum log over all blocks */}
      <div style={{ maxHeight: 300, overflowY: "auto", marginTop: 12, display: "flex", flexDirection: "column", gap: 3 }}>
        {blocks.map((b, i) => {
          const isTracked = trackedHeight != null && b.height === trackedHeight;
          return (
            <div key={b.height} data-tracked-block={isTracked ? b.height : undefined}
              style={{ display: "grid", gridTemplateColumns: "30px 80px 1fr 54px", gap: 8, alignItems: "center", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", opacity: isTracked ? 1 : Math.max(0.25, 0.9 - i * 0.05) }}>
              <span className="dim2" style={{ fontSize: "var(--fs-label)" }}>{i === 0 ? "TOP" : b.conf + "c"}</span>
              <span style={{ color: isTracked ? "var(--y-50)" : i === 0 ? "var(--tk-accent)" : "var(--ink-60)" }}>#{b.height.toLocaleString()}</span>
              <div style={{ height: 9, background: "var(--line-d)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: (b.txs / maxTx * 100).toFixed(0) + "%", background: isTracked ? "var(--y-50)" : `linear-gradient(90deg, color-mix(in srgb, var(--accent-structural-dim) ${Math.round((0.9 - i * 0.05) * 100)}%, transparent), color-mix(in srgb, var(--accent-structural) ${Math.round((0.85 - i * 0.05) * 100)}%, transparent))`, boxShadow: isTracked ? "0 0 8px var(--y-50)" : (i === 0 ? "0 0 8px color-mix(in srgb, var(--accent-structural) 50%, transparent)" : "none") }} />
              </div>
              <span className="dim" style={{ textAlign: "right" }}>{b.txs}tx</span>
            </div>
          );
        })}
      </div>
    </SedCard>
  );
}

/* ── fee depth-profile ──────────────────────────────────────── */
export function SedFeeProfile({ data }: { data: MoneroLive }) {
  const fees = data.mempool.map((t) => t.perB).sort((a, b) => b - a); // high→low
  return (
    <SedCard title="Fee depth-profile" right={<span className="dim">high → low p/B</span>}>
      {fees.length ? (
        <AreaSeries data={fees} xLabels={false} markers baseline="zero"
          color="var(--tk-accent)" height={188}
          format={fmtPerB} />
      ) : (
        <div className="mono dim" style={{ padding: 24, textAlign: "center", fontSize: "var(--fs-mono)" }}>mempool empty</div>
      )}
    </SedCard>
  );
}

/** 90th-percentile fee/B — useMemStats doesn't expose this, so it's derived
 *  locally from the real mempool, same as the (single) median implementation
 *  it sits beside. Never a fabricated constant: null over an empty pool. */
function p90PerB(txs: Tx[]): number | null {
  if (!txs.length) return null;
  const sorted = txs.map((t) => t.perB).sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.9) - 1));
  return sorted[idx];
}

/* ── live clearance trace — mempool depth over time ─────────── */
export function SedClearance({ data }: { data: MoneroLive }) {
  const [series, setSeries] = React.useState(() => Array.from({ length: 48 }, () => data.mempool.length));
  React.useEffect(() => {
    setSeries((s) => [...s.slice(1), data.mempool.length]);
  }, [data.mempool.length]);
  const stats = useMemStats(data);
  const poolReady = data.ready && stats.txCount > 0;
  const p90 = poolReady ? p90PerB(data.mempool) : null;
  return (
    <SedCard title="Clearance rate" right={<Provenance source="node" fresh="live" />}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span className="mono acc glow" style={{ fontSize: 24, fontWeight: 500 }}>{data.mempool.length}</span>
        <span className="mono dim" style={{ fontSize: "var(--fs-mono)" }}>tx suspended</span>
      </div>
      <AreaSeries data={series} height={84} color="var(--tk-accent)" baseline="zero"
        xLabels={false} markers={false} format={fmtRound} />
      <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-label)", color: "var(--ink-40)", marginTop: 6 }}>
        <span>median {poolReady ? Math.round(stats.medianPerB).toLocaleString() + " p/B" : "—"}</span>
        <span>P90 {poolReady && p90 != null ? Math.round(p90).toLocaleString() + " p/B" : "—"}</span>
        <span>next {data.ready ? <BlockEta data={data} /> : "—"}</span>
      </div>
    </SedCard>
  );
}

/* ── live tx feed ───────────────────────────────────────────── */
export function SedTxFeed({ data, onPickTx }: { data: MoneroLive; onPickTx: (id: string) => void }) {
  const max = Math.max(...data.mempool.map((t) => t.perB), 1);
  const rows = data.mempool.slice(0, 12);
  return (
    <SedCard title={"Suspended transactions · " + rows.length + " of " + data.mempool.length} right={<><Provenance source="node" fresh="live" /><span className="acc">sorted by depth</span></>}>
      <div className="mono" style={{ display: "grid", gridTemplateColumns: "1.5fr 80px 110px 96px 1fr 60px", gap: 10, fontSize: "var(--fs-label)", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-40)", padding: "0 8px 6px", borderBottom: "1px solid var(--rule)" }}>
        <span>TXID</span><span>Size</span><span>Fee · XMR</span><span>Fee/B</span><span>Depth</span><span>Age</span>
      </div>
      {rows.map((t) => {
        const depth = 1 - t.perB / max;
        return (
          <div key={t.id} onClick={() => onPickTx(t.id)} style={{ display: "grid", gridTemplateColumns: "1.5fr 80px 110px 96px 1fr 60px", gap: 10, fontSize: "var(--fs-mono)", padding: "7px 8px", borderBottom: "1px solid var(--line-d)", cursor: "pointer", fontFamily: "var(--f-mono)", alignItems: "center" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "color-mix(in srgb, var(--accent-structural) 7%, transparent)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
            <span style={{ color: "var(--c-50)" }}>{ShortHash(t.id)}</span>
            <span className="dim">{fmtBytes(t.size)}</span>
            <span className="acc">{t.fee.toFixed(7)}</span>
            <span className="dim">{Math.round(t.perB).toLocaleString()}</span>
            <div style={{ height: 6, background: "var(--line)", borderRadius: 3, overflow: "hidden", alignSelf: "center" }}>
              <div style={{ height: "100%", width: ((1 - depth) * 100).toFixed(0) + "%", background: "var(--tk-accent)", boxShadow: "0 0 4px var(--tk-accent)" }} />
            </div>
            <span className="dim2">{t.age}s</span>
          </div>
        );
      })}
    </SedCard>
  );
}

export function SedOverview({ data, tracking, onPickTx }: { data: MoneroLive; tracking: Tracking; onPickTx: (id: string) => void }) {
  const trackedHeight = tracking?.kind === "tx" ? (tracking.blockHeight ?? null) : null;
  return (
    <div style={{ padding: "16px 20px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
      <section style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "stretch" }}>
        <SedColumn data={data} tracking={tracking} />
        <div style={{ flex: "1 1 360px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14, marginLeft: "clamp(0px, 4vw, 70px)" }}>
          <SedCard title="How to read this core" pad="14px 16px">
            <div style={{ fontFamily: "var(--f-serif)", fontSize: 17, lineHeight: 1.34, color: "var(--ink-100)", marginBottom: 8 }}>A cross-section of the mempool, drawn as a sample column.</div>
            <div style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", color: "var(--ink-60)", lineHeight: 1.55 }}>
              Each <span className="acc">particle</span> is one pending transaction — its <em style={{ color: "var(--ink-100)", fontStyle: "normal" }}>height</em> tracks fee-per-byte and its <em style={{ color: "var(--ink-100)", fontStyle: "normal" }}>size</em> tracks weight. The bright band is the <span className="acc">confirmation interface</span>; strata below are confirmed blocks, brightest at the surface, fading toward <span className="dim">{CONF_UNLOCK}-deep unlock</span>.
            </div>
          </SedCard>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <SedGrainScatter data={data} />
            <SedRingFan />
          </div>
          <SedClearance data={data} />
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <SedStrataLog data={data} trackedHeight={trackedHeight} />
        <SedFeeProfile data={data} />
      </section>

      <SedTxFeed data={data} onPickTx={onPickTx} />
    </div>
  );
}

export function SedimentView({ data }: ViewProps) {
  const { tracking, onSearch, clearTracking } = useMempoolTracking(data);
  // Chrome (NavTop / NetRail / Footer) is supplied by the PAGE (MempoolPage).
  // The view renders only content inside the single .main scroll container.
  // MemViewShell keeps the core column mounted while a tx is tracked — the
  // halo/depth-line/stratum highlight above stay visible alongside the
  // shared detail panel it renders below, generalising reactor.tsx /
  // classic.tsx's own hand-rolled version of this same pattern.
  return (
    <div className="main" style={{ overflow: "auto", padding: 0 }}>
      <MemViewShell id="sediment" table={<MemTxTable data={data} tracking={tracking} viewId="sediment" columns={["txid", "perB", "tier", "size", "age"]} onPickTx={(id) => onSearch({ kind: "tx", id })} />} data={data} tracking={tracking} onSearch={onSearch} onClearTracking={clearTracking}>
        <SedOverview data={data} tracking={tracking} onPickTx={(id) => onSearch({ kind: "tx", id, blockHeight: null })} />
      </MemViewShell>
    </div>
  );
}
