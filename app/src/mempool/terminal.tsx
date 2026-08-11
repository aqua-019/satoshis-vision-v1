// AUTO-PORTED from terminal.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import { byTier, getDeviceTier } from "@/design/deviceTier";
import { usePageActive } from "@/design/usePageActive";
import { PanelFrame, NodeProvenance } from "@/design/primitives";
import { fmtBytes, fmtN, shortHash } from "@/data/types";
import { FEE_TIER_LABELS, feeTierIndex } from "@/data/map";
import { useFeedEvents } from "@/data/useFeedEvents";
import type { FeedEvent } from "@/data/useFeedEvents";
import { useMempoolTracking, MemViewShell, MemTxTable } from "@/mempool/mempool-shared";
import { confOf, CONF_UNLOCK } from "@/mempool/conf";
import { useMemStats, BlockEta, fmtMMSS } from "@/mempool/mem-stats";
import type { MemStats } from "@/mempool/mem-stats";
import { useReducedMotion } from "@/design/useReducedMotion";
import type { MoneroLive, Block, Tx } from "@/data/types";
import { hasData, oldestFreshAt } from "@/data/feed-status";
import { AXIS, GRID, ChartCrosshair, ChartTip, useSvgCursor, useGradientId, VB_W } from "@/design/chart-kit";
import { useChartMetrics, labelStep, tickCount } from "@/design/useChartMetrics";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

// Left-pad a number to a fixed width for the ASCII status panel.
const pad = (n: number, w: number) => String(n).padStart(w, " ");

/** Tier colors, slow → fastest. */
const TIER_COLORS = ["var(--c-50)", "var(--g-50)", "var(--y-50)", "var(--r-50)"] as const;

/** GB string from a real byte count; "—" until the node has reported it. */
const dbGB = (data: MoneroLive) =>
  hasData(data.status.network) && data.databaseSize ? (data.databaseSize / 1e9).toFixed(1) + " GB" : "—";

// terminal.tsx — TERMINAL HUB · hi-fi CLI · v2 density rebuild
//
// The "I run my own node" power-user surface. A self-typing command palette
// fed by live RPC data, an auto-tailing log derived from real feed diffs, a
// reactive ASCII block stream, a live ASCII fee histogram, compact radial
// gauges, and a node/fee/chain rail — all kept from the pre-rebuild file.
//
// This rebuild ADDS three chart-kit charts (block-interval bars against
// target, a fee/B "supply curve" against the block-weight limit, a hashrate
// area series) plus dense text panels (recent blocks, fee/age percentiles,
// tx composition, a per-tier pool breakdown, top payers) to carry the
// verify-memviews.mjs scenario-9 density floor from a measured 97 readouts
// to >= 300. Every added figure is real, derived from `data` — nothing here
// is decorative padding.
//
// Charts use `useChartMetrics` in FLUID mode (no `vbWidth`): the viewBox
// width tracks the measured CSS width, so `fontSize={fs.tick}` renders at
// its true pixel size rather than being silently shrunk by a transform (see
// claude/V2-VIEW-CONFORMANCE.md §8). Terminal carries no `.mp-fit` wrapper at
// all (FitView.tsx: "Classic/Terminal are rendered directly by MempoolPage
// without this wrapper"), so the main column below is capped at 780px
// (`maxWidth`) instead — the same §8 caption hazard in its pan-mode form:
// an uncapped node here would silently widen `.mp-view`'s max-content box
// past the ~1180px canvas budget at 1440 and force an UNWANTED desktop pan
// (measured budget: 1180 − 320 rail − 12 gap − 40 padding = 808; 780 leaves
// ~28px slack). The forced-900px mobile rule (styles.css `.mp-canvas-scroll
// > *:not(.mp-view--fit)`) is what makes the REQUIRED 390px pan happen
// regardless of this cap — the two constraints are independent and both
// satisfied.
//
// Every chart mounts the SAME `<div ref={…}>` wrapper on every branch
// (loading / empty / low-pool / populated) and only swaps what's INSIDE it —
// `useChartMetrics` measures via a `useLayoutEffect` keyed on the ref
// OBJECT, which only fires once, so a component that ever returns a
// different root loses its ResizeObserver forever (this shipped as a real
// bug in v6.0.12; see CLAUDE.md). No chart, axis, tip or series is gated on
// `!reduced` — reduced motion removes loops, never data, and none of these
// three charts loop.
//
// All helpers prefixed `Term` to avoid shared-scope collisions.

/* ── self-typing command palette (real RPC outputs) ─────────── */
function TermPalette({ data }: { data: MoneroLive }) {
  const reduced = useReducedMotion();
  // Hoisted rather than called inline in the dep array below: a dep entry has to
  // be readable at a glance, and a call expression there reads like a new
  // subscription rather than the plain boolean it is.
  const ready = hasData(data.status.network);
  const cmds = React.useMemo(() => {
    if (!ready) return [] as { q: string; rows: string[][] }[];
    const b = data.blocks[0];
    const pool = data.mempool.slice(0, 2);
    return [
      { q: "get_info", rows: [["INFO", `height ${data.height.toLocaleString()}`, `diff ${data.difficulty.toLocaleString()}`]] },
      { q: "get_last_block_header", rows: [b ? ["BLOCK", `#${b.height.toLocaleString()} ${shortHash(b.hash)}`, `txs=${b.txs}`] : ["BLOCK", "—", ""]] },
      { q: "get_fee_estimate", rows: [["FEE", data.feeTiers.length === 4 ? data.feeTiers.map((t) => Math.round(t)).join(" / ") : "—", "pcn/B · slow→fastest"]] },
      { q: "print_pool", rows: pool.length ? pool.map((t) => ["TX", shortHash(t.id), `${Math.round(t.perB)} pcn/B · ${t.size} B`]) : [["POOL", "—", "pool empty"]] },
    ];
  }, [ready, data.height, data.difficulty, data.mempool, data.blocks, data.feeTiers]);
  const [ci, setCi] = React.useState(0);
  const [typed, setTyped] = React.useState("");
  const [phase, setPhase] = React.useState("typing"); // typing → hold → clearing
  // v6.0.8: the typewriter is a setTimeout chain in an effect that re-arms on
  // every character — during `clearing` that was a ~42Hz React render loop
  // (24ms/char), running in hidden tabs, for a decorative prompt animation.
  //
  // Two gates:
  //   `paused`  — usePageActive(). Nobody is reading a terminal in a tab they
  //               can't see. It resumes mid-word exactly where it stopped,
  //               because the phase/typed state is untouched by the pause.
  //   `charMs`  — per-tier floor. On `low` the per-character cadence relaxes
  //               so the effect re-runs 12×/sec instead of 42×/sec; the
  //               animation reads the same, just less frantically.
  //
  // v6.1.3 audit adds a third gate, `reduced`, and it is the one the audit's own
  // animation census could not see: the typewriter is a setTimeout chain, not a
  // CSS animation or a SMIL <animate>, so it does not appear in
  // `getAnimations()` at all. It was looping indefinitely under reduce.
  //
  // Freezing it needs the same care as view-tags/stealth/fcmp: the natural still
  // frame is `typed=""`, `phase="typing"`, which renders an empty prompt over
  // "querying daemon…" — a terminal that never answers. So the reduce path parks
  // at the state the cycle LANDS on instead: the full command echoed, and its
  // real daemon rows shown. Same information, no motion.
  const paused = !usePageActive();
  const tier = getDeviceTier();
  const charScale = byTier(tier, { high: 1, mid: 1.6, low: 3.5 });
  React.useEffect(() => {
    if (!cmds.length || paused || reduced) return;
    const full = cmds[ci % cmds.length].q;
    let to: ReturnType<typeof setTimeout> | undefined;
    if (phase === "typing") {
      // Index-derived cadence, not a dice roll: still reads as human typing, but
      // the same keystroke always takes the same time, so it is reproducible.
      // charScale (v6.0.8 device tiering) still applies on top.
      if (typed.length < full.length) to = setTimeout(() => setTyped(full.slice(0, typed.length + 1)), (55 + ((typed.length * 37) % 60)) * charScale);
      else to = setTimeout(() => setPhase("hold"), 1600);
    } else if (phase === "hold") {
      to = setTimeout(() => setPhase("clearing"), 1400);
    } else {
      if (typed.length > 0) to = setTimeout(() => setTyped(typed.slice(0, -1)), 24 * charScale);
      else { setPhase("typing"); setCi((c) => (c + 1) % cmds.length); }
    }
    return () => clearTimeout(to);
  }, [typed, phase, ci, cmds, paused, charScale, reduced]);
  const showResults = cmds.length > 0 && (reduced || phase === "hold");
  const shownTyped = reduced && cmds.length ? cmds[ci % cmds.length].q : typed;
  return (
    <div style={{ border: "1px solid var(--tk-accent)", background: "var(--surface-raised)", boxShadow: "0 0 24px color-mix(in srgb, var(--accent-structural) 22%, transparent), inset 0 0 30px color-mix(in srgb, var(--accent-structural) 5%, transparent)", borderRadius: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", padding: "var(--sp-2) var(--sp-3)", borderBottom: "1px solid var(--rule)", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)" }}>
        <span style={{ color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>›</span>
        <span style={{ color: "var(--ink-100)" }}>{shownTyped}</span>
        {/* D0651: term-blink 1s steps(2) — a terminal cursor blink rate, same category as
            styles.css's calc(1.4s/…) LED pulse and .footer-tele .blink; steps() has no
            --e-* analogue (all four tokens are cubic-bezier curves). Left fully literal.
            v6.1.3 audit: gated on `reduced`. The caret stays RENDERED and solid — that is
            exactly what a terminal cursor looks like between blinks — so the "live shell"
            affordance survives; only the loop goes. */}
        <span style={{ width: 8, height: 16, background: "var(--tk-accent)", boxShadow: "var(--glow-1)", animation: reduced ? undefined : "term-blink 1s steps(2) infinite", display: "inline-block" }} />
        <span style={{ marginLeft: "auto", color: "var(--ink-40)", fontSize: "var(--fs-mono)" }}>⌘K · ESC</span>
      </div>
      <div style={{ padding: "var(--sp-2)", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", minHeight: 96 }}>
        {(showResults ? cmds[ci % cmds.length].rows : []).map((r, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1.1fr 18px", gap: "var(--sp-2)", padding: "var(--sp-1) var(--sp-2)", background: i === 0 ? "color-mix(in srgb, var(--accent-structural) 12%, transparent)" : "transparent", borderLeft: i === 0 ? "2px solid var(--tk-accent)" : "2px solid transparent", animation: "term-slidein var(--d-3) var(--e-standard)" /* D0651: 0.25s → --d-3 */ }}>
            <span className="dim2" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.1em" }}>{r[0]}</span>
            <span className={i === 0 ? "acc" : ""}>{r[1]}</span>
            <span className="dim">{r[2]}</span>
            <span className="dim2" style={{ textAlign: "right" }}>{i === 0 ? "↵" : ""}</span>
          </div>
        ))}
        {!showResults ? <div className="dim2" style={{ padding: "var(--sp-6) var(--sp-2)", textAlign: "center", letterSpacing: "0.14em" }}>{!cmds.length || phase === "typing" ? "querying daemon…" : "—"}</div> : null}
      </div>
      <style>{`@keyframes term-blink { 0%,50% { opacity: 1; } 50.01%,100% { opacity: 0; } } @keyframes term-slidein { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

/* ── reactive ASCII block stream ────────────────────────────── */
export function TermAsciiBlocks({ data, trackedTxId, trackedHeight }: { data: MoneroLive; trackedTxId?: string | null; trackedHeight?: number | null }) {
  // v6.1.3 audit: term-flash marked the newest block and ran under reduce. The
  // newest block is ALSO the leftmost column and the only one whose conf row
  // reads "0c", so dropping the pulse loses no way to identify it.
  const reduced = useReducedMotion();
  const cols: Block[] = data.blocks.slice(0, 13);
  const rowsMax = 18;
  const cell = (
    label: string | null,
    q: boolean,
    txs = 0,
    height = 0,
    conf = 0,
    sizeKB = 0,
    newest = false,
  ) => {
    const tracked = !q && trackedHeight != null && height === trackedHeight;
    const filled = q ? 0 : Math.min(rowsMax - 2, 2 + Math.floor((txs / 140) * (rowsMax - 4)));
    const empty = rowsMax - filled - 2;
    const ascii = q
      ? "┌──┐\n" + "│  │\n".repeat(rowsMax - 3) + `│ ${label} │\n` + "└──┘"
      : "┌──┐\n" + "│  │\n".repeat(empty) + "██\n".repeat(filled) + "└──┘";
    return (
      <div data-tracked-tx={tracked ? trackedTxId : undefined} data-tracked-block={tracked ? height : undefined} style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", color: "var(--ink-80)" }}>
        <div style={{ textAlign: "center", marginBottom: "var(--sp-1)", color: q ? "var(--ink-40)" : tracked ? "var(--y-50)" : "var(--tk-accent)", textShadow: q ? "none" : tracked ? "0 0 6px var(--y-50)" : "var(--glow-1)" }}>
          {q ? "~+" + label : (tracked ? "▲" : "") + height.toString().slice(-3)}
        </div>
        {/* D0651: term-flash 1.4s — an ambient "this block is newest" signal, same 1.4s
            cadence as styles.css's global LED pulse; not an interaction. Literal. */}
        <pre style={{ margin: 0, lineHeight: 1, fontSize: "var(--fs-mono)", color: tracked ? "var(--y-50)" : "var(--tk-accent)", textShadow: newest ? "0 0 9px color-mix(in srgb, var(--accent-data) 70%, transparent)" : tracked ? "0 0 7px color-mix(in srgb, var(--status-warn) 50%, transparent)" : "0 0 6px color-mix(in srgb, var(--accent-data) 40%, transparent)", animation: newest && !reduced ? "term-flash 1.4s ease-in-out infinite" : "none" }}>{ascii}</pre>
        <div style={{ textAlign: "center", marginTop: "var(--sp-1)", color: q ? "var(--ink-40)" : tracked ? "var(--y-50)" : "var(--ink-60)" }}>{q ? "0 tx" : txs + "t"}</div>
        {!q ? <div style={{ textAlign: "center", color: tracked ? "var(--y-50)" : "var(--ink-40)", fontSize: "var(--fs-label)" }}>{sizeKB.toFixed(0)}K · {conf}c</div> : null}
        {tracked ? <div style={{ textAlign: "center", color: "var(--y-50)", fontSize: "var(--fs-label)" }}>{confOf(height, data)}/{CONF_UNLOCK}</div> : null}
      </div>
    );
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols.length + 2}, 1fr)`, gap: "var(--sp-2)", padding: "var(--sp-2) 0", overflowX: "auto" }}>
      {cell("2", true)}{cell("N", true)}
      {cols.map((b, i) => <React.Fragment key={b.height}>{cell(null, false, b.txs, b.height, b.conf, b.sizeKB, i === 0)}</React.Fragment>)}
      <style>{`@keyframes term-flash { 0%,100% { opacity: 1; } 50% { opacity: 0.65; } }`}</style>
    </div>
  );
}

/* ── live auto-tailing log · real feed diffs ────────────────── */
function TermLiveLog({ data, trackedTx }: {
  data: MoneroLive;
  trackedTx?: { id: string; blockHeight: number | null; conf: number } | null;
}) {
  const events = useFeedEvents(data, 16);
  const fmtTs = (ts: number) => new Date(ts).toTimeString().slice(0, 8);
  const line = (e: FeedEvent): { lvl: string; cat: string; msg: string } => {
    switch (e.kind) {
      case "block": return { lvl: "I", cat: "core", msg: `block #${e.height} ${e.hash.slice(0, 8)}… txs=${e.txs} ${e.sizeKB.toFixed(1)}KB` };
      case "tx": return { lvl: "I", cat: "txpool", msg: `tx ${e.id.slice(0, 8)}… ${e.size}B fee=${e.fee.toFixed(6)} rate=${Math.round(e.perB)} pcn/B` };
      case "txdrop": return { lvl: "I", cat: "txpool", msg: `${e.count} tx left pool (mined/expired)` };
      case "stale": return { lvl: "W", cat: "net", msg: "feed stale · retrying" };
      case "recover": return { lvl: "I", cat: "net", msg: "feed recovered" };
    }
  };
  const colorFor = (lvl: string, cat?: string) => lvl === "W" ? "var(--y-50)" : lvl === "E" ? "var(--r-50)" : cat === "core" ? "var(--tk-accent)" : cat === "txpool" ? "var(--c-50)" : cat === "net" ? "var(--g-50)" : "var(--ink-60)";
  // Pinned first row for a tracked tx, formatted like the surrounding log
  // lines — real state (in_pool vs. resolved height/conf), never simulated.
  const trackedMsg = trackedTx
    ? (trackedTx.blockHeight != null
        ? `tx ${trackedTx.id.slice(0, 8)}… height=${trackedTx.blockHeight} conf=${trackedTx.conf}/${CONF_UNLOCK}`
        : `tx ${trackedTx.id.slice(0, 8)}… in_pool`)
    : null;
  return (
    <div style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", lineHeight: 1.5 }}>
      {trackedTx && trackedMsg ? (
        <div data-tracked-tx={trackedTx.id} data-tracked-block={trackedTx.blockHeight ?? undefined}
          style={{ display: "grid", gridTemplateColumns: "16px 70px 56px 1fr", gap: "var(--sp-2)", padding: "1px 0", color: "var(--y-50)" }}>
          <span style={{ fontWeight: 600 }}>I</span>
          <span style={{ opacity: 0.85 }}>{fmtTs(Date.now())}</span>
          <span>track</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{trackedMsg}</span>
        </div>
      ) : null}
      {events.length === 0 ? (
        <div className="dim2" style={{ padding: "var(--sp-2) 0", letterSpacing: "0.12em" }}>waiting for feed…</div>
      ) : events.map((e, i) => {
        const l = line(e);
        return (
          <div key={`${e.ts}-${i}`} style={{ display: "grid", gridTemplateColumns: "16px 70px 56px 1fr", gap: "var(--sp-2)", padding: "1px 0", animation: "term-logslide var(--d-3) var(--e-standard)" /* D0651: 0.35s → --d-3 */ }}>
            <span style={{ color: colorFor(l.lvl), fontWeight: 600 }}>{l.lvl}</span>
            <span className="dim2">{fmtTs(e.ts)}</span>
            <span style={{ color: colorFor(l.lvl, l.cat) }}>{l.cat}</span>
            <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.msg}</span>
          </div>
        );
      })}
      <style>{`@keyframes term-logslide { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

/* ── live ASCII fee histogram ───────────────────────────────── */
export function TermFeeHisto({ data }: { data: MoneroLive }) {
  // No tick here: the bins are a pure function of `data.mempool`, which already
  // changes on the 2.5s feed poll — a `useTick(1200)` used to be a dep of this
  // memo but nothing about the histogram is time-based, so it just forced an
  // extra recompute + re-render 0.83x/sec for free (v6.0.8 perf pass).
  const bins = React.useMemo(() => {
    const b = new Array(11).fill(0);
    data.mempool.forEach((t) => { const i = Math.min(10, Math.floor(t.perB / 4e4)); b[i] += 1; });
    return b;
  }, [data.mempool]);
  const max = Math.max(...bins, 1);
  const medianBin = bins.indexOf(Math.max(...bins));
  const bar = (v: number) => "█".repeat(Math.round((v / max) * 24));
  return (
    <pre style={{ margin: 0, fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", lineHeight: 1.5, color: "var(--tk-accent)", textShadow: "0 0 4px color-mix(in srgb, var(--accent-data) 40%, transparent)" }}>
      {bins.map((v, i) => `${String(i * 40).padStart(3, " ")} |${bar(v).padEnd(24, " ")} ${String(v).padStart(3, " ")}${i === medianBin ? "  ← median" : ""}`).join("\n")}
      <div className="dim" style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", marginTop: "var(--sp-1)" }}>fee in piconero/byte · {data.mempool.length} tx sample</div>
    </pre>
  );
}

/* ── compact radial gauge ───────────────────────────────────── */
export function TermGauge({ value, label, color = "var(--tk-accent)", size = 84 }: any) {
  const r = size / 2 - 8, c = size / 2, ring = 2 * Math.PI * r, dash = ring * (value / 100) * 0.75;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ display: "block", maxWidth: size, aspectRatio: `${size} / ${size * 0.78}` }}>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line)" strokeWidth="5" strokeDasharray={ring * 0.75 + " " + ring} transform={`rotate(135 ${c} ${c})`} strokeLinecap="round" />
        <circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth="5" strokeDasharray={dash + " " + ring} transform={`rotate(135 ${c} ${c})`} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
        <text x={c} y={c + 2} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="15" fontWeight="500" fill={color}>{value}</text>
      </svg>
      <div className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.16em", color: "var(--ink-40)", marginTop: -2 }}>{label}</div>
    </div>
  );
}

/* ═══════════════════ v2 density additions ═══════════════════ */

/* ── pure derivations — no fabrication, everything from `data` ── */

const sortedNums = (a: number[]): number[] => [...a].sort((x, y) => x - y);

function percentileOf(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[i];
}

function medianOf(arr: number[]): number | null {
  if (!arr.length) return null;
  const s = sortedNums(arr);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function fieldStats(arr: number[]): { n: number; mean: number; min: number; max: number } | null {
  return arr.length ? { n: arr.length, mean: arr.reduce((a, b) => a + b, 0) / arr.length, min: Math.min(...arr), max: Math.max(...arr) } : null;
}

interface TermInterval { height: number; interval: number; txs: number; sizeKB: number }

/** The interval that produced `blocks[i]` is `blocks[i+1].age − blocks[i].age`
 *  (blocks is NEWEST-FIRST, age grows with distance from the tip, so this is
 *  always >= 0). Returned oldest → newest, matching how the chart draws. */
function blockIntervals(blocks: Block[], cap = 13): TermInterval[] {
  const w = blocks.slice(0, cap);
  const out: TermInterval[] = [];
  for (let i = 0; i < w.length - 1; i++) {
    out.push({ height: w[i].height, interval: w[i + 1].age - w[i].age, txs: w[i].txs, sizeKB: w[i].sizeKB });
  }
  return out.reverse();
}

interface TermFeePoint { perB: number; cum: number; n: number }

/** Highest fee/B first, cumulative bytes as we go — the marginal fee to clear
 *  the next block is where `cum` crosses the block-weight limit. */
function feeCurvePoints(mempool: Tx[]): TermFeePoint[] {
  const sorted = [...mempool].sort((a, b) => b.perB - a.perB);
  let cum = 0;
  return sorted.map((t, i) => { cum += t.size; return { perB: t.perB, cum, n: i + 1 }; });
}

/** Linear interpolation between the two points flanking the limit — an honest
 *  reading of where a REAL sample crosses a real threshold, not a synthesis. */
function feeCrossing(points: TermFeePoint[], limit: number): { perB: number; n: number } | null {
  if (!limit || !points.length || points[points.length - 1].cum < limit) return null;
  for (let i = 0; i < points.length; i++) {
    if (points[i].cum >= limit) {
      const prev = points[i - 1];
      if (!prev) return { perB: points[i].perB, n: points[i].n };
      const frac = (limit - prev.cum) / (points[i].cum - prev.cum);
      return { perB: prev.perB + (points[i].perB - prev.perB) * frac, n: points[i].n };
    }
  }
  return null;
}

/** Shared chart plumbing: a wrapper ref measured by `useChartMetrics` (fluid —
 *  no `vbWidth`, so `k===1` and one user unit is one CSS px) plus the
 *  `useSvgCursor` hover primitive at that same measured width. ONE hook, not
 *  three copies — bundle headroom on this repo is 11.5KB. */
function useTermChartBase() {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const m = useChartMetrics(wrapRef);
  const vw = m.w || VB_W;
  const [svgRef, vx, handlers] = useSvgCursor(vw);
  return { wrapRef, m, vw, svgRef, vx, handlers };
}

/** Generic dense text table — every new density panel below is one of these.
 *  Reused rather than five bespoke renderers, for the same bundle-budget
 *  reason `useTermChartBase` is one hook: `head`/`rows`/`cols` is the whole
 *  contract. */
function TermTable({ head, rows, cols }: { head: string[]; rows: React.ReactNode[][]; cols: string }) {
  return (
    <div style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)" }}>
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: "var(--sp-2)", paddingBottom: "var(--sp-1)", borderBottom: "1px solid var(--rule)", color: "var(--ink-40)", fontSize: "var(--fs-label)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {head.map((h, i) => <span key={i}>{h}</span>)}
      </div>
      {rows.length ? rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: cols, gap: "var(--sp-2)", padding: "2px 0", borderBottom: i < rows.length - 1 ? "1px solid var(--line-d)" : "none" }}>
          {r.map((c, j) => <span key={j} className={j === 0 ? "dim2" : "dim"}>{c}</span>)}
        </div>
      )) : (
        <div className="dim2" style={{ padding: "var(--sp-2) 0" }}>—</div>
      )}
    </div>
  );
}

/* ── $ blocktime --series — inter-block intervals against the target ──── */
function TermBlockTimeChart({ data }: { data: MoneroLive }) {
  const { wrapRef, m, vw, svgRef, vx, handlers } = useTermChartBase();
  const target = data.blockTarget || 120;
  const ivs = React.useMemo(() => blockIntervals(data.blocks), [data.blocks]);
  const n = ivs.length;
  const H = 178, padL = 40, padR = 10, padT = 14, padB = 24;
  const innerW = Math.max(1, vw - padL - padR), innerH = H - padT - padB;
  const maxV = Math.max(target, ...ivs.map((i) => i.interval), 1) * 1.12;
  const slot = n ? innerW / n : innerW;
  const bw = slot * 0.68;
  const xOf = (i: number) => padL + i * slot + slot * 0.16;
  const yOf = (v: number) => padT + innerH - (v / maxV) * innerH;
  const idx = n && vx != null ? Math.max(0, Math.min(n - 1, Math.floor((vx - padL) / slot))) : null;
  const hov = idx != null ? ivs[idx] : null;
  const yN = tickCount(innerH, m.fs.tick);
  const yTicks = Array.from({ length: yN }, (_, i) => (maxV * i) / Math.max(1, yN - 1));
  const xStep = n ? labelStep(n, innerW, m.fs.tick, 4) : 1;
  const stats = React.useMemo(() => {
    if (!n) return null;
    const vals = sortedNums(ivs.map((i) => i.interval));
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const median = medianOf(vals)!;
    const max = vals[vals.length - 1];
    const over = ivs.filter((i) => i.interval > target).length;
    return { mean, median, max, over };
  }, [ivs, target, n]);

  return (
    <PanelFrame title="$ blocktime --series" right={<NodeProvenance source="node" keys={["blocks"]} status={data.status} />} updatedAt={oldestFreshAt(data.status, ["blocks"])}>
      <div ref={wrapRef} style={{ position: "relative" }}>
        {m.ready && n > 0 ? (
          <svg ref={svgRef} width="100%" viewBox={`0 0 ${vw} ${H}`} style={{ display: "block", touchAction: "pan-y" }} {...handlers}>
            {yTicks.map((v, i) => (
              <g key={"y" + i}>
                <line x1={padL} x2={padL + innerW} y1={yOf(v)} y2={yOf(v)} stroke={GRID} strokeDasharray="2 3" />
                <text x={padL - 4} y={yOf(v) + 3} textAnchor="end" fontFamily="var(--f-mono)" fontSize={m.fs.tick} fill={AXIS}>{fmtMMSS(v)}</text>
              </g>
            ))}
            <line x1={padL} x2={padL + innerW} y1={yOf(target)} y2={yOf(target)} stroke="var(--p-50)" strokeDasharray="4 3" strokeWidth={1} />
            <text x={padL + innerW} y={Math.max(padT + 8, yOf(target) - 4)} textAnchor="end" fontFamily="var(--f-mono)" fontSize={m.fs.label} fill="var(--p-50)">target {fmtMMSS(target)}</text>
            {/* STRIDE ONLY — no `|| i === n - 1`. Forcing the final label
                unconditionally is the defect #167 removed from charts.tsx and
                contract §3 records: the strided sequence leaves room for itself
                by construction (labelStep derives the stride from the same
                estTextW), but a forced final label collides with the last
                strided one whenever (n-1) is not a multiple of the stride.
                charts.tsx:1049-1066 keeps the final label behind a clearance
                check; the two simpler series (:334, :781) just drop it, which
                is what these charts do — the newest interval is already the
                rightmost bar and readable from the tip. */}
            {ivs.map((iv, i) => (i % xStep === 0) ? (
              <text key={"xl" + i} x={xOf(i) + bw / 2} y={H - 6} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={m.fs.tick} fill={AXIS}>{String(iv.height).slice(-4)}</text>
            ) : null)}
            {ivs.map((iv, i) => (
              <rect key={i} x={xOf(i)} y={yOf(iv.interval)} width={bw} height={Math.max(0, padT + innerH - yOf(iv.interval))} fill={iv.interval > target ? "var(--y-50)" : "var(--tk-accent)"} opacity={idx === i ? 1 : 0.82} />
            ))}
            {hov ? <ChartCrosshair x={xOf(idx!) + bw / 2} y1={padT} y2={padT + innerH} /> : null}
            {hov ? (
              <ChartTip x={xOf(idx!) + bw / 2} bounds={{ left: padL, right: padL + innerW }} rows={[
                { label: "height", value: hov.height.toLocaleString() },
                { label: "interval", value: fmtMMSS(hov.interval) },
                { label: "txs", value: String(hov.txs) },
                { label: "size", value: hov.sizeKB.toFixed(0) + "K" },
              ]} />
            ) : null}
          </svg>
        ) : (
          <div className="dim2 mono" style={{ padding: "var(--sp-5)", textAlign: "center", fontSize: "var(--fs-mono)" }}>{m.ready ? "insufficient block history" : ""}</div>
        )}
      </div>
      {stats ? (
        <div className="mono" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--sp-2)", marginTop: "var(--sp-2)", fontSize: "var(--fs-mono)" }}>
          <span className="dim">mean <span className="acc">{fmtMMSS(stats.mean)}</span></span>
          <span className="dim">median <span className="acc">{fmtMMSS(stats.median)}</span></span>
          <span className="dim">max <span className="acc">{fmtMMSS(stats.max)}</span></span>
          <span className="dim">over target <span className="acc">{stats.over}/{n}</span></span>
        </div>
      ) : null}
      {n ? (
        <div style={{ marginTop: "var(--sp-3)" }}>
          <TermTable head={["H", "INTERVAL", "Δ TARGET"]} cols="72px 76px 96px" rows={ivs.map((iv) => [
            iv.height.toLocaleString(),
            fmtMMSS(iv.interval),
            (iv.interval - target >= 0 ? "+" : "−") + fmtMMSS(Math.abs(iv.interval - target)),
          ])} />
        </div>
      ) : null}
    </PanelFrame>
  );
}

/* ── $ pool --fee-curve — the marginal fee to clear the next block ─────── */
function TermFeeCurveChart({ data }: { data: MoneroLive }) {
  const { wrapRef, m, vw, svgRef, vx, handlers } = useTermChartBase();
  const points = React.useMemo(() => feeCurvePoints(data.mempool), [data.mempool]);
  const limit = data.blockWeightLimit || 0;
  const totalBytes = points.length ? points[points.length - 1].cum : 0;
  const maxFee = points.length ? points[0].perB : 1;
  const H = 224, padL = 54, padR = 14, padT = 16, padB = 26;
  const innerW = Math.max(1, vw - padL - padR), innerH = H - padT - padB;
  const yMax = Math.max(totalBytes, limit, 1) * 1.06;
  const xOf = (perB: number) => padL + innerW * (1 - (maxFee > 0 ? perB / maxFee : 0));
  const yOf = (cum: number) => padT + innerH - (cum / yMax) * innerH;
  const crossing = feeCrossing(points, limit);
  const gradId = useGradientId("term-fee");

  let hover: TermFeePoint | null = null;
  if (vx != null && points.length) {
    let bestD = Infinity;
    for (const p of points) { const d = Math.abs(xOf(p.perB) - vx); if (d < bestD) { bestD = d; hover = p; } }
  }

  const path = points.length ? "M " + points.map((p) => `${xOf(p.perB)},${yOf(p.cum)}`).join(" L ") : "";
  const area = path ? `${path} L ${xOf(0)},${padT + innerH} L ${xOf(maxFee)},${padT + innerH} Z` : "";
  const yN = tickCount(innerH, m.fs.tick);
  const yTicks = Array.from({ length: yN }, (_, i) => (yMax * i) / Math.max(1, yN - 1));
  const xN = Math.min(5, tickCount(innerW, m.fs.tick * 2.2));
  const xTicks = Array.from({ length: xN }, (_, i) => maxFee - (maxFee * i) / Math.max(1, xN - 1));
  const crossLabelX = crossing ? Math.max(padL + 46, Math.min(padL + innerW - 10, xOf(crossing.perB))) : 0;

  return (
    <PanelFrame title="$ pool --fee-curve" right={<NodeProvenance source="node" also="session" keys={["mempool", "network"]} status={data.status} />} updatedAt={oldestFreshAt(data.status, ["mempool", "network"])}>
      <div ref={wrapRef} style={{ position: "relative" }}>
        {m.ready ? (
          points.length ? (
            <svg ref={svgRef} width="100%" viewBox={`0 0 ${vw} ${H}`} style={{ display: "block", touchAction: "pan-y" }} {...handlers}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--tk-accent)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--tk-accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {yTicks.map((v, i) => (
                <g key={"y" + i}>
                  <line x1={padL} x2={padL + innerW} y1={yOf(v)} y2={yOf(v)} stroke={GRID} strokeDasharray="2 3" />
                  <text x={padL - 4} y={yOf(v) + 3} textAnchor="end" fontFamily="var(--f-mono)" fontSize={m.fs.tick} fill={AXIS}>{fmtBytes(v)}</text>
                </g>
              ))}
              {xTicks.map((v, i) => (
                <text key={"x" + i} x={xOf(v)} y={H - 6} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={m.fs.tick} fill={AXIS}>{Math.round(v)}</text>
              ))}
              {limit ? <line x1={padL} x2={padL + innerW} y1={yOf(limit)} y2={yOf(limit)} stroke="var(--p-50)" strokeDasharray="4 3" /> : null}
              {limit ? <text x={padL + 2} y={Math.max(padT + 10, yOf(limit) - 4)} fontFamily="var(--f-mono)" fontSize={m.fs.label} fill="var(--p-50)">block limit {fmtBytes(limit)}</text> : null}
              <path d={area} fill={`url(#${gradId})`} />
              <path d={path} fill="none" stroke="var(--tk-accent)" strokeWidth="1.4" />
              {crossing ? (
                <>
                  <line x1={xOf(crossing.perB)} x2={xOf(crossing.perB)} y1={padT} y2={padT + innerH} stroke="var(--y-50)" strokeDasharray="3 3" />
                  <text x={crossLabelX} y={padT + innerH / 2} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={m.fs.label} fill="var(--y-50)">marginal {Math.round(crossing.perB).toLocaleString()} p/B</text>
                </>
              ) : null}
              {hover ? (
                <>
                  <ChartCrosshair x={xOf(hover.perB)} y1={padT} y2={padT + innerH} />
                  <ChartTip x={xOf(hover.perB)} bounds={{ left: padL, right: padL + innerW }} rows={[
                    { label: "fee/B", value: Math.round(hover.perB).toLocaleString() },
                    { label: "cum", value: fmtBytes(hover.cum) },
                    { label: "n", value: String(hover.n) },
                  ]} />
                </>
              ) : null}
            </svg>
          ) : (
            <div className="dim2 mono" style={{ padding: "var(--sp-5)", textAlign: "center", fontSize: "var(--fs-mono)" }}>mempool empty</div>
          )
        ) : null}
      </div>
      <div className="mono" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--sp-2)", marginTop: "var(--sp-2)", fontSize: "var(--fs-mono)" }}>
        <span className="dim">pool <span className="acc">{fmtBytes(totalBytes)}</span></span>
        <span className="dim">limit <span className="acc">{limit ? fmtBytes(limit) : "—"}</span></span>
        <span className="dim">{crossing ? <>clears at <span className="acc">{Math.round(crossing.perB).toLocaleString()} p/B</span></> : <span className="acc">pool below one block — any tier clears</span>}</span>
      </div>
    </PanelFrame>
  );
}

/* ── $ hashrate --series ─────────────────────────────────────────────── */
function TermHashrateChart({ data }: { data: MoneroLive }) {
  const { wrapRef, m, vw, svgRef, vx, handlers } = useTermChartBase();
  const series = data.hashSeries || [];
  const n = series.length;
  const H = 152, padL = 54, padR = 12, padT = 12, padB = 22;
  const innerW = Math.max(1, vw - padL - padR), innerH = H - padT - padB;
  const min = n ? Math.min(...series) : 0, max = n ? Math.max(...series) : 1;
  const rng = max - min || 1;
  const xOf = (i: number) => padL + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2);
  const yOf = (v: number) => padT + innerH - ((v - min) / rng) * innerH;
  const gradId = useGradientId("term-hash");
  const path = n ? "M " + series.map((v, i) => `${xOf(i)},${yOf(v)}`).join(" L ") : "";
  const area = path ? `${path} L ${xOf(n - 1)},${padT + innerH} L ${xOf(0)},${padT + innerH} Z` : "";
  const idx = n >= 2 && vx != null ? Math.max(0, Math.min(n - 1, Math.round(((vx - padL) / innerW) * (n - 1)))) : null;
  const yN = tickCount(innerH, m.fs.tick);
  const yTicks = Array.from({ length: yN }, (_, i) => min + (rng * i) / Math.max(1, yN - 1));
  const xN = n ? Math.min(6, tickCount(innerW, m.fs.tick * 1.6)) : 0;
  const xStepI = xN > 1 ? Math.max(1, Math.round((n - 1) / (xN - 1))) : 1;

  return (
    <PanelFrame title="$ hashrate --series" right={<NodeProvenance source="node" keys={["network"]} status={data.status} />} updatedAt={oldestFreshAt(data.status, ["network"])}>
      <div className="mono" style={{ display: "flex", gap: "var(--sp-4)", marginBottom: "var(--sp-2)", fontSize: "var(--fs-mono)" }}>
        <span className="dim">rate <span className="acc">{hasData(data.status.network) ? (data.hashrate / 1e9).toFixed(2) + " GH/s" : "—"}</span></span>
        <span className="dim">diff <span className="acc">{hasData(data.status.network) ? data.difficulty.toLocaleString() : "—"}</span></span>
      </div>
      <div ref={wrapRef} style={{ position: "relative" }}>
        {m.ready ? (
          n >= 2 ? (
            <svg ref={svgRef} width="100%" viewBox={`0 0 ${vw} ${H}`} style={{ display: "block", touchAction: "pan-y" }} {...handlers}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--c-50)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--c-50)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {yTicks.map((v, i) => (
                <g key={i}>
                  <line x1={padL} x2={padL + innerW} y1={yOf(v)} y2={yOf(v)} stroke={GRID} strokeDasharray="2 3" />
                  <text x={padL - 4} y={yOf(v) + 3} textAnchor="end" fontFamily="var(--f-mono)" fontSize={m.fs.tick} fill={AXIS}>{(v / 1e9).toFixed(2)}</text>
                </g>
              ))}
              {/* stride only — see the note in TermBlockTimeChart */}
              {series.map((_, i) => (i % xStepI === 0) ? (
                <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={m.fs.tick} fill={AXIS}>{i}</text>
              ) : null)}
              <path d={area} fill={`url(#${gradId})`} />
              <path d={path} fill="none" stroke="var(--c-50)" strokeWidth="1.4" />
              {idx != null ? (
                <>
                  <ChartCrosshair x={xOf(idx)} y1={padT} y2={padT + innerH} />
                  <ChartTip x={xOf(idx)} bounds={{ left: padL, right: padL + innerW }} rows={[
                    { label: "sample", value: String(idx) },
                    { label: "GH/s", value: (series[idx] / 1e9).toFixed(2) },
                  ]} />
                </>
              ) : null}
            </svg>
          ) : (
            <div className="dim2 mono" style={{ padding: "var(--sp-5)", textAlign: "center", fontSize: "var(--fs-mono)" }}>awaiting series</div>
          )
        ) : null}
      </div>
    </PanelFrame>
  );
}

/* ── $ pool --by-tier — per fee-tier breakdown + top payers ────────────── */
function TermPoolByTier({ data }: { data: MoneroLive }) {
  const ok = hasData(data.status.network) && data.feeTiers.length === 4;
  const rows = FEE_TIER_LABELS.map((label, i) => {
    if (!ok) return [label, "—", "—", "—", "—"];
    const inTier = data.mempool.filter((t) => feeTierIndex(t.perB, data.feeTiers) === i);
    const bytes = inTier.reduce((a, t) => a + t.size, 0);
    const pct = data.mempool.length ? (inTier.length / data.mempool.length) * 100 : 0;
    const med = medianOf(inTier.map((t) => t.perB));
    return [label, String(inTier.length), fmtBytes(bytes), pct.toFixed(1) + "%", med != null ? Math.round(med).toLocaleString() : "—"];
  });
  const top = [...data.mempool].sort((a, b) => b.perB - a.perB).slice(0, 8);
  return (
    <PanelFrame title="$ pool --by-tier" right={<NodeProvenance source="node" keys={["mempool", "fees"]} status={data.status} />} updatedAt={oldestFreshAt(data.status, ["mempool", "fees"])}>
      <TermTable head={["TIER", "COUNT", "BYTES", "% POOL", "MED P/B"]} cols="66px 56px 62px 56px 82px" rows={rows} />
      <div className="kicker" style={{ margin: "var(--sp-3) 0 var(--sp-1)" }}>TOP PAYERS</div>
      <TermTable head={["#", "TXID", "FEE/B", "SIZE"]} cols="22px 1fr 72px 62px" rows={top.map((t, i) => [
        String(i + 1), shortHash(t.id), Math.round(t.perB).toLocaleString(), fmtBytes(t.size),
      ])} />
    </PanelFrame>
  );
}

/* ── $ blocks --recent ───────────────────────────────────────────────── */
function TermBlocksRecent({ data }: { data: MoneroLive }) {
  const blocks = data.blocks.slice(0, 12);
  const rows = blocks.map((b) => [
    b.height.toLocaleString(),
    b.age < 90 ? b.age + "s" : Math.round(b.age / 60) + "m",
    String(b.txs),
    b.sizeKB.toFixed(0) + "K",
    b.reward.toFixed(3),
    fmtN(b.difficulty),
    b.pool,
  ]);
  const n = blocks.length || 1;
  const sum = blocks.reduce((a, b) => ({ reward: a.reward + b.reward, txs: a.txs + b.txs, size: a.size + b.sizeKB, diff: a.diff + b.difficulty }), { reward: 0, txs: 0, size: 0, diff: 0 });
  return (
    <PanelFrame title={"$ blocks --recent · " + blocks.length} right={<NodeProvenance source="node" keys={["blocks"]} status={data.status} />} updatedAt={oldestFreshAt(data.status, ["blocks"])}>
      {blocks.length ? (
        <>
          <TermTable head={["H", "AGE", "TXS", "SIZE", "REWARD", "DIFF", "POOL"]} cols="80px 52px 40px 60px 68px 74px 1fr" rows={rows} />
          <div className="mono dim" style={{ marginTop: "var(--sp-2)", fontSize: "var(--fs-label)" }}>
            {blocks.length} blocks · Σreward <span className="acc">{sum.reward.toFixed(3)} XMR</span> · avg txs <span className="acc">{Math.round(sum.txs / n)}</span> · avg size <span className="acc">{(sum.size / n).toFixed(0)}K</span> · avg diff <span className="acc">{fmtN(sum.diff / n)}</span>
          </div>
        </>
      ) : <div className="mono dim2" style={{ fontSize: "var(--fs-mono)" }}>awaiting block history…</div>}
    </PanelFrame>
  );
}

/* ── $ pool --percentiles ────────────────────────────────────────────── */
function TermPercentiles({ data, stats }: { data: MoneroLive; stats: MemStats }) {
  const fees = sortedNums(data.mempool.map((t) => t.perB));
  const ages = sortedNums(data.mempool.map((t) => t.age));
  const poolReady = hasData(data.status.network) && stats.txCount > 0;
  const row = (label: string, v: number | null, suffix = "") => (
    <div key={label} className="kv"><span className="k">{label}</span><span className="v acc">{v != null ? Math.round(v).toLocaleString() + suffix : "—"}</span></div>
  );
  return (
    <PanelFrame title="$ pool --percentiles" right={<NodeProvenance source="node" keys={["mempool", "network"]} status={data.status} />} updatedAt={oldestFreshAt(data.status, ["mempool", "network"])}>
      <div className="kicker" style={{ marginBottom: "var(--sp-1)" }}>FEE/B</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 var(--sp-3)" }}>
        {row("p10", percentileOf(fees, 0.10))}
        {row("p25", percentileOf(fees, 0.25))}
        {row("p50", percentileOf(fees, 0.50))}
        {row("p75", percentileOf(fees, 0.75))}
        {row("p90", percentileOf(fees, 0.90))}
        {row("min", fees.length ? fees[0] : null)}
        {row("max", fees.length ? fees[fees.length - 1] : null)}
      </div>
      <div className="kicker" style={{ margin: "var(--sp-2) 0 var(--sp-1)" }}>AGE</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 var(--sp-3)" }}>
        {row("p10", percentileOf(ages, 0.10), "s")}
        {row("p50", percentileOf(ages, 0.50), "s")}
        {row("p90", percentileOf(ages, 0.90), "s")}
        {row("median", medianOf(ages), "s")}
        {row("oldest", poolReady ? stats.oldestAgeSec : null, "s")}
      </div>
    </PanelFrame>
  );
}

/* ── $ pool --composition ────────────────────────────────────────────── */
function TermComposition({ data }: { data: MoneroLive }) {
  const mp = data.mempool;
  const fields: [string, number[]][] = [
    ["inputs", mp.map((t) => t.inputs)],
    ["outputs", mp.map((t) => t.outputs)],
    ["ring", mp.map((t) => t.ringSize)],
    ["size", mp.map((t) => t.size)],
  ];
  const rows = fields.map(([label, arr]) => {
    const s = fieldStats(arr);
    return [label, s ? String(s.n) : "—", s ? s.mean.toFixed(1) : "—", s ? String(s.min) : "—", s ? String(s.max) : "—"];
  });
  return (
    <PanelFrame title="$ pool --composition" right={<NodeProvenance source="node" keys={["mempool"]} status={data.status} />} updatedAt={oldestFreshAt(data.status, ["mempool"])}>
      <TermTable head={["FIELD", "N", "MEAN", "MIN", "MAX"]} cols="72px 56px 66px 56px 60px" rows={rows} />
    </PanelFrame>
  );
}

export function TerminalHubView({ data }: ViewProps) {
  // Shared tracking — same hook + detail (confOf) as every other view.
  const { tracking, onSearch, clearTracking } = useMempoolTracking(data);
  const reduced = useReducedMotion();
  const tiersKnown = data.feeTiers.length === 4;
  // The ONE mempool telemetry derivation, shared with the other five views.
  // Terminal keeps its own ASCII/kv skin — it just stops recomputing the
  // same poolBytes/medianPerB figures locally.
  const stats = useMemStats(data);
  const syncPct = hasData(data.status.network) && data.synchronized ? 100 : 0;
  const poolPct = hasData(data.status.network) && data.blockWeightLimit ? Math.min(100, Math.round((stats.poolBytes / data.blockWeightLimit) * 100)) : 0;
  const weightPct = hasData(data.status.network) && data.blockWeightLimit ? Math.min(100, Math.round((data.blockWeightMedian / data.blockWeightLimit) * 100)) : 0;
  const feePct = hasData(data.status.network) && tiersKnown && stats.medianPerB && data.feeTiers[2] ? Math.min(100, Math.round((stats.medianPerB / data.feeTiers[2]) * 100)) : 0;

  // Tracked tx — same shape everywhere: null blockHeight = still pending,
  // resolved once from the node otherwise; confOf never disagrees with the
  // ribbon/other views since it's the one shared formula.
  const trackedTxId = tracking?.kind === "tx" ? tracking.id : null;
  const trackedBlockHeight = tracking?.kind === "tx" ? tracking.blockHeight : null;
  const trackedConf = confOf(trackedBlockHeight, data);
  const trackedTx = trackedTxId ? { id: trackedTxId, blockHeight: trackedBlockHeight, conf: trackedConf } : null;
  // Seconds until the tracked tx reaches CONF_UNLOCK confirmations, honestly
  // derived from the live block target — never a fabricated countdown.
  const unlockOffsetSec = trackedTx && trackedTx.blockHeight != null && trackedTx.conf < CONF_UNLOCK
    ? Math.max(0, CONF_UNLOCK - trackedTx.conf - 1) * (data.blockTarget || 120)
    : 0;

  return (
    <div className="main" style={{ overflow: "auto", padding: 0 }}>
      <MemViewShell id="terminal" table={<MemTxTable data={data} tracking={tracking} viewId="terminal" columns={["txid", "perB", "tier", "size", "age"]} onPickTx={(id) => onSearch({ kind: "tx", id })} />} data={data} tracking={tracking} onSearch={onSearch} onClearTracking={clearTracking} stats={false}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "var(--sp-3)", padding: "var(--sp-4) 20px 40px" }}>
        {/* maxWidth is LOAD-BEARING, not cosmetic — see the file header. Terminal
            carries no .mp-fit wrapper, so this is what keeps .mp-view's
            shrink-to-fit contribution under the ~1180px canvas budget at 1440
            (320 rail + 12 gap + 40 padding = 372; 1180 − 372 = 808; 780 leaves
            ~28px slack) — the §8 caption hazard in its pan-mode form. */}
        <div style={{ maxWidth: 780, minWidth: 0 }}>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
              <PanelFrame title={<span>$ monerod --status</span>} right={<span className="acc">tail −f</span>} updatedAt={oldestFreshAt(data.status, ["network", "mempool"])}>
                <pre style={{ margin: 0, fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", lineHeight: 1.5, color: "var(--ink-100)", textShadow: "0 0 6px color-mix(in srgb, var(--accent-structural) 18%, transparent)" }}>
{`╭─ monerod ${data.version || "—"} `.padEnd(52, "─") + "\n│ Status:    "}
{hasData(data.status.network) ? (
  <>
    <span style={{ color: data.synchronized ? "var(--g-50)" : "var(--y-50)", textShadow: data.synchronized ? "var(--glow-g)" : "none" }}>{data.synchronized ? "SYNCED" : "SYNCING"}</span>
    {` (${data.height.toLocaleString()}/${data.height.toLocaleString()})`}
  </>
) : "—"}
{"\n│ Network:   " + (hasData(data.status.network) ? `${data.nettype || "—"} · hardfork ${data.hardfork}` : "—")}
{"\n│ Hash rate: "}
{hasData(data.status.network) ? (
  <>
    <span className="acc">{(data.hashrate / 1e9).toFixed(2)} GH/s</span>
    {` · diff ${data.difficulty.toLocaleString()}`}
  </>
) : "—"}
{"\n│ Mempool:   "}
{/* Terminal opts out of MemStatStrip (stats={false}) to keep its dense
    ASCII idiom, so it carries the shared-stat hooks itself. Same contract
    as the strip: data-memstat names the figure, data-memstat-value gives
    the raw number, so the cross-view gate compares readings rather than
    formatting — this view zero-pads where the strip doesn't. */}
<span className="acc" data-memstat="mempool" data-memstat-value={data.mempool.length}>{pad(data.mempool.length, 3)} tx</span>
{" · "}
<span data-memstat="bytes" data-memstat-value={stats.poolBytes}>{fmtBytes(stats.poolBytes)}</span>
{"\n"}
{"╰" + "─".repeat(51)}
                </pre>
                <div style={{ marginTop: "var(--sp-3)", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)" }}>
                  <div className="kicker" style={{ marginBottom: "var(--sp-1)" }}>CHAIN TOTALS</div>
                  {[
                    ["txs all-time", hasData(data.status.network) ? fmtN(data.txCountTotal) : "—"],
                    ["db size", dbGB(data)],
                    ["alt blocks", hasData(data.status.network) ? String(data.altBlocksCount) : "—"],
                    ["top block", hasData(data.status.network) ? shortHash(data.topBlockHash) : "—"],
                  ].map((r, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "var(--sp-1)", padding: "1px 0" }}>
                      <span className="dim">{r[0]}</span><span className="acc">{r[1]}</span>
                    </div>
                  ))}
                </div>
              </PanelFrame>

              <PanelFrame title="$ jump · ⌘K" right={<span className="acc">PALETTE</span>} updatedAt={oldestFreshAt(data.status, ["network", "blocks", "fees", "mempool"])}>
                <TermPalette data={data} />
              </PanelFrame>
            </div>

            <PanelFrame title="$ block-stream --ascii" right={<span>{Math.min(13, data.blocks.length)} LAST</span>} updatedAt={oldestFreshAt(data.status, ["blocks", "network"])}>
              <TermAsciiBlocks data={data} trackedTxId={trackedTxId} trackedHeight={trackedBlockHeight} />
              <div style={{ marginTop: "var(--sp-2)", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", color: "var(--ink-60)", borderTop: "1px dashed var(--ink-10)", paddingTop: "var(--sp-2)", display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "var(--sp-2)" }}>
                <span><span className="acc">█</span> tx fill ratio</span><span><span className="dim">0c</span> just mined</span><span><span className="dim">+{CONF_UNLOCK}c</span> unlock</span><span className="dim2">ring=16</span><span className="dim2">target={fmtMMSS(data.blockTarget || 120)}</span><span className="dim2 acc">scroll ←→</span>
              </div>
            </PanelFrame>

            {/* D0651: term-blink — same justification as the first use above (~line 95) */}
            <PanelFrame title="$ tail -f · feed" right={<><NodeProvenance source="node" keys={["blocks", "mempool"]} status={data.status} inline /><span>−f</span><span className="acc" style={{ animation: reduced ? undefined : "term-blink 1s steps(2) infinite" }}>●</span></>} updatedAt={oldestFreshAt(data.status, ["blocks", "mempool"])}>
              <TermLiveLog data={data} trackedTx={trackedTx} />
            </PanelFrame>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--sp-3)" }}>
              <PanelFrame title="$ awk · fee distribution" updatedAt={oldestFreshAt(data.status, ["mempool"])}>
                <TermFeeHisto data={data} />
              </PanelFrame>
              {/* feeTiers is written by BOTH mapFees and mapNetwork (src/data/map.ts) — either
                  endpoint refreshing it is enough, so worst-of across ["fees","network"] is the
                  honest freshness read here, not "fees" alone. */}
              <PanelFrame title="$ fee · tiers" right={<NodeProvenance source="node" keys={["fees", "network"]} status={data.status} />} updatedAt={oldestFreshAt(data.status, ["fees", "network"])}>
                <pre style={{ margin: 0, fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", lineHeight: 1.7 }}>
                  {FEE_TIER_LABELS.map((label, i) => (
                    <div key={label} style={{ color: tiersKnown ? TIER_COLORS[i] : "var(--ink-40)" }}>
                      {tiersKnown
                        ? `${label.padEnd(8)} ${String(Math.round(data.feeTiers[i])).padStart(8)} pcn/B   ${((data.feeTiers[i] * 1000) / 1e12).toFixed(5)} XMR/kB`
                        : `${label.padEnd(8)} ${"—".padStart(8)} pcn/B   — XMR/kB`}
                    </div>
                  ))}
                </pre>
              </PanelFrame>
              {/* v2: +PROTOCOL/BLOCK_TARGET/ADJUSTED — three real fields the pre-rebuild
                  file never rendered. ADJUSTED is the daemon's network-adjusted clock,
                  labelled as such (never presented as local time) and gated on
                  hasData(network) — an unsynced clock is not a reading, it's a guess. */}
              <PanelFrame title="$ env · runtime" updatedAt={oldestFreshAt(data.status, ["network"])}>
                <pre style={{ margin: 0, fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", lineHeight: 1.55, color: "var(--ink-80)" }}>
{`MONEROD_VERSION=${data.version || "—"}
NETTYPE=${data.nettype || "—"}
SYNCHRONIZED=${hasData(data.status.network) ? String(data.synchronized) : "—"}
DB_SIZE=${dbGB(data)}
FORK=v${data.majorVersion || "—"}
TOP_BLOCK=${hasData(data.status.network) ? shortHash(data.topBlockHash) : "—"}
RING_SIZE=16
BP_VARIANT=BP+
PROTOCOL=${data.protocol || "—"}
BLOCK_TARGET=${data.blockTarget ? fmtMMSS(data.blockTarget) : "—"}
ADJUSTED=${hasData(data.status.network) && data.adjustedTime ? new Date(data.adjustedTime * 1000).toISOString().slice(11, 19) + " UTC · network-adjusted" : "—"}`}
                </pre>
              </PanelFrame>
            </div>

            <TermBlockTimeChart data={data} />
            <TermFeeCurveChart data={data} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
              <TermHashrateChart data={data} />
              <TermPoolByTier data={data} />
            </div>

            <TermBlocksRecent data={data} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-3)" }}>
              <TermPercentiles data={data} stats={stats} />
              <TermComposition data={data} />
            </div>

            <PanelFrame title="$ help" ticks={false}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "var(--sp-2)", fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)" }}>
                {[["⌘K", "palette"], ["G H", "home"], ["G M", "mempool"], ["G E", "education"], ["G D", "dashboard"], ["G S", "simulate"], ["?", "help"], ["[", "prev block"], ["]", "next block"], ["/", "search"], ["F", "follow log"], ["S", "scanlines"], ["D", "density"], ["L", "lock"], ["⎋", "back"], ["⇧?", "keys"]].map(([k, v], i) => (
                  <div key={i} style={{ display: "flex", gap: "var(--sp-1)", alignItems: "center" }}>
                    <span style={{ border: "1px solid var(--ink-20)", padding: "1px var(--sp-1)", fontSize: "var(--fs-label)", color: "var(--tk-accent)", textShadow: "var(--glow-1)" }}>{k}</span>
                    <span className="dim">{v}</span>
                  </div>
                ))}
              </div>
            </PanelFrame>
          </div>

          <aside className="rail" style={{ borderLeft: "1px solid var(--rule)", borderRight: "none" }}>
            <div className="rail-block">
              <h6>Remote node</h6>
              <div className="kv"><span className="k">Daemon</span><span className="v acc">{data.version || "—"}</span></div>
              <div className="kv"><span className="k">Network</span><span className="v">{data.nettype || "—"}</span></div>
              <div className="kv"><span className="k">DB</span><span className="v">{dbGB(data)}</span></div>
              <div className="kv"><span className="k">Sync</span><span className={hasData(data.status.network) && data.synchronized ? "v g" : "v"}>{hasData(data.status.network) ? (data.synchronized ? "✓ synced" : "syncing") : "—"}</span></div>
            </div>
            <div className="rail-block">
              <h6>Fee tiers</h6>
              {FEE_TIER_LABELS.map((label, i) => (
                <div className="kv" key={label}>
                  <span className="k">{label}</span>
                  <span className="v" style={tiersKnown ? { color: TIER_COLORS[i] } : undefined}>
                    {tiersKnown ? `${Math.round(data.feeTiers[i])} pcn/B` : "—"}
                  </span>
                </div>
              ))}
            </div>
            <div className="rail-block">
              <h6>Chain totals</h6>
              <div className="kv"><span className="k">Txs all-time</span><span className="v acc">{hasData(data.status.network) ? fmtN(data.txCountTotal) : "—"}</span></div>
              <div className="kv"><span className="k">Alt blocks</span><span className="v">{hasData(data.status.network) ? String(data.altBlocksCount) : "—"}</span></div>
              <div className="kv"><span className="k">RandomX seed</span><span className="v">{hasData(data.status.network) ? shortHash(data.randomxSeedHash) : "—"}</span></div>
              <div className="kv"><span className="k">Top block</span><span className="v">{hasData(data.status.network) ? shortHash(data.topBlockHash) : "—"}</span></div>
            </div>
            <div className="rail-block">
              <h6>Network gauges</h6>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-1)" }}>
                <div title="node sync state"><TermGauge value={syncPct} label="SYNC" /></div>
                <div title="mempool bytes vs one full block"><TermGauge value={poolPct} label="POOL" color="var(--c-50)" /></div>
                <div title="median block weight vs dynamic limit"><TermGauge value={weightPct} label="WEIGHT" color="var(--p-50)" /></div>
                <div title="median pool fee rate vs fast tier"><TermGauge value={feePct} label="FEE" color="var(--g-50)" /></div>
              </div>
            </div>
            {trackedTx ? (
              <div className="rail-block" data-tracked-tx={trackedTx.id} data-tracked-block={trackedTx.blockHeight ?? undefined}>
                <h6>Tracked</h6>
                <div className="kv"><span className="k">Txid</span><span className="v acc">{shortHash(trackedTx.id)}</span></div>
                <div className="kv"><span className="k">Height</span><span className="v">{trackedTx.blockHeight != null ? trackedTx.blockHeight.toLocaleString() : "in pool"}</span></div>
                <div className="kv"><span className="k">Conf</span><span className={trackedTx.blockHeight != null && trackedTx.conf >= CONF_UNLOCK ? "v g" : "v"}>{trackedTx.blockHeight != null ? `${trackedTx.conf}/${CONF_UNLOCK}` : "—"}</span></div>
                <div className="kv">
                  <span className="k">Unlock ETA</span>
                  <span className="v p">
                    {trackedTx.blockHeight == null ? "—"
                      : trackedTx.conf >= CONF_UNLOCK ? "unlocked"
                      : <BlockEta data={data} offsetSec={unlockOffsetSec} />}
                  </span>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </MemViewShell>
    </div>
  );
}
