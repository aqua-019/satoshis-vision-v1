// AUTO-PORTED from mempool/reactor.jsx — HEX-LATTICE / v4-parity reactor.
// Manual fixups land in MIGRATION.md. Chrome (NavTop/NetRail/ArtBackground/
// Footer/Crumbs) stripped per MIGRATION §5: the PAGE supplies chrome, the view
// is content-only inside one scroll container.
//
// REACTOR — the flagship mempool explorer (matches screenshots/03-mempool-reactor):
//   - Block stream: QUEUED → NEXT → confirmed blocks (heights scale to tx count)
//   - 3D isometric block stack (last 10)
//   - Hex-lattice mempool grid (one cell = one tx, colour = fee/byte) + fee/B histogram
//   - CLSAG ring-16 signature fan + anonymity-set readout
//   - Pool-distribution donut
//   - Live tx feed (fee-tier tagged, newest first)
//
// Drilldown: clicking a tx row or a block routes tracking through
// mempool-shared's MempoolTrackingDetail (rendered by MemViewShell below), which
// renders the rich live FullTxDetail / FullBlockDetail inspectors (real /api/tx
// lookups).
import * as React from "react";
import { Link } from "react-router-dom";
import { PanelFrame, MiniBar, Provenance } from "@/design/primitives";
import { fmtBytes, fmtFee, shortHash as ShortHash } from "@/data/types";
import type { MoneroLive, Tx } from "@/data/types";
import { FEE_TIER_LABELS, feeTierIndex, hashToUnit } from "@/data/map";
import { BlockEta } from "@/mempool/mem-stats";
import { feeRateHistogram } from "@/data/histogram";
import { useMempoolTracking, MemViewShell, TrackChip, type Tracking, MemTxTable} from "@/mempool/mempool-shared";
import { chainTip, confOf, CONF_UNLOCK, RIBBON_BLOCKS } from "@/mempool/conf";
import { useRibbonGlide } from "@/mempool/useRibbonGlide";
import { useReducedMotion } from "@/design/useReducedMotion";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
  focusBlock?: number | null;
  onClearFocus?: () => void;
}

/** Which (if any) tx a piece of tracking marks — used to gate data-tracked-tx. */
function trackedTxIdFor(tracking: Tracking): string | null {
  return tracking?.kind === "tx" ? tracking.id : null;
}

/* ──────────────────────────────────────────────────────────────
   HEX-LATTICE INSTRUMENTS
   ────────────────────────────────────────────────────────────── */

type HexCell = { x: number; y: number; intensity: number; tx?: Tx; i: number };

/* ── hex-grid mempool: each cell = one mempool tx, colour/glow tied to fee/byte ── */
function MempoolHexGrid({ mempool, cols = 26, rows = 14 }: { mempool: Tx[]; cols?: number; rows?: number }) {
  // v6.1.3 audit: the pulse below was gated on `intensity > 0.75` only, so the
  // hottest cells kept breathing under reduce. Colour and glow already encode
  // fee/byte on every cell — the pulse adds no information, so it is dropped
  // outright rather than slowed.
  const reduced = useReducedMotion();
  const cells: HexCell[] = [];
  const txs = mempool.slice(0, cols * rows);
  const maxPerB = Math.max(...txs.map((t) => t.perB), 1);
  for (let i = 0; i < cols * rows; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const tx = txs[i];
    const intensity = tx ? Math.min(1, (tx.perB / maxPerB) * 0.9 + 0.1) : 0;
    const x = c * 24 + (r % 2 ? 12 : 0);
    const y = r * 21;
    cells.push({ x, y, intensity, tx, i });
  }
  return (
    <div style={{ position: "relative", width: cols * 24 + 12, height: rows * 21 + 12 }}>
      {cells.map(({ x, y, intensity, tx, i }) =>
        tx ? (
          <div
            key={i}
            className="hex"
            style={{
              left: x, top: y,
              width: 22, height: 26,
              background:
                intensity > 0.85
                  ? "color-mix(in srgb, var(--accent-data-hi) 95%, transparent)"
                  : intensity > 0.6
                    ? `color-mix(in srgb, var(--accent-data) ${Math.round((0.35 + intensity * 0.55) * 100)}%, transparent)`
                    : `color-mix(in srgb, var(--accent-data) ${Math.round((0.08 + intensity * 0.4) * 100)}%, transparent)`,
              boxShadow:
                intensity > 0.6
                  ? `0 0 ${4 + intensity * 14}px color-mix(in srgb, var(--accent-data) ${Math.round(intensity * 100)}%, transparent)`
                  : "none",
              // Deterministic jitter from the tx's own id, NOT a dice roll. The
              // repo bans random on live surfaces, and a hash-derived duration is
              // better anyway: a cell keeps its cadence across re-renders instead
              // of resampling every commit.
              // D0651: this is an ambient per-cell desync loop, not an interaction — the
              // whole point of the jitter is that no two cells share a --d-* token's exact
              // cadence, same reasoning as styles-ambient.css's per-plate offsets. Literal.
              animation: !reduced && intensity > 0.75
                ? `hexpulse ${(1.6 + hashToUnit(tx.id) * 1.2).toFixed(2)}s ease-in-out ${(-(i * 0.02)).toFixed(2)}s infinite`
                : undefined,
            }}
            title={`${ShortHash(tx.id)} · ${fmtFee(tx.fee)}`}
          />
        ) : (
          <div
            key={i}
            className="hex"
            style={{
              left: x, top: y, width: 22, height: 26,
              background: "transparent",
              border: "0.5px solid var(--line-d)",
            }}
          />
        )
      )}
    </div>
  );
}

/* ── 3D isometric block stack — newest at front, oldest receding into depth ── */
function IsoBlockStack({ blocks, w = 360, h = 380, onSelectBlock }: {
  blocks: MoneroLive["blocks"];
  w?: number;
  h?: number;
  onSelectBlock?: (height: number) => void;
}) {
  const showing = blocks.slice(0, RIBBON_BLOCKS);
  return (
    // overflow:hidden makes the box authoritative — the 3D stack can never bleed
    // out of w×h onto the neighbouring Pool-attribution panel (P3). The inner
    // stage is scaled/centred so the full "last 10" stays inside those bounds.
    <div style={{ position: "relative", width: "100%", maxWidth: w, height: h, margin: "0 auto", overflow: "hidden", perspective: "1200px", perspectiveOrigin: "50% 42%" }}>
      <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: "translate(-6%, 4%) scale(0.62) rotateX(54deg) rotateZ(-38deg) translateZ(-80px)", transformOrigin: "50% 50%" }}>
        {showing.map((b, i) => {
          const z = i * -28;
          const size = 100;
          const heightOfBlock = Math.min(120, 26 + (b.txs / 140) * 100);
          const opacity = 1 - i * 0.07;
          return (
            <div
              key={b.height}
              onClick={() => onSelectBlock?.(b.height)}
              style={{
                position: "absolute",
                left: 80 + i * 6,
                top: 80 + i * 6,
                width: size,
                height: size,
                transform: `translateZ(${z}px)`,
                transformStyle: "preserve-3d",
                opacity,
                cursor: onSelectBlock ? "pointer" : "default",
              }}
            >
              {/* top face */}
              <div
                style={{
                  position: "absolute", inset: 0,
                  background: `linear-gradient(135deg, color-mix(in srgb, var(--accent-structural) ${Math.round((0.85 - i * 0.05) * 100)}%, transparent) 0%, color-mix(in srgb, var(--accent-structural) ${Math.round((0.7 - i * 0.05) * 100)}%, transparent) 100%)`,
                  border: "1px solid color-mix(in srgb, var(--accent-structural) 90%, transparent)",
                  boxShadow: i === 0 ? "0 0 40px color-mix(in srgb, var(--accent-structural) 80%, transparent), inset 0 0 20px color-mix(in srgb, var(--accent-structural) 40%, transparent)" : "0 0 16px color-mix(in srgb, var(--accent-structural) 30%, transparent)",
                }}
              >
                <div style={{
                  position: "absolute", left: 6, top: 4,
                  fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)",
                  color: i === 0 ? "var(--bg-0)" : "color-mix(in srgb, var(--bg-0) 70%, transparent)",
                  fontWeight: 600, transform: "rotate(0deg)",
                }}>#{b.height.toString().slice(-4)}</div>
                <div style={{
                  position: "absolute", left: 6, bottom: 6, right: 6,
                  fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)",
                  color: "color-mix(in srgb, var(--bg-0) 65%, transparent)",
                }}>{b.txs} TX · {b.sizeKB.toFixed(0)}KB</div>
              </div>
              {/* right side (extruded) */}
              <div
                style={{
                  position: "absolute",
                  width: heightOfBlock, height: size,
                  background: `linear-gradient(180deg, color-mix(in srgb, var(--accent-structural) ${Math.round((0.55 - i * 0.04) * 100)}%, transparent), color-mix(in srgb, var(--accent-structural-dim) ${Math.round((0.85 - i * 0.04) * 100)}%, transparent))`,
                  border: "1px solid color-mix(in srgb, var(--accent-structural) 50%, transparent)",
                  right: -heightOfBlock,
                  top: 0,
                  transform: "rotateY(90deg)",
                  transformOrigin: "left center",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  width: size, height: heightOfBlock,
                  background: `linear-gradient(90deg, color-mix(in srgb, var(--accent-structural-dim) ${Math.round((0.85 - i * 0.04) * 100)}%, transparent), color-mix(in srgb, var(--accent-structural-dim) ${Math.round((0.95 - i * 0.04) * 100)}%, transparent))`,
                  border: "1px solid color-mix(in srgb, var(--accent-structural) 35%, transparent)",
                  left: 0,
                  bottom: -heightOfBlock,
                  transform: "rotateX(-90deg)",
                  transformOrigin: "center top",
                }}
              />
            </div>
          );
        })}
      </div>
      {/* annotations layer (un-rotated) */}
      <div style={{ position: "absolute", left: 12, top: 8, fontFamily: "var(--f-mono)", fontSize: "var(--fs-label)", letterSpacing: "0.18em", color: "var(--ink-40)" }}>
        ISOMETRIC · LAST 10 · LIVE
      </div>
      <div style={{ position: "absolute", right: 12, bottom: 8, fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>
        ◢ #{blocks[0]?.height}
      </div>
    </div>
  );
}

/* ── CLSAG ring-16 signature fan: one real input fans into 16 decoys ── */
function RingSigFan() {
  const N = 16;
  const cx = 100, cy = 100, r = 80;
  // v6.1.3 audit: SMIL <animate> is invisible to CSS, so no reduced-motion rule
  // can reach these two — the only way to honour it is to not render them. Both
  // elements they animate stay: the halo circle keeps its static r/opacity and
  // the real member keeps its full-opacity fill and drop-shadow, which is what
  // distinguishes it from the 15 decoys. Only the breathing is suppressed.
  const reduced = useReducedMotion();
  return (
    <svg width="100%" viewBox="0 0 210 210" style={{ display: "block", maxWidth: 210 }}>
      <defs>
        <radialGradient id="ringPulse">
          <stop offset="0%" stopColor="var(--accent-structural)" stopOpacity="0.8" />
          <stop offset="100%" stopColor="var(--accent-structural)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ringLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent-structural)" stopOpacity="0.05" />
          <stop offset="60%" stopColor="var(--accent-structural)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--accent-structural)" stopOpacity="0.95" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r="55" fill="url(#ringPulse)" opacity="0.5">
        {reduced ? null : <animate attributeName="r" values="50;70;50" dur="3.5s" repeatCount="indefinite" />}
      </circle>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--accent-structural)" strokeOpacity={0.18} strokeDasharray="3 3" />
      {Array.from({ length: N }).map((_, i) => {
        const ang = (i / N) * Math.PI * 2 - Math.PI / 2;
        const x2 = cx + Math.cos(ang) * r;
        const y2 = cy + Math.sin(ang) * r;
        const isReal = i === 11;
        return (
          <g key={i}>
            <line x1={cx} y1={cy} x2={x2} y2={y2}
              stroke={isReal ? "url(#ringLine)" : "var(--accent-structural-dim)"}
              strokeOpacity={isReal ? undefined : 0.15}
              strokeWidth={isReal ? "1.5" : "0.5"} />
            <circle cx={x2} cy={y2} r={isReal ? 4 : 2.4}
              fill={isReal ? "var(--accent-structural)" : "var(--accent-structural-dim)"}
              fillOpacity={isReal ? undefined : 0.65}
              style={{ filter: `drop-shadow(0 0 ${isReal ? 8 : 3}px ${isReal ? "var(--accent-structural)" : "color-mix(in srgb, var(--accent-structural-dim) 60%, transparent)"})` }}>
              {isReal && !reduced ? (
                <animate attributeName="opacity" values="0.4;1;0.4" dur="1.6s" repeatCount="indefinite" />
              ) : null}
            </circle>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r="6" fill="var(--accent-structural)" style={{ filter: "drop-shadow(0 0 10px var(--accent-structural))" }} />
      <text x={cx} y={cy + 28} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-60)" letterSpacing="0.1em">
        TX · 16 RING · 1 REAL
      </text>
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────
   REACTOR VIEW · root
   Chrome stripped (MIGRATION §5): no .art wrapper, no ArtBackground,
   no .art-stage, no NavTop/NetRail/Footer/Crumbs. Content-only inside
   one scroll container. Clicking a tx row or a block opens the rich
   FullTxDetail / FullBlockDetail inspectors from tx-detail.
   ────────────────────────────────────────────────────────────── */

export function ReactorView({ data, focusBlock, onClearFocus }: ViewProps) {
  // Shared tracking — the SAME hook + detail as every other view; confOf everywhere.
  const { tracking, onSearch, clearTracking } = useMempoolTracking(data);
  // Declared unconditionally for stable hook order. Keyed to chainTip(data) —
  // the newest confirmed block height (data.blocks[0].height), the same value
  // the ribbon renders from — so the FLIP fires exactly when the block list
  // shifts, not on every get_info (data.height) tick.
  const glideRef = useRibbonGlide(chainTip(data));
  const reduced = useReducedMotion();

  const clear = () => { clearTracking(); onClearFocus?.(); };
  const onSelectBlock = (height: number) => onSearch({ kind: "block", height });
  // Live-feed rows are mempool txs → pin null (unconfirmed).
  const onPickTx = (id: string) => onSearch({ kind: "tx", id, blockHeight: null });

  // Deep-link: open the block detail for ?block=<height> (fires only on change).
  const lastFocus = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (focusBlock == null) { lastFocus.current = null; return; }
    if (focusBlock === lastFocus.current) return;
    lastFocus.current = focusBlock;
    onSelectBlock(focusBlock);
    // eslint-disable-next-line
  }, [focusBlock]);

  const netGh = (data.hashrate / 1e9).toFixed(2);
  // Tracked tx: the ▲ rides the block where height === pinned; badge === confOf,
  // which equals that block's own CONF label in the stream.
  const trackedHeight = tracking?.kind === "tx" ? (tracking.blockHeight ?? null) : null;

  // Real fee/B histogram from the live mempool sample (same binning NetworkPage
  // uses, so the two surfaces agree by construction) instead of the 5 coarse
  // node buckets fanned out into a fake 32-point staircase (feeHistFromBuckets,
  // data/map.ts) — that fan-out invents resolution the node never reported.
  // Fall back to the node's coarse data.feeHist ONLY when the mempool itself is
  // empty (nothing real to bin); otherwise show exactly what was really binned,
  // even if that's fewer than 32 non-empty bars for a thin mempool.
  const mempoolEmpty = data.mempool.length === 0;
  const realHist = React.useMemo(
    () => feeRateHistogram(data.mempool.map((t) => t.perB), 32),
    [data.mempool],
  );
  const histData = mempoolEmpty ? data.feeHist : realHist.counts;
  const histLabels = mempoolEmpty ? undefined : realHist.labels;
  const histCaption = mempoolEmpty
    ? "5 node buckets"
    : realHist.counts.length
      ? `32 bins · ${data.mempool.length} tx`
      : `too few tx to bin (${data.mempool.length})`;

  return (
    <div className="main" style={{ overflow: "auto", padding: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "16px 20px 40px" }}>

        {/* MemViewShell (mempool-shared.tsx) supplies the search bar, heartbeat,
            tracked-chip and the shared stat strip (Reactor had none before this
            refactor). The hero (block stream + iso stack) stays mounted while
            tracking — same as before — so the tracked ▲ stays visible on its
            block alongside the detail panel rendered below it. */}
        <MemViewShell id="reactor" table={<MemTxTable data={data} tracking={tracking} viewId="reactor" columns={["txid", "perB", "tier", "size", "age", "inout"]} onPickTx={(id) => onSearch({ kind: "tx", id })} />} data={data} tracking={tracking} onSearch={onSearch} onClearTracking={clear}>

          {/* hero: block stream + iso stack */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 14, minHeight: 320 }}>
            <PanelFrame
              title={<><span>● Block stream</span><span className="dim2">queued ⟶ confirmed</span></>}
              right={<><span>FEE-SORTED</span><span className="acc">▣ AUTO-SCROLL</span></>}
            >
              <div ref={glideRef} style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 260, overflow: "hidden", position: "relative", padding: "8px 4px" }}>
                {/* queued + next placeholders */}
                <div className="mblock q" style={{ width: 70, minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div className="hh">~#{(data.height + 2).toLocaleString()}</div>
                    <div className="nm" style={{ fontSize: 16 }}>QUEUED</div>
                  </div>
                  {/* real: the block after next, from the node's own target */}
                  <div className="sz">{data.mempool.length} tx<br />in <BlockEta data={data} offsetSec={data.blockTarget || 120} /></div>
                </div>
                <div className="mblock q" style={{ width: 84, minHeight: 220 }}>
                  <div className="hh">~#{(data.height + 1).toLocaleString()}</div>
                  <div className="nm">NEXT</div>
                  <div className="sz">{Math.min(data.mempool.length, 22)} tx<br />in <BlockEta data={data} /></div>
                </div>
                {/* confirmed blocks — heights scale to txs, clickable → block detail */}
                {data.blocks.slice(0, RIBBON_BLOCKS).map((b, i) => {
                  const h = 130 + Math.min(120, (b.txs / 140) * 120);
                  const isTracked = trackedHeight != null && b.height === trackedHeight;
                  return (
                    <div key={b.height} data-glide-key={b.height}
                      data-tracked-block={isTracked ? b.height : undefined}
                      data-tracked-tx={isTracked ? trackedTxIdFor(tracking) ?? undefined : undefined}
                      className="mblock glide-block" onClick={() => onSelectBlock(b.height)}
                      style={{ width: 96, minHeight: h, display: "flex", flexDirection: "column", justifyContent: "space-between", opacity: 1 - i * 0.04, cursor: "pointer",
                        boxShadow: isTracked ? "0 0 14px color-mix(in srgb, var(--status-warn) 55%, transparent)" : undefined,
                        outline: isTracked ? "1.5px solid var(--y-50)" : undefined, outlineOffset: -1 }}>
                      <div>
                        <div className="hh">#{b.height.toLocaleString()}</div>
                        <div className="hh" style={{ fontSize: "var(--fs-label)" }}>{b.conf} CONF</div>
                      </div>
                      <div>
                        <div className="nm">{b.txs}</div>
                        <div className="sz">{b.sizeKB.toFixed(1)} KB</div>
                        <div className="sz">{b.age < 60 ? b.age + "s ago" : Math.floor(b.age / 60) + "m ago"}</div>
                        {isTracked ? (
                          <div className="mono" style={{ marginTop: 4, textAlign: "center" }}>
                            <div style={{ fontSize: "var(--fs-mono)", color: "var(--y-50)", lineHeight: 1 }}>▲</div>
                            <TrackChip tracking={tracking} data={data} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                {/* glow track — D0651: flow 6s linear is an ambient current-flow loop along
                    the confirmation track, not an interaction; same category as the
                    spin-slow/spin-med ambient rotations in styles.css. Left literal.
                    v6.1.3 audit: those ambient classes are gated `!important` in
                    styles-ambient.css's reduce block; an inline `animation` never reaches
                    that rule, so the gate has to be here. The track itself — gradient,
                    glow, and the confirmation slots above it — renders either way. */}
                <div style={{
                  position: "absolute", left: 0, right: 0, bottom: 0, height: 3,
                  background: "linear-gradient(to right, transparent, var(--tk-accent), transparent)",
                  boxShadow: "0 0 12px var(--tk-accent)",
                  animation: reduced ? undefined : "flow 6s linear infinite",
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 4px 0", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", color: "var(--ink-40)" }}>
                <span>← scroll back · #{(data.height - CONF_UNLOCK).toLocaleString()}</span>
                <span className="acc">{CONF_UNLOCK} confs · UNLOCK ▸</span>
              </div>
            </PanelFrame>
            <PanelFrame title={`Iso stack · last ${CONF_UNLOCK}`} right={<><Provenance source="node" fresh="live" /><span>BLOCK GEOMETRY</span></>}>
              <IsoBlockStack blocks={data.blocks} w={340} h={300} onSelectBlock={onSelectBlock} />
            </PanelFrame>
          </div>

          {/* Tracking drilldown is rendered BELOW this by MemViewShell (so the
              tracked ▲ stays visible on its block in the stream above), and the
              hex-lattice/ring/pool/tx-feed panels below hide while tracking —
              same placement semantics as before this refactor. */}
          {!tracking ? (
            <>
              {/* hex mempool grid + ring sig + pool distribution */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 240px 320px", gap: 14, minHeight: 360 }}>
                <PanelFrame
                  title={<><span>● Mempool · hex lattice</span><span className="dim2">cells = tx · color = fee/B</span></>}
                  right={<><Provenance source="node" fresh="live" /><span>{data.mempool.length} ACTIVE</span><span className="acc">FEE ↑</span></>}
                >
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <MempoolHexGrid mempool={data.mempool} cols={22} rows={11} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)" }}>
                      <div className="kicker">Lattice key</div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}><span className="hex" style={{ position: "static", width: 14, height: 16, background: "color-mix(in srgb, var(--accent-data-hi) 95%, transparent)" }} /><span className="dim">priority</span></div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}><span className="hex" style={{ position: "static", width: 14, height: 16, background: "color-mix(in srgb, var(--accent-data) 60%, transparent)" }} /><span className="dim">standard</span></div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}><span className="hex" style={{ position: "static", width: 14, height: 16, background: "color-mix(in srgb, var(--accent-data) 18%, transparent)" }} /><span className="dim">low</span></div>
                      <div style={{ marginTop: 8 }} className="kicker">Distribution</div>
                      <MiniBar data={histData} labels={histLabels} width={170} height={48} hover fmt={(v: number) => `${Math.round(v)} tx`} />
                      <div className="dim" style={{ fontSize: "var(--fs-label)" }}>fee/B histogram · {histCaption}</div>
                    </div>
                  </div>
                </PanelFrame>
                <PanelFrame title="Ring · 16" right={<span className="acc">CLSAG</span>}>
                  <RingSigFan />
                  <div className="kv" style={{ marginTop: 8, fontSize: "var(--fs-mono)" }}><span className="k">Anonymity set</span><span className="v acc">152.8M</span></div>
                  <div className="kv" style={{ fontSize: "var(--fs-mono)" }}><span className="k">Decoy strategy</span><span className="v">gamma</span></div>
                  <div className="kv" style={{ fontSize: "var(--fs-mono)" }}><span className="k">FCMP++ ETA</span><span className="v p">Q3 2026</span></div>
                </PanelFrame>
                <PanelFrame title="Pool attribution" right={<span className="dim">UNATTRIBUTED</span>}>
                  <div style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", lineHeight: 1.55 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 22, color: "var(--ink-100)" }}>
                        {data.blocks.slice(0, 14).filter((b) => !b.pool || b.pool === "Unknown" || b.pool === "—").length}/{data.blocks.slice(0, 14).length}
                      </span>
                      <span className="dim">recent blocks · pool unknown</span>
                    </div>
                    <p className="dim" style={{ marginTop: 8, fontSize: "var(--fs-mono)", color: "var(--ink-40)" }}>
                      Monero coinbases don't tag pools — the node reports every block as
                      unattributed, so per-pool share can't be measured on-chain. Live network
                      hashrate: <span className="acc">{netGh} GH/s</span>.
                    </p>
                    <Link to="/simulate?p=skyline" className="acc" style={{ fontSize: "var(--fs-mono)" }}>
                      Decentralization &amp; HHI → Skyline simulator
                    </Link>
                  </div>
                </PanelFrame>
              </div>

              {/* live tx feed */}
              <PanelFrame
                title={<><span>● Live tx feed</span><span className="dim2">newest first</span></>}
                right={<><span>STREAM ACTIVE</span><span className="acc">FEE TIER · LIVE</span></>}
              >
                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 90px 110px 110px 90px 60px", gap: 12, fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)" }}>
                  <div className="kicker">TIER</div>
                  <div className="kicker">TXID</div>
                  <div className="kicker">SIZE</div>
                  <div className="kicker">FEE</div>
                  <div className="kicker">FEE/B</div>
                  <div className="kicker">RING</div>
                  <div className="kicker">AGE</div>
                  {data.mempool.slice(0, 7).map((tx) => {
                    const tierIdx = feeTierIndex(tx.perB, data.feeTiers);
                    const tierColors = ["var(--c-50)", "var(--g-50)", "var(--y-50)", "var(--r-50)"];
                    return (
                    <React.Fragment key={tx.id}>
                      <div onClick={() => onPickTx(tx.id)} style={{ cursor: "pointer" }}>
                        <span className="pill" style={{ padding: "2px 6px", fontSize: "var(--fs-label)", color: tierIdx >= 0 ? tierColors[tierIdx] : undefined }}>
                          {tierIdx >= 0 ? FEE_TIER_LABELS[tierIdx].toUpperCase() : "—"}
                        </span>
                      </div>
                      <div className="hash" data-tracked-tx={trackedTxIdFor(tracking) === tx.id ? tx.id : undefined} onClick={() => onPickTx(tx.id)} style={{ fontSize: "var(--fs-mono)", cursor: "pointer" }}>{tx.id.slice(0, 12)}…{tx.id.slice(-10)}</div>
                      <div className="dim">{fmtBytes(tx.size)}</div>
                      <div>{fmtFee(tx.fee)}</div>
                      <div className="acc">{tx.perB.toFixed(2)} p/B</div>
                      <div className="dim">ring:16</div>
                      <div className="dim">{tx.age}s</div>
                    </React.Fragment>
                    );
                  })}
                </div>
              </PanelFrame>
            </>
          ) : null}

        </MemViewShell>
      </div>
    </div>
  );
}
