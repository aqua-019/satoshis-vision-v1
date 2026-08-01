// AUTO-PORTED from bridge.jsx
// Run `npm run port` to refresh. Manual fixups land in MIGRATION.md.
import * as React from "react";
import { Link } from "react-router-dom";
import { useTick } from "@/design/ArtBackground";
import { useReducedMotion } from "@/design/useReducedMotion";
import { observeDrawable } from "@/design/usePageActive";
import { Stat, Provenance } from "@/design/primitives";
import { fmtBytes, shortHash as ShortHash } from "@/data/types";
import { hashToUnit, FEE_TIER_LABELS, feeTierIndex } from "@/data/map";
import { useFeedEvents } from "@/data/useFeedEvents";
import { useMempoolTracking, MemViewShell, TrackChip, MemTxTable} from "@/mempool/mempool-shared";
import type { Tracking } from "@/mempool/mempool-shared";
import { confOf, CONF_UNLOCK } from "@/mempool/conf";
import type { MoneroLive } from "@/data/types";

interface ViewProps {
  data: MoneroLive;
  bg?: { intensity?: "calm" | "busy" | "chaotic"; scan?: boolean };
}

// bridge.jsx — OPERATIONS BRIDGE · hi-fi mission control
//
// "Bloomberg-meets-NASA." A flight-deck of live instruments: a PPI radar
// sweeping the live mempool, a bank of easing gauges over real node health,
// a fee oscilloscope, a block-cadence countdown, pool attribution and a
// scrolling alert tape — every number comes from the live MoneroLive feed.
// Chain figures gate on data.ready, market figures on data.marketReady.
//
// Every helper is prefixed `Brg` so it can't collide with Reactor / Terminal
// / monero-pages in the shared babel global scope.

/* fee-tier chip/blip colors, slow → fastest */
const TIER_COLORS = ["var(--c-50)", "var(--g-50)", "var(--y-50)", "var(--r-50)"];

/* ── card chrome shared by all bridge instruments ───────────── */
export function BrgCard({ title, right, children, pad = "14px 16px", style }: any) {
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

/* ── PPI radar — live mempool txs as blips, sweep arm lights them ── */
export function BrgRadar({ data, trackedId }: { data: MoneroLive; trackedId?: string | null }) {
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const cx = 150, cy = 150, R = 132;

  // Stable polar position per tx: angle from txid hash, range from age
  // (newer = nearer centre). Blip color by real fee tier.
  const blips = React.useMemo(() => {
    return data.mempool.slice(0, 60).map((t) => {
      const ang = hashToUnit(t.id) * Math.PI * 2;
      const range = 0.32 + Math.min(0.62, t.age / 600);
      const tier = feeTierIndex(t.perB, data.feeTiers);
      return { id: t.id, ang, r: range * R, color: tier >= 0 ? TIER_COLORS[tier] : "var(--ink-40)" };
    });
  }, [data.mempool, data.feeTiers]);

  // Index of the tracked tx's blip, computed OUTSIDE the blips memo above so
  // trackedId never joins that memo's dependency key (the sweep math is
  // untouched by tracking state). Read via a ref inside the rAF loop so a
  // tracked-id change doesn't tear down/restart the sweep's elapsed-time
  // origin (t0) — only the lock reticle below re-renders.
  const trackedIdx = React.useMemo(
    () => (trackedId ? blips.findIndex((b) => b.id === trackedId) : -1),
    [blips, trackedId],
  );
  const trackedIdxRef = React.useRef(trackedIdx);
  trackedIdxRef.current = trackedIdx;

  const blipRefs = React.useRef<(SVGCircleElement | null)[]>([]);

  // `blips` lives in a ref the loop reads, NOT as an effect dep. `blips` is a
  // useMemo on [data.mempool, data.feeTiers] and the feed polls every 2.5s, so
  // an effect keyed on `blips` itself tore the 60fps rAF loop down and rebuilt
  // it every 2.5 seconds — the loop's own `t0` reset each time, which snapped
  // the sweep arm back to bearing 0 on every feed tick (v6.0.8 perf pass). The
  // ref lets the loop read the latest blips without restarting for them.
  const blipsRef = React.useRef(blips);
  blipsRef.current = blips;

  React.useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    let raf = 0;
    let running = false;
    const t0 = performance.now();
    const PERIOD = 4.2; // seconds per revolution
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      const sweep = ((t / PERIOD) % 1) * Math.PI * 2;       // 0..2π
      const arm = el.querySelector("[data-arm]");
      if (arm) arm.setAttribute("transform", `rotate(${sweep * 180 / Math.PI} ${cx} ${cy})`);
      // light each blip by how recently the sweep crossed its angle
      blipsRef.current.forEach((b, i) => {
        let d = sweep - b.ang; while (d < 0) d += Math.PI * 2;   // radians since sweep passed
        const recency = Math.max(0, 1 - d / (Math.PI * 0.8));    // fades over ~144°
        const node = blipRefs.current[i];
        if (node) {
          const locked = i === trackedIdxRef.current;
          node.setAttribute("r", (1.6 + recency * 3.4).toFixed(2));
          // The tracked blip stays pinned at full opacity rather than fading
          // with sweep recency — it must stay visible between sweep passes.
          node.setAttribute("opacity", locked ? "1" : (0.28 + recency * 0.72).toFixed(3));
          node.style.filter = locked || recency > 0.25
            ? `drop-shadow(0 0 ${(Math.max(recency, locked ? 1 : 0) * 7).toFixed(1)}px ${b.color})`
            : "none";
        }
      });
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };
    // Was: unconditional rAF forever, including in a hidden tab (the `!el`
    // branch even rescheduled itself instead of giving up). Now stops entirely
    // when the tab is backgrounded or this SVG scrolls off screen.
    const undrawable = observeDrawable(el, (drawable) => (drawable ? start() : stop()));
    return () => { undrawable(); stop(); };
  }, []);

  return (
    <svg ref={svgRef} viewBox="0 0 300 300" width="100%" style={{ display: "block", maxHeight: 300 }}>
      <defs>
        <radialGradient id="brg-ppi" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--accent-structural)" stopOpacity="0.10" />
          <stop offset="100%" stopColor="var(--accent-structural)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="brg-wedge" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent-structural)" stopOpacity="0.42" />
          <stop offset="100%" stopColor="var(--accent-structural)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={R} fill="url(#brg-ppi)" />
      {/* range rings */}
      {[0.33, 0.66, 1].map((f, i) => (
        <circle key={i} cx={cx} cy={cy} r={R * f} fill="none" stroke="var(--accent-structural)" strokeOpacity={0.16} strokeWidth="1" strokeDasharray={i === 2 ? "none" : "2 5"} />
      ))}
      {/* cross-hairs */}
      <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke="var(--accent-structural)" strokeOpacity={0.12} strokeWidth="1" />
      <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke="var(--accent-structural)" strokeOpacity={0.12} strokeWidth="1" />
      {/* bearing ticks */}
      {Array.from({ length: 24 }).map((_, i) => {
        const a = i * 15 * Math.PI / 180;
        const long = i % 6 === 0;
        return <line key={i} x1={cx + Math.cos(a) * (R - (long ? 9 : 4))} y1={cy + Math.sin(a) * (R - (long ? 9 : 4))}
          x2={cx + Math.cos(a) * R} y2={cy + Math.sin(a) * R} stroke="var(--tk-accent)" strokeOpacity={long ? 0.5 : 0.25} strokeWidth="1" />;
      })}
      {/* sweep arm + trailing wedge */}
      <g data-arm>
        <path d={`M ${cx} ${cy} L ${cx + R} ${cy} A ${R} ${R} 0 0 0 ${cx + R * Math.cos(-0.9)} ${cy + R * Math.sin(-0.9)} Z`} fill="url(#brg-wedge)" />
        <line x1={cx} y1={cy} x2={cx + R} y2={cy} stroke="var(--tk-accent)" strokeWidth="1.4" style={{ filter: "drop-shadow(0 0 4px var(--tk-accent))" }} />
      </g>
      {/* mempool tx blips */}
      {blips.map((b, i) => (
        <circle key={i} ref={(n) => { blipRefs.current[i] = n; }}
          data-tracked-tx={i === trackedIdx ? trackedId : undefined}
          cx={cx + Math.cos(b.ang) * b.r} cy={cy + Math.sin(b.ang) * b.r}
          r="2" fill={b.color} opacity="0.4" />
      ))}
      {/* tracked-tx lock reticle: bracket on the blip + leader line/label to
          the rim, so the tracked tx reads even while the sweep is elsewhere. */}
      {trackedIdx >= 0 ? (() => {
        const b = blips[trackedIdx];
        const bx = cx + Math.cos(b.ang) * b.r, by = cy + Math.sin(b.ang) * b.r;
        const rx = cx + Math.cos(b.ang) * R, ry = cy + Math.sin(b.ang) * R;
        const lx = cx + Math.cos(b.ang) * (R + 16), ly = cy + Math.sin(b.ang) * (R + 16);
        const anchor = Math.cos(b.ang) > 0.15 ? "start" : Math.cos(b.ang) < -0.15 ? "end" : "middle";
        return (
          <g data-tracked-tx={trackedId}>
            <line x1={bx} y1={by} x2={rx} y2={ry} stroke="var(--y-50)" strokeWidth="1" strokeDasharray="2 2" opacity="0.85" />
            <rect x={bx - 7} y={by - 7} width="14" height="14" fill="none" stroke="var(--y-50)" strokeWidth="1.4"
              transform={`rotate(45 ${bx} ${by})`} style={{ filter: "drop-shadow(0 0 4px var(--y-50))" }} />
            <text x={lx} y={ly} textAnchor={anchor} fontFamily="var(--f-mono)" fontSize="8.5" fill="var(--y-50)"
              style={{ filter: "drop-shadow(0 0 3px var(--y-50))" }}>{ShortHash(trackedId)}</text>
          </g>
        );
      })() : null}
      {/* you (centre) */}
      <circle cx={cx} cy={cy} r="4" fill="var(--tk-accent)" style={{ filter: "drop-shadow(0 0 5px var(--tk-accent))" }} />
      <text x={cx} y={cy - 9} textAnchor="middle" fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-60)" letterSpacing="0.16em">NODE</text>
      <text x="12" y="18" fontFamily="var(--f-mono)" fontSize="8.5" fill="var(--ink-40)" letterSpacing="0.16em">PPI · MEMPOOL TX · LIVE · RANGE = AGE</text>
    </svg>
  );
}

/* ── animated semicircular gauge with easing needle ───────────
   Needle position is driven imperatively (SVG attrs via refs), NOT React
   state, so a moving gauge never triggers a re-render. The rAF loop is
   scheduled from the loop body (never from inside a state updater — this
   app runs in <React.StrictMode>, which double-invokes updaters in dev, so
   scheduling from inside setCur() forked the loop and compounded speed).
   Delta-time smoothing (`cur += (target - cur) * (1 - exp(-dt/TAU))`) keeps
   the easing rate independent of display refresh rate; the loop stops
   entirely under prefers-reduced-motion (snaps straight to target) and
   pauses while the tab is hidden. */
const BRG_GAUGE_TAU = 0.2; // seconds — matches the old 0.08/frame feel at 60Hz

export function BrgGauge({ value, label, unit = "%", color = "var(--tk-accent)", size = 132 }: any) {
  const reduceMotion = useReducedMotion();
  const curRef = React.useRef(reduceMotion ? value : 0);
  const needleRef = React.useRef<SVGLineElement | null>(null);
  const arcRef = React.useRef<SVGPathElement | null>(null);
  const textRef = React.useRef<SVGTextElement | null>(null);

  const w = size, h = size * 0.62, c = w / 2, cyy = h - 6, r = w / 2 - 12;
  const ax = (ang: number, rad: number) => c + Math.cos(ang) * rad;
  const ay = (ang: number, rad: number) => cyy + -Math.sin(ang) * rad;
  const arc = (from: number, to: number, rad: number) => `M ${ax(from, rad)} ${ay(from, rad)} A ${rad} ${rad} 0 0 1 ${ax(to, rad)} ${ay(to, rad)}`;

  const paint = React.useCallback((cur: number) => {
    const frac = Math.min(1, Math.max(0, cur / 100));
    const a1 = Math.PI * (1 - frac);
    if (arcRef.current) arcRef.current.setAttribute("d", arc(Math.PI, a1, r));
    if (needleRef.current) {
      needleRef.current.setAttribute("x2", ax(a1, r - 6).toFixed(2));
      needleRef.current.setAttribute("y2", ay(a1, r - 6).toFixed(2));
    }
    if (textRef.current) textRef.current.textContent = Math.round(cur) + unit;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r, unit]);

  React.useEffect(() => {
    if (reduceMotion) { curRef.current = value; paint(value); return; }

    let raf = 0;
    let lastTs: number | null = null;
    const frame = (now: number) => {
      const dt = Math.min(0.05, lastTs != null ? (now - lastTs) / 1000 : 0);
      lastTs = now;
      const cur = curRef.current;
      const next = cur + (value - cur) * (1 - Math.exp(-dt / BRG_GAUGE_TAU));
      const settled = Math.abs(value - next) < 0.05;
      curRef.current = settled ? value : next;
      paint(curRef.current);
      if (!settled) raf = requestAnimationFrame(frame);
    };
    const start = () => { if (raf) return; lastTs = null; raf = requestAnimationFrame(frame); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    // Registered unconditionally (even if the tab starts hidden) so the loop
    // can still be woken up by a later visibilitychange — snap to target
    // immediately while hidden rather than silently doing nothing.
    if (document.hidden) { curRef.current = value; paint(value); } else start();
    const onVisibility = () => { if (document.hidden) stop(); else start(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [value, reduceMotion, paint]);

  const frac0 = Math.min(1, Math.max(0, curRef.current / 100));
  const a1_0 = Math.PI * (1 - frac0);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox={`0 0 ${w} ${h + 4}`} width="100%" style={{ display: "block" }}>
        <path d={arc(Math.PI, 0, r)} fill="none" stroke="var(--line)" strokeWidth="7" strokeLinecap="round" />
        <path ref={arcRef} d={arc(Math.PI, a1_0, r)} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 5px ${color})` }} />
        {/* tick marks */}
        {Array.from({ length: 11 }).map((_, i) => {
          const a = Math.PI * (1 - i / 10);
          return <line key={i} x1={ax(a, r - 9)} y1={ay(a, r - 9)} x2={ax(a, r - 3)} y2={ay(a, r - 3)} stroke="var(--ink-40)" strokeWidth="1" />;
        })}
        {/* needle */}
        <line ref={needleRef} x1={c} y1={cyy} x2={ax(a1_0, r - 6)} y2={ay(a1_0, r - 6)} stroke={color} strokeWidth="2" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
        <circle cx={c} cy={cyy} r="4" fill="var(--bg-1)" stroke={color} strokeWidth="1.5" />
        <text ref={textRef} x={c} y={cyy - 14} textAnchor="middle" fontFamily="var(--f-mono)" fontSize={size * 0.18} fontWeight="500" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }}>{Math.round(curRef.current)}{unit}</text>
      </svg>
      <div className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.16em", color: "var(--ink-40)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

export function BrgGaugeBank({ data }: { data: MoneroLive }) {
  // Real node-health gauges, all 0/dim until the first chain snapshot lands:
  //  SYNC      — daemon's synchronized flag
  //  FORK      — current hard-fork major version vs the v16 ruleset
  //  WEIGHT    — median block weight vs the dynamic limit (penalty-zone proximity)
  //  FEE FLOOR — slow tier as a fraction of the normal tier
  const ready = data.ready;
  const sync = ready && data.synchronized ? 100 : 0;
  const fork = ready && data.majorVersion >= 16 ? 100 : 0;
  const weight = ready && data.blockWeightLimit > 0
    ? Math.min(100, Math.round(data.blockWeightMedian / data.blockWeightLimit * 100)) : 0;
  const feeFloor = ready && data.feeTiers.length === 4 && data.feeTiers[1] > 0
    ? Math.min(100, Math.round(data.feeTiers[0] / data.feeTiers[1] * 100)) : 0;
  return (
    <BrgCard title="Instrument bank · node health" right={ready
      ? <><span className="led pulse" style={{ background: "var(--g-50)", boxShadow: "0 0 4px var(--g-50)" }} /> live</>
      : <span className="dim">awaiting node</span>}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
        <BrgGauge value={sync} label="SYNC" color="var(--g-50)" />
        <BrgGauge value={fork} label={`FORK v${data.majorVersion || "—"}`} color="var(--c-50)" />
        <BrgGauge value={weight} label="WEIGHT · MEDIAN/LIMIT" color="var(--tk-accent)" />
        <BrgGauge value={feeFloor} label="FEE FLOOR / NORMAL" color="var(--p-50)" />
      </div>
    </BrgCard>
  );
}

/* ── fee/byte oscilloscope — live area trace with a running scan dot ── */
export function BrgFeeScope({ data }: { data: MoneroLive }) {
  // Genuinely drives motion (kept, v6.0.8 perf pass): the scan dot / scan line
  // below reads `tick` directly at render time (`scanI`, ~:231, and the marker
  // line at ~:244-245). Only the distribution memo below was over-depending on
  // it — the fee-rate histogram is a pure function of `data.mempool`.
  const tick = useTick(900);
  const NB = 40;
  const { series, hi } = React.useMemo(() => {
    // distribution of current mempool fee-rates across the live range
    const rates = data.mempool.map((t) => t.perB);
    const hi = Math.max(...rates, 1) * 1.05;
    const buckets = new Array(NB).fill(0);
    rates.forEach((p) => {
      const b = Math.min(NB - 1, Math.max(0, Math.floor((p / hi) * NB)));
      buckets[b] += 1;
    });
    // light smoothing so the trace reads as a scope, not a comb
    const sm = buckets.map((v, i) => (buckets[i - 1] || 0) * 0.25 + v + (buckets[i + 1] || 0) * 0.25);
    return { series: sm, hi };
  }, [data.mempool]);
  const W = 360, H = 130, padL = 8, padR = 8, padT = 12, padB = 18;
  const iw = W - padL - padR, ih = H - padT - padB;
  const max = Math.max(...series, 1);
  const pts = series.map((v, i) => [padL + (i / (series.length - 1)) * iw, padT + ih - (v / max) * ih]);
  const path = "M" + pts.map(([x, y]) => x.toFixed(1) + "," + y.toFixed(1)).join(" L ");
  const area = path + ` L ${padL + iw},${padT + ih} L ${padL},${padT + ih} Z`;
  const scanI = tick % series.length;
  return (
    <BrgCard title="Fee/byte oscilloscope" right={<span className="acc">{data.mempool.length} tx</span>}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
        <defs>
          <linearGradient id="brg-scope" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-data)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--accent-data)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => <line key={t} x1={padL} x2={W - padR} y1={padT + ih * t} y2={padT + ih * t} stroke="var(--line-d)" strokeDasharray="2 3" />)}
        <path d={area} fill="url(#brg-scope)" />
        <path d={path} fill="none" stroke="var(--tk-accent)" strokeWidth="1.4" style={{ filter: "drop-shadow(0 0 3px var(--tk-accent))" }} />
        <circle cx={pts[scanI][0]} cy={pts[scanI][1]} r="3" fill="var(--y-50)" style={{ filter: "drop-shadow(0 0 5px var(--y-50))" }} />
        <line x1={pts[scanI][0]} y1={padT} x2={pts[scanI][0]} y2={padT + ih} stroke="var(--y-50)" strokeOpacity="0.3" strokeWidth="1" />
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <text key={i} x={padL + f * iw} y={H - 4} textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"} fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-40)">{Math.round(f * hi)}</text>
        ))}
        <text x={W - padR} y={padT + 8} textAnchor="end" fontFamily="var(--f-mono)" fontSize="8" fill="var(--ink-40)">piconero/byte →</text>
      </svg>
    </BrgCard>
  );
}

/* ── block-cadence — countdown ring + real recent interval bars ─── */
export function BrgBlockCadence({ data, trackedTxId, trackedHeight }: { data: MoneroLive; trackedTxId?: string | null; trackedHeight?: number | null }) {
  // Both branches independently cut this from 250ms to 1000ms: `now` is only
  // ever consumed through a Math.floor to whole seconds below, so four ticks in
  // five re-rendered to an identical frame. The ring keeps sweeping smoothly
  // across the 1s gaps via a stroke-dashoffset transition rather than stepping.
  //
  // `useTick` rather than a raw setInterval so it also PAUSES while the tab is
  // hidden and fires one tick immediately on return. `{ motion: false }`
  // because this is a real elapsed-time clock, not decoration: never floored
  // per-tier, never frozen under prefers-reduced-motion — a countdown that
  // freezes is a clock that lies. See UseTickOptions in design/ArtBackground.tsx.
  useTick(1000, { motion: false });
  const now = Date.now();
  const reduced = useReducedMotion();
  const TARGET = 120;
  const elapsed = data.ready ? (data.blocks?.[0]?.age || 0) + Math.max(0, Math.floor((now - data.lastUpdate) / 1000)) : 0;
  const overdue = data.ready && elapsed > TARGET;
  const pct = Math.min(1, elapsed / TARGET);
  const ring = 2 * Math.PI * 34;
  // The dasharray pair stays fixed at the full ring length; only dashoffset
  // moves. A CSS transition on strokeDasharray can't tween cleanly (both
  // numbers in the pair change every update) but stroke-dashoffset is a single
  // scalar, so it sweeps smoothly across the 1s gaps between ticks instead of
  // stepping. Off entirely under prefers-reduced-motion.
  const dashOffset = ring - ring * pct;
  const tone = overdue ? "var(--y-50)" : "var(--tk-accent)";

  // Real intervals between consecutive recent blocks (age deltas), each
  // tagged with the (newer) block height it belongs to so a tracked block's
  // bar can be tinted below. Miner timestamps are non-monotonic, so clamp
  // each delta to [0, 1800]s.
  const ivs = React.useMemo(() => {
    const bs = data.blocks.slice(0, 11);
    const out: { height: number; iv: number }[] = [];
    for (let i = 0; i + 1 < bs.length; i++) {
      out.push({ height: bs[i].height, iv: Math.max(0, Math.min(1800, bs[i + 1].age - bs[i].age)) });
    }
    return out;
  }, [data.blocks]);
  const mu = ivs.length ? Math.round(ivs.reduce((a, b) => a + b.iv, 0) / ivs.length) : null;
  const hiIv = Math.max(TARGET * 2, ...ivs.map((x) => x.iv));

  return (
    <BrgCard title="Block cadence · 2:00 target" right={!data.ready
      ? <span className="dim">awaiting node</span>
      : overdue
        ? <span style={{ color: "var(--y-50)" }}>OVERDUE</span>
        : <><span className="led pulse" style={{ background: "var(--g-50)", boxShadow: "0 0 4px var(--g-50)" }} /> locked</>}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <svg viewBox="0 0 90 90" width="100%" style={{ maxWidth: 90, display: "block" }}>
          <circle cx="45" cy="45" r="34" fill="none" stroke="var(--line)" strokeWidth="6" />
          <circle cx="45" cy="45" r="34" fill="none" stroke={tone} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={ring} strokeDashoffset={dashOffset} transform="rotate(-90 45 45)"
            style={{
              filter: `drop-shadow(0 0 4px ${tone})`,
              // D0651: stroke-dashoffset 0.95s linear stays literal — it approximates the
              // real 1s clock tick of the elapsed-time ring, and forcing an eased curve onto
              // a per-second countdown would make its speed visibly non-uniform. `stroke`
              // (the colour swap on lock/overdue) is a genuine UI timing: 0.3s exact → --d-3.
              transition: reduced ? "none" : "stroke-dashoffset 0.95s linear, stroke var(--d-3) var(--e-standard)",
            }} />
          <text x="45" y="42" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="9" fill="var(--ink-40)">ELAPSED</text>
          <text x="45" y="56" textAnchor="middle" fontFamily="var(--f-mono)" fontSize="14" fontWeight="500" fill={overdue ? "var(--y-50)" : "var(--ink-100)"}>{data.ready ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}` : "—:—"}</text>
        </svg>
        <div style={{ flex: 1 }}>
          <div className="mono dim" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>last {ivs.length || "—"} intervals</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 38 }}>
            {ivs.slice().reverse().map((item, i) => {
              const over = item.iv > TARGET;
              const tracked = trackedHeight != null && item.height === trackedHeight;
              const tone2 = tracked || over ? "var(--y-50)" : "var(--tk-accent)";
              return (
                <div key={i} title={item.iv + "s"}
                  data-tracked-tx={tracked ? trackedTxId : undefined}
                  data-tracked-block={tracked ? item.height : undefined}
                  style={{
                    flex: 1, height: Math.max(2, Math.round(item.iv / hiIv * 38)) + "px",
                    background: tone2, opacity: 0.55 + i * 0.045,
                    boxShadow: tracked ? "0 0 7px var(--y-50)" : over ? "0 0 5px var(--y-50)" : "0 0 4px var(--tk-accent)",
                    outline: tracked ? "1px solid var(--y-50)" : undefined,
                  }} />
              );
            })}
          </div>
          <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-label)", color: "var(--ink-40)", marginTop: 5 }}>
            <span>#{data.ready ? data.height.toLocaleString() : "—"}</span><span>μ {mu != null ? mu + "s" : "—"}</span><span>alt {data.ready ? data.altBlocksCount : "—"}</span>
          </div>
        </div>
      </div>
    </BrgCard>
  );
}

/* ── pool attribution (honest: node exposes no pool data) ───── */
export function BrgPoolDist({ data }: { data: MoneroLive }) {
  const recentBlocks = data.blocks.slice(0, 14);
  const unattributed = recentBlocks.filter((b) => !b.pool || b.pool === "Unknown" || b.pool === "—").length;
  return (
    <BrgCard title="Pool attribution" right={<span className="dim">UNATTRIBUTED</span>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: "var(--f-mono)", fontSize: "var(--fs-body)", lineHeight: 1.5 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 20, color: "var(--ink-100)" }}>{unattributed}/{recentBlocks.length}</span>
          <span className="dim">recent blocks · pool unknown</span>
        </div>
        <span className="dim" style={{ color: "var(--ink-40)" }}>
          Monero coinbases don't tag pools, so per-pool share isn't measurable on-chain.
          Decentralization &amp; HHI live in the <Link to="/simulate?p=skyline" className="acc">Skyline simulator</Link>.
        </span>
      </div>
    </BrgCard>
  );
}

/* ── scrolling mission-control alert tape — real feed conditions only ── */
type BrgAlertRow = { lvl: string; tone: string; msg: string; ts: string; t: number };

export function BrgAlertTape({ data, trackedTxId, trackedHeight, trackedConf }: {
  data: MoneroLive; trackedTxId?: string | null; trackedHeight?: number | null; trackedConf?: number | null;
}) {
  const events = useFeedEvents(data, 20);
  const [rows, setRows] = React.useState<BrgAlertRow[]>([]);
  const seq = React.useRef(0);
  const mk = React.useCallback((lvl: string, tone: string, msg: string, ms: number): BrgAlertRow =>
    ({ lvl, tone, msg, ts: new Date(ms).toISOString().slice(11, 19), t: seq.current++ }), []);

  // Block / stale / recover alerts from the real event stream (object identity
  // marks which events have already been turned into tape rows).
  const seenRef = React.useRef<Set<unknown>>(new Set());
  React.useEffect(() => {
    const fresh: BrgAlertRow[] = [];
    for (const ev of events) {            // events arrive newest-first
      if (seenRef.current.has(ev)) continue;
      if (ev.kind === "block") fresh.push(mk("NOMINAL", "g", `chain tip → #${ev.height.toLocaleString()} (${ev.txs} tx)`, ev.ts));
      else if (ev.kind === "stale") fresh.push(mk("WATCH", "y", "feed stale · reconnecting", ev.ts));
      else if (ev.kind === "recover") fresh.push(mk("NOMINAL", "g", "feed recovered", ev.ts));
    }
    seenRef.current = new Set(events);
    if (fresh.length) setRows((r) => [...fresh, ...r].slice(0, 7));
  }, [events, mk]);

  // Threshold alerts diffed against the previous tick's real values.
  const prevRef = React.useRef<{ poolLen: number | null; feeFloor: number | null; weightHot: boolean }>({ poolLen: null, feeFloor: null, weightHot: false });
  React.useEffect(() => {
    if (!data.ready) return;
    const fresh: BrgAlertRow[] = [];
    const now = Date.now();
    const p = prevRef.current;

    const len = data.mempool.length;
    if (p.poolLen != null && [50, 100, 200].some((th) => p.poolLen! < th && len >= th)) {
      fresh.push(mk("TXPOOL", "acc", `mempool depth ${len} tx`, now));
    }
    p.poolLen = len;

    if (data.blockWeightLimit > 0 && data.blockWeightMedian > 0) {
      const ratio = data.blockWeightMedian / data.blockWeightLimit;
      if (ratio >= 0.8 && !p.weightHot) {
        fresh.push(mk("WATCH", "y", `weight median ${Math.round(ratio * 100)}% of limit`, now));
        p.weightHot = true;
      } else if (ratio < 0.8) p.weightHot = false;
    }

    if (data.feeTiers.length === 4) {
      const floor = data.feeTiers[0];
      if (p.feeFloor != null && floor !== p.feeFloor) {
        fresh.push(mk("FEES", "p", `fee floor → ${Math.round(floor).toLocaleString()} pcn/B`, now));
      }
      p.feeFloor = floor;
    }

    if (fresh.length) setRows((r) => [...fresh, ...r].slice(0, 7));
    // Diff once per successful feed tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.lastUpdate, data.ready]);

  const col: Record<string, string> = { g: "var(--g-50)", acc: "var(--tk-accent)", p: "var(--p-50)", y: "var(--y-50)" };
  // A tracked tx that has left the mempool (real block height resolved) has
  // no radar blip to show it on — pin a row here instead, always on top,
  // independent of the real event log above.
  const pinned = trackedTxId && trackedHeight != null ? (
    <div data-tracked-tx={trackedTxId} data-tracked-block={trackedHeight}
      style={{ display: "grid", gridTemplateColumns: "70px 90px 1fr", gap: 10, padding: "3px 0", borderBottom: "1px solid var(--y-50)" }}>
      <span className="dim2">PINNED</span>
      <span style={{ color: "var(--y-50)" }}>TRACK</span>
      <span style={{ color: "var(--y-50)" }}>
        {ShortHash(trackedTxId)} · confirmed #{trackedHeight.toLocaleString()} · {trackedConf}/{CONF_UNLOCK}
      </span>
    </div>
  ) : null;
  return (
    <BrgCard title="Alert tape" right={<><Provenance source="node" fresh="live" inline /> −f</>}>
      <div style={{ fontFamily: "var(--f-mono)", fontSize: "var(--fs-mono)", lineHeight: 1.5 }}>
        {pinned}
        {rows.length === 0 && !pinned ? (
          <div className="dim" style={{ padding: "3px 0" }}>standing by · no feed events yet</div>
        ) : rows.map((r) => (
          <div key={r.t} style={{ display: "grid", gridTemplateColumns: "70px 90px 1fr", gap: 10, padding: "3px 0", borderBottom: "1px dashed var(--line-d)", animation: "brg-slidein 0.4s ease" }}>
            <span className="dim2">{r.ts}</span>
            <span style={{ color: col[r.tone] }}>{r.lvl}</span>
            <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.msg}</span>
          </div>
        ))}
      </div>
      <style>{`@keyframes brg-slidein { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }`}</style>
    </BrgCard>
  );
}

/* ── live tx console feed ───────────────────────────────────── */
export function BrgTxConsole({ data, tracking, onPickTx }: { data: MoneroLive; tracking: Tracking; onPickTx: (id: string) => void }) {
  const rows = data.mempool.slice(0, 12);
  const trackedId = tracking?.kind === "tx" ? tracking.id : null;
  return (
    <BrgCard title={"Transaction console · " + rows.length + " of " + data.mempool.length} right={<span className="acc">FEE TIER · LIVE</span>}>
      <div className="mono" style={{ display: "grid", gridTemplateColumns: "64px 78px 1.5fr 78px 96px 66px 64px", gap: 10, fontSize: "var(--fs-label)", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-40)", padding: "0 8px 6px", borderBottom: "1px solid var(--rule)" }}>
        <span>SEQ</span><span>TIER</span><span>TXID</span><span>SIZE</span><span>FEE/B</span><span>RING</span><span>AGE</span>
      </div>
      {rows.map((t, i) => {
        const tier = feeTierIndex(t.perB, data.feeTiers);
        const label = tier >= 0 ? FEE_TIER_LABELS[tier].toUpperCase() : "—";
        const tc = tier >= 0 ? TIER_COLORS[tier] : "var(--ink-40)";
        const isTracked = t.id === trackedId;
        return (
          <div key={t.id} data-tracked-tx={isTracked ? t.id : undefined}>
            <div onClick={() => onPickTx(t.id)}
              style={{
                display: "grid", gridTemplateColumns: "64px 78px 1.5fr 78px 96px 66px 64px", gap: 10, fontSize: "var(--fs-mono)",
                padding: "7px 8px", borderBottom: "1px solid var(--line-d)",
                borderLeft: isTracked ? "2px solid var(--y-50)" : "2px solid transparent",
                background: isTracked ? "color-mix(in srgb, var(--status-warn) 7%, transparent)" : undefined,
                cursor: "pointer", fontFamily: "var(--f-mono)", alignItems: "center",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = isTracked ? "color-mix(in srgb, var(--status-warn) 12%, transparent)" : "color-mix(in srgb, var(--accent-structural) 7%, transparent)"}
              onMouseLeave={(e) => e.currentTarget.style.background = isTracked ? "color-mix(in srgb, var(--status-warn) 7%, transparent)" : "transparent"}>
              <span className="dim2">{String(data.mempool.length - i).padStart(4, "0")}</span>
              <span style={{ color: tc, border: "1px solid " + tc, borderRadius: 2, fontSize: "var(--fs-label)", padding: "2px 5px", letterSpacing: "0.1em", justifySelf: "start" }}>{label}</span>
              <span style={{ color: "var(--c-50)" }}>{ShortHash(t.id)}</span>
              <span className="dim">{fmtBytes(t.size)}</span>
              <span className="acc">{Math.round(t.perB).toLocaleString()}</span>
              <span className="dim">{t.ringSize}</span>
              <span className="dim2">{t.age}s</span>
            </div>
            {isTracked ? (
              <div style={{ padding: "2px 8px 6px", borderLeft: "2px solid var(--y-50)" }}>
                <TrackChip tracking={tracking} data={data} />
              </div>
            ) : null}
          </div>
        );
      })}
    </BrgCard>
  );
}

/* ── overview composition ───────────────────────────────────── */
// Mempool telemetry (count/weight/median/eta) now lives ONE place — the
// shared MemStatStrip, rendered by MemViewShell above this component — so
// this grid keeps only Bridge's own network/market instruments.
export function BrgOverview({ data, tracking, onPickTx }: { data: MoneroLive; tracking: Tracking; onPickTx: (id: string) => void }) {
  const ready = data.ready, mkt = data.marketReady;

  // Tracked tx, resolved once via useMempoolTracking + confOf everywhere —
  // pending (still in mempool) shows on the radar/console; confirmed (left
  // the mempool) shows on the alert tape + block-cadence panel instead.
  const trackedTxId = tracking?.kind === "tx" ? tracking.id : null;
  const trackedHeight = tracking?.kind === "tx" ? tracking.blockHeight : null;
  const trackedConf = trackedHeight != null ? confOf(trackedHeight, data) : null;

  return (
    <div style={{ padding: "16px 20px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
        <Stat k="HEIGHT" v={ready ? data.height.toLocaleString() : "—"} sub="live" tone="acc" />
        <Stat k="HASHRATE" v={ready ? (data.hashrate / 1e9).toFixed(2) + " GH" : "—"} sub="2:00 tgt" />
        <Stat k="DIFFICULTY" v={ready ? (data.difficulty / 1e9).toFixed(2) + "G" : "—"} />
        <Stat k="XMR/USD" v={mkt ? "$" + data.price.toFixed(2) : "—"} sub={mkt ? (data.change24h >= 0 ? "+" : "") + data.change24h.toFixed(2) + "%" : undefined} tone={mkt ? (data.change24h >= 0 ? "g" : "dn") : undefined} />
        <Stat k="XMR/BTC" v={mkt ? data.btcRatio.toFixed(6) : "—"} />
        <Stat k="RING" v="16" sub="CLSAG" tone="p" />
        <Stat k="FORK" v={`v${data.majorVersion || "—"}`} sub={ready ? data.nettype || undefined : undefined} tone="p" />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.05fr 1fr", gap: 14, alignItems: "stretch" }}>
        <BrgCard title="Mempool radar · PPI scope" right={<span className="acc">SWEEP 4.2s</span>} style={{ display: "flex", flexDirection: "column" }}>
          <BrgRadar data={data} trackedId={trackedTxId} />
        </BrgCard>
        <BrgGaugeBank data={data} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
        <BrgFeeScope data={data} />
        <BrgBlockCadence data={data} trackedTxId={trackedTxId} trackedHeight={trackedHeight} />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 14 }}>
        <BrgPoolDist data={data} />
        <BrgAlertTape data={data} trackedTxId={trackedTxId} trackedHeight={trackedHeight} trackedConf={trackedConf} />
      </section>

      <BrgTxConsole data={data} tracking={tracking} onPickTx={onPickTx} />
    </div>
  );
}

export function BridgeView({ data }: ViewProps) {
  const { tracking, onSearch, clearTracking } = useMempoolTracking(data);
  return (
    <div className="main" style={{ overflow: "auto", padding: 0 }}>
      <MemViewShell id="bridge" table={<MemTxTable data={data} tracking={tracking} viewId="bridge" columns={["txid", "perB", "tier", "size", "age", "inout", "ring"]} onPickTx={(id) => onSearch({ kind: "tx", id })} />} data={data} tracking={tracking} onSearch={onSearch} onClearTracking={clearTracking}>
        <BrgOverview data={data} tracking={tracking} onPickTx={(id) => onSearch({ kind: "tx", id, blockHeight: null })} />
      </MemViewShell>
    </div>
  );
}
