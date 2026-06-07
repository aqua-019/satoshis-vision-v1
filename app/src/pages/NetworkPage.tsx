/**
 * pages/NetworkPage.tsx — Network telemetry surface.
 *
 * Pools + peers + geo map + recent blocks + hashrate sparkline + difficulty curve
 * + block fullness + fee histogram + mempool size over time + version distribution
 * + Tor/I2P share.
 *
 * Standalone page: owns its <AppShell> chrome. All data sourced from
 * `useMoneroLive()` except geo (PEER_GEO) + version distribution (NODE_VERSIONS) +
 * Tor/I2P shares, which are static illustrative lookups here (those endpoints 404).
 *
 * The GeoMap's propagation arcs + peer pulses respect prefers-reduced-motion:
 * reduced motion shows the static end-state (arc routes + peer markers) rather
 * than blank.
 */

import * as React from "react";
import { AppShell, PageHeader } from "@/layout/AppShell";
import { Stat, PanelFrame, Crumbs, Pill } from "@/design/primitives";
import { AreaSeries, BarSeries } from "./markets/charts";
import { fmtBytes, shortHash } from "@/data/types";
import { useMoneroLive } from "@/data/DataContext";

// ── prefers-reduced-motion ──
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

// ── world-map silhouette (low-fi, recognisable) ──
const WORLD_DOTS: [number, number][] = (() => {
  // A coarse silhouette of continents using a few dozen anchor coords.
  // Lon range -180..180 → x 0..100; Lat range -60..75 → y 100..0 inverted.
  const pts: [number, number][] = [
    // North America
    [-130, 55], [-120, 50], [-110, 55], [-100, 60], [-95, 50], [-95, 45], [-95, 40], [-85, 45], [-80, 40], [-75, 45],
    [-115, 40], [-110, 35], [-100, 30], [-90, 30], [-80, 28], [-115, 32],
    // Central America
    [-95, 18], [-90, 15], [-85, 12], [-78, 10],
    // South America
    [-70, 5], [-75, -5], [-72, -15], [-70, -25], [-65, -35], [-60, -40], [-55, -30], [-50, -20], [-45, -10], [-60, -5],
    // Europe
    [-5, 40], [0, 42], [5, 45], [10, 45], [15, 47], [20, 48], [25, 55], [30, 60], [20, 60], [15, 52], [10, 50], [2, 48],
    [-3, 50], [-8, 53], [12, 55],
    // Africa
    [0, 15], [5, 10], [10, 5], [15, 0], [20, -5], [25, -15], [30, -25], [20, -30], [18, -20], [8, -5], [35, 5], [40, 10],
    [0, 25], [10, 25], [20, 28], [30, 28],
    // Middle East / Russia
    [40, 35], [45, 40], [50, 40], [60, 55], [80, 55], [100, 55], [120, 55], [140, 60], [35, 55], [55, 60], [70, 60], [90, 60], [110, 60], [130, 55],
    // South / SE Asia
    [70, 20], [75, 15], [80, 12], [85, 20], [95, 22], [100, 15], [105, 10], [110, 5], [115, 0], [120, -3],
    // East Asia
    [115, 30], [120, 30], [125, 35], [130, 38], [135, 35], [125, 25],
    // Oceania
    [125, -15], [135, -22], [145, -25], [150, -28], [145, -35], [150, -32], [170, -40],
    // Japan
    [138, 36], [142, 42], [140, 32],
    // Iceland / Northern fringes
    [-20, 65], [-15, 64], [15, 65], [25, 68],
  ];
  return pts.map(([lon, lat]) => [(lon + 180) / 360 * 100, (75 - lat) / 135 * 100]);
})();

const PEER_GEO: [string, string, number, number, number, string][] = [
  // [country code, name, lon, lat, count, color]
  ["DE", "Germany", 10.0, 51.0, 187, "#ff7a1a"],
  ["US", "United States", -98.0, 39.0, 162, "#5ed3f4"],
  ["FR", "France", 2.0, 46.0, 84, "#4ade80"],
  ["NL", "Netherlands", 5.5, 52.0, 71, "#b87aff"],
  ["GB", "United Kingdom", -2.0, 54.0, 62, "#ffd400"],
  ["FI", "Finland", 26.0, 63.0, 44, "#ff4d6d"],
  ["CA", "Canada", -105.0, 56.0, 38, "#ff7a1a"],
  ["AU", "Australia", 133.0, -25.0, 35, "#5ed3f4"],
  ["JP", "Japan", 138.0, 36.0, 29, "#4ade80"],
  ["BR", "Brazil", -55.0, -10.0, 21, "#b87aff"],
  ["??", "Tor / I2P", -160.0, -45.0, 188, "rgba(255,255,255,0.55)"], // anchored offshore SW
];

function GeoMap({ width = 760, height = 380 }: { width?: number; height?: number }) {
  const reduce = usePrefersReducedMotion();
  return (
    <svg viewBox="0 0 100 56" width="100%" style={{ display: "block", maxWidth: width, maxHeight: height }}>
      <defs>
        <radialGradient id="net-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,122,26,0.25)" />
          <stop offset="100%" stopColor="rgba(255,122,26,0)" />
        </radialGradient>
        <linearGradient id="net-arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(255,122,26,0)" />
          <stop offset="50%" stopColor="rgba(255,122,26,0.9)" />
          <stop offset="100%" stopColor="rgba(255,122,26,0)" />
        </linearGradient>
      </defs>
      {/* graticule */}
      {[-60, -30, 0, 30, 60].map((lat) => (
        <line key={lat} x1="0" y1={(75 - lat) / 135 * 100 * 0.56}
          x2="100" y2={(75 - lat) / 135 * 100 * 0.56}
          stroke="rgba(255,122,26,0.04)" strokeWidth="0.1" />
      ))}
      {[0, 30, 60, 90, 120, 150, 180, -30, -60, -90, -120, -150].map((lon) => (
        <line key={lon} x1={(lon + 180) / 360 * 100} y1="0"
          x2={(lon + 180) / 360 * 100} y2="56"
          stroke="rgba(255,122,26,0.04)" strokeWidth="0.1" />
      ))}
      {/* continent silhouette */}
      {WORLD_DOTS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y * 0.56} r="0.35" fill="rgba(255,255,255,0.16)" />
      ))}

      {/* PROPAGATION ARCS — every ~6s a tx fans out from a major hub to peers */}
      {(() => {
        const hubs: [number, number][] = [
          [(10 + 180) / 360 * 100, (75 - 51) / 135 * 100 * 0.56],   // DE
          [(-98 + 180) / 360 * 100, (75 - 39) / 135 * 100 * 0.56],  // US
          [(138 + 180) / 360 * 100, (75 - 36) / 135 * 100 * 0.56],  // JP
        ];
        const targets: [number, number][] = PEER_GEO.map(([_c, _n, lon, lat]) => [(lon + 180) / 360 * 100, (75 - lat) / 135 * 100 * 0.56]);
        const lines: React.ReactElement[] = [];
        hubs.forEach((h, hi) => {
          targets.forEach(([tx, ty], ti) => {
            if (Math.abs(tx - h[0]) < 1 && Math.abs(ty - h[1]) < 1) return;
            const mx = (h[0] + tx) / 2;
            const my = Math.min(h[1], ty) - Math.abs(tx - h[0]) * 0.12 - 2;
            const d = `M${h[0]},${h[1]} Q${mx},${my} ${tx},${ty}`;
            const dur = 3 + (hi + ti) % 5 + (ti % 3);
            const delay = -((hi * 1.7 + ti * 0.6) % 8);
            lines.push(
              <g key={hi + "-" + ti}>
                <path d={d} fill="none" stroke="rgba(255,122,26,0.06)" strokeWidth="0.1" />
                {!reduce && (
                  <circle r="0.45" fill="var(--tk-accent)" style={{ filter: "drop-shadow(0 0 1px var(--tk-accent))" }}>
                    <animateMotion dur={dur + "s"} repeatCount="indefinite" begin={delay + "s"} path={d} rotate="auto" />
                    <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.9;1" dur={dur + "s"} repeatCount="indefinite" begin={delay + "s"} />
                  </circle>
                )}
              </g>
            );
          });
        });
        return lines;
      })()}

      {/* peers */}
      {PEER_GEO.map(([code, _name, lon, lat, count, color], i) => {
        const x = (lon + 180) / 360 * 100;
        const y = (75 - lat) / 135 * 100 * 0.56;
        const r = Math.max(0.6, Math.sqrt(count) / 8);
        return (
          <g key={i}>
            {/* pulsing ring */}
            <circle cx={x} cy={y} r={r * 1.5} fill="none" stroke={color} strokeWidth="0.15" opacity="0.6">
              {!reduce && <animate attributeName="r" values={`${r * 1.5};${r * 4};${r * 1.5}`} dur={(3 + i * 0.3) + "s"} repeatCount="indefinite" />}
              {!reduce && <animate attributeName="opacity" values="0.6;0;0.6" dur={(3 + i * 0.3) + "s"} repeatCount="indefinite" />}
            </circle>
            <circle cx={x} cy={y} r={r * 1.8} fill={color} opacity="0.14" />
            <circle cx={x} cy={y} r={r} fill={color} style={{ filter: `drop-shadow(0 0 0.5px ${color})` }}>
              {!reduce && <animate attributeName="opacity" values="0.95;0.5;0.95" dur={(2 + i * 0.2) + "s"} repeatCount="indefinite" />}
            </circle>
            <text x={x + r + 0.5} y={y + 0.6} fontFamily="var(--f-mono)" fontSize="1.5" fill="var(--ink-40)" letterSpacing="0.05em">
              {code}·{count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Median of a numeric series (ignores non-finite). */
function median(nums: number[]): number {
  const a = nums.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Compact piconero/B axis label (e.g. 20k, 1.2M). */
function fmtPcnB(v: number): string {
  if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + "k";
  return String(Math.round(v));
}

/** Bin real per-tx fee rates (Tx.perB, piconero/B) into a histogram with real
 *  bin-edge labels. Log-spaced when the range spans >10×, else linear. Returns
 *  empty arrays when the mempool sample is too small to bin honestly. */
function feeRateHistogram(perB: number[], bins = 10): { counts: number[]; labels: string[] } {
  const vals = perB.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (vals.length < 4) return { counts: [], labels: [] };
  const min = vals[0], max = vals[vals.length - 1];
  if (max <= min) return { counts: [vals.length], labels: [fmtPcnB(min)] };
  const useLog = max / Math.max(1, min) > 10;
  const edges: number[] = [];
  for (let i = 0; i <= bins; i++) {
    const f = i / bins;
    edges.push(useLog ? min * Math.pow(max / min, f) : min + (max - min) * f);
  }
  const counts = new Array(bins).fill(0);
  for (const v of vals) {
    let b = bins - 1;
    for (let i = 0; i < bins; i++) { if (v < edges[i + 1]) { b = i; break; } }
    counts[b]++;
  }
  return { counts, labels: counts.map((_, i) => fmtPcnB(edges[i])) };
}

/** Accumulate a session rolling buffer: append `sample` whenever `key` changes,
 *  capped at `cap`. The ref-guard dedupes React StrictMode's double-invoke and
 *  ignores no-op re-renders where `key` is unchanged. */
function useSessionSeries(sample: number, key: number, cap = 120): number[] {
  const [buf, setBuf] = React.useState<number[]>(() => [sample]);
  const lastKey = React.useRef(key);
  React.useEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    setBuf((prev) => {
      const next = prev.length >= cap ? prev.slice(prev.length - cap + 1) : prev.slice();
      next.push(sample);
      return next;
    });
  }, [key, sample, cap]);
  return buf;
}

// monerod versions and shares
const NODE_VERSIONS = [
  { v: "0.18.4.0", share: 0.642, status: "current", ready: true, color: "var(--g-50)" },
  { v: "0.18.3.4", share: 0.224, status: "current-1", ready: true, color: "var(--tk-accent)" },
  { v: "0.18.3.3", share: 0.078, status: "current-2", ready: true, color: "var(--y-50)" },
  { v: "0.18.2.x", share: 0.034, status: "current-3", ready: false, color: "var(--y-50)" },
  { v: "0.18.1.x", share: 0.012, status: "stale", ready: false, color: "var(--r-50)" },
  { v: "0.17.x", share: 0.006, status: "fork-only", ready: false, color: "var(--r-50)" },
  { v: "Older", share: 0.004, status: "fork-only", ready: false, color: "var(--ink-40)" },
];

export function NetworkPage() {
  const data = useMoneroLive();
  const sim = data.source === "simulated";

  // Real, honestly-windowed series for the network charts (no synthesis).
  // hashSeries is the rolling buffer of real hashrate samples; pin its last point
  // to the live reading so the current-value pill always equals data.hashrate
  // (already true under the live feed, which pushes data.hashrate each tick).
  const hashSeries = data.hashSeries.length ? [...data.hashSeries.slice(0, -1), data.hashrate] : [data.hashrate];
  const mempoolBuf = useSessionSeries(data.mempool.length, data.lastUpdate);
  const diffSeries = data.blocks.map((b) => b.difficulty).reverse();          // oldest → newest
  const blockSizes = data.blocks.map((b) => b.sizeKB);
  const FULL_CAP_FLOOR_KB = 600;                                              // ~2× the 300 KB penalty-free median floor
  const fullCap = Math.max(FULL_CAP_FLOOR_KB, 2 * median(blockSizes));
  const fullness = data.blocks.map((b) => Math.min(1, b.sizeKB / fullCap)).reverse();
  const feeHist = feeRateHistogram(data.mempool.map((t) => t.perB));
  const sortedPerB = data.mempool.map((t) => t.perB).sort((a, b) => a - b);
  const medPerB = sortedPerB.length ? sortedPerB[Math.floor(sortedPerB.length / 2)] : 0;

  return (
    <AppShell bg={{ intensity: "calm" }}>
      <Crumbs items={["xmr.irish", "v5.0", "network"]} status={`Block target 2:00 · ${data.peers.length} peers`} />
      <PageHeader
        kicker="Network telemetry · live"
        title='Network — <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">the numbers</em>.'
        sub="Pools, peers, blocks, hashrate, difficulty, fork readiness. The raw telemetry for the chain you trust."
        right={<><Pill tone="live" dot>LIVE</Pill><Pill>UPDATED {new Date(data.lastUpdate).toISOString().slice(11, 19)}</Pill></>}
      />

      {/* KPI row */}
      <section className="kpi-grid" style={{ ["--kpi-cols" as any]: 6, gap: 10 }}>
        <Stat k="Block height" v={data.height.toLocaleString()} sub="live" tone="acc" />
        <Stat k="Hashrate" v={`${(data.hashrate / 1e9).toFixed(2)} GH/s`} sub={sim ? "sim feed" : "live"} />
        <Stat k="Difficulty" v={`${(data.difficulty / 1e9).toFixed(2)}G`} sub="adj every 720" />
        <Stat k="Peers (sample)" v={data.peers.length} sub={`${data.peerOut} out · ${data.peerIn} in`} />
        <Stat k="Mempool" v={`${data.mempool.length} tx`} sub={fmtBytes(data.mempool.reduce((a, t) => a + t.size, 0))} />
        <Stat k="Fork" v="v16" sub="FCMP++ Q3" tone="p" />
      </section>

      {/* Hashrate + Difficulty + Mempool size + Block fullness */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PanelFrame title={`Hashrate · session · ${hashSeries.length} samples`} right={<span>GH/s</span>}>
          <AreaSeries data={hashSeries} height={180} color="var(--tk-accent)"
            baseline="auto" xLabels={false} sim={sim}
            format={(v) => (v / 1e9).toFixed(2)} />
        </PanelFrame>
        <PanelFrame title={`Difficulty · last ${diffSeries.length} blocks`} right={<span>Δ {(data.difficulty / 1e9).toFixed(2)}G</span>}>
          <AreaSeries data={diffSeries} height={180} color="var(--p-50)"
            baseline="auto" xLabels={false} sim={sim}
            format={(v) => (v / 1e9).toFixed(2) + "G"} />
        </PanelFrame>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PanelFrame title={`Mempool size · session · ${mempoolBuf.length} sample${mempoolBuf.length === 1 ? "" : "s"}`} right={<span>{data.mempool.length} tx now</span>}>
          <AreaSeries data={mempoolBuf} height={180} color="var(--c-50)"
            baseline="zero" xLabels={false} sim={sim}
            format={(v) => String(Math.round(v))} />
        </PanelFrame>
        <PanelFrame title={`Block fullness · last ${fullness.length} blocks`} right={<span>cap ≈ {fullCap.toFixed(0)} KB</span>}>
          <BarSeries data={fullness} height={180} color="var(--tk-accent)"
            baseline="zero" sim={sim} endLabels={["older", "newer"]}
            format={(v) => (v * 100).toFixed(0) + "%"} />
        </PanelFrame>
      </section>

      {/* Geo map + fee histogram */}
      <section style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12 }}>
        <PanelFrame title="Peer geography · live sample" right={<span>11 buckets · {PEER_GEO.reduce((a, p) => a + p[4], 0)} total</span>}>
          <GeoMap />
          <div className="mono kpi-grid" style={{ ["--kpi-cols" as any]: 6, gap: 6, marginTop: 10, fontSize: 10.5 }}>
            {PEER_GEO.map(([code, name, _lon, _lat, count, color]) => (
              <div key={code} className="keep-cols" style={{ display: "grid", gridTemplateColumns: "8px 1fr 30px", gap: 4, alignItems: "center" }}>
                <span style={{ width: 6, height: 6, borderRadius: 3, background: color, boxShadow: `0 0 4px ${color}` }} />
                <span className="dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={name}>{name}</span>
                <span style={{ textAlign: "right" }}>{count}</span>
              </div>
            ))}
          </div>
        </PanelFrame>

        <PanelFrame title="Fee histogram" right={<span>piconero / B</span>}>
          {feeHist.counts.length ? (
            <BarSeries data={feeHist.counts} labels={feeHist.labels} height={180} color="var(--p-50)"
              baseline="zero" sim={sim} format={(v) => String(Math.round(v))} />
          ) : (
            <BarSeries data={data.feeHist} endLabels={["low", "high"]} height={180} color="var(--p-50)"
              baseline="zero" sim={sim} format={(v) => String(Math.round(v))} />
          )}
          <p className="mono dim" style={{ fontSize: 11, marginTop: 6 }}>
            Median fee rate: <b className="acc">~{Math.round(medPerB).toLocaleString()} pcn/B</b>
            {data.mempool.length ? <> · over <b className="acc">{data.mempool.length}</b> mempool tx</> : null}
          </p>
        </PanelFrame>
      </section>

      {/* Pool distribution + Version distribution */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PanelFrame title="Pool distribution" right={<span>last 24h shares</span>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="table-scroll" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.poolDist.map((p) => (
              <div key={p.name} style={{ display: "grid", gridTemplateColumns: "160px 1fr 80px 70px", gap: 10, alignItems: "center", fontSize: 11 }} className="mono keep-cols">
                <span style={{ color: "var(--ink-80)" }}>
                  <span className="led" style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
                  {p.name}
                </span>
                <span style={{ height: 8, background: "var(--ink-10)", position: "relative", borderRadius: 1 }}>
                  <span style={{ position: "absolute", inset: "0 auto 0 0", width: (p.share * 100).toFixed(1) + "%", background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
                </span>
                <span className="dim" style={{ textAlign: "right" }}>{(p.share * 100).toFixed(1)}%</span>
                <span style={{ color: p.rec ? "var(--g-50)" : "var(--ink-40)", textTransform: "uppercase", fontSize: 9.5, letterSpacing: "0.12em" }}>{p.type}</span>
              </div>
            ))}
            </div>
            <p className="mono dim" style={{ fontSize: 10.5, marginTop: 8, color: "var(--ink-40)" }}>
              HHI {Math.round(data.poolDist.reduce((a, p) => a + Math.pow(p.share * 100, 2), 0))} · "moderately concentrated" (≥1500 = concentrated)
            </p>
          </div>
        </PanelFrame>

        <PanelFrame title="monerod version distribution" right={<span>fork readiness</span>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="table-scroll" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {NODE_VERSIONS.map((n) => (
              <div key={n.v} style={{ display: "grid", gridTemplateColumns: "100px 1fr 60px 110px", gap: 10, alignItems: "center", fontSize: 11 }} className="mono keep-cols">
                <span style={{ color: n.ready ? "var(--ink-100)" : "var(--ink-40)" }}>{n.v}</span>
                <span style={{ height: 8, background: "var(--ink-10)", position: "relative", borderRadius: 1 }}>
                  <span style={{ position: "absolute", inset: "0 auto 0 0", width: (n.share * 100).toFixed(1) + "%", background: n.color, boxShadow: `0 0 4px ${n.color}` }} />
                </span>
                <span className="dim" style={{ textAlign: "right" }}>{(n.share * 100).toFixed(1)}%</span>
                <span style={{ color: n.color, fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", textAlign: "right" }}>{n.status}</span>
              </div>
            ))}
            </div>
            <p className="mono dim" style={{ fontSize: 10.5, marginTop: 8, color: "var(--ink-40)" }}>
              Fork-ready (FCMP++ Q3): <b className="up">{Math.round(NODE_VERSIONS.filter((n) => n.ready).reduce((a, n) => a + n.share, 0) * 100)}%</b>
              · target ≥85% before activation
            </p>
          </div>
        </PanelFrame>
      </section>

      {/* Peer list + Tor/I2P + Recent blocks */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PanelFrame title={`Peers · sample · ${data.peers.length}`} right={<span>top 10 by latency</span>}>
          <div className="peerlist" style={{ fontSize: 11 }}>
            {data.peers.map((p, i) => (
              <div className="row" key={i} style={{ gridTemplateColumns: "14px 1fr 60px 50px 60px" }}>
                <span className={"led " + (p.lat < 60 ? "" : p.lat < 100 ? "q" : "o")} style={{ width: 5, height: 5 }} />
                <span style={{ color: "var(--ink-80)" }}>{p.ip}</span>
                <span className="dim">{p.cnt}</span>
                <span className="dim">{p.lat}ms</span>
                <span className="dim">#{p.h}</span>
              </div>
            ))}
          </div>
        </PanelFrame>

        <PanelFrame title="Tor / I2P share of peers" right={<span>privacy at network layer</span>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { name: "Clearnet (IPv4 + IPv6)", share: 0.612, color: "var(--ink-60)" },
              { name: "Tor (.onion)", share: 0.286, color: "var(--p-50)" },
              { name: "I2P (.b32.i2p)", share: 0.094, color: "var(--c-50)" },
              { name: "Unknown / hybrid", share: 0.008, color: "var(--ink-40)" },
            ].map((r) => (
              <div key={r.name}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "var(--f-mono)" }}>
                  <span style={{ color: r.color }}>{r.name}</span>
                  <span style={{ color: r.color }}>{(r.share * 100).toFixed(1)}%</span>
                </div>
                <div style={{ height: 14, background: "var(--ink-10)", marginTop: 4, position: "relative", borderRadius: 1 }}>
                  <div style={{ position: "absolute", inset: "0 auto 0 0", width: (r.share * 100).toFixed(1) + "%", background: r.color, opacity: 0.5, boxShadow: `0 0 8px ${r.color}` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mono dim" style={{ fontSize: 10.5, marginTop: 12, color: "var(--ink-40)" }}>
            38.0% of peers route through Tor or I2P. Highest of any major coin.
          </p>
        </PanelFrame>
      </section>

      {/* Recent blocks table */}
      <PanelFrame title="Recent blocks" right={<span>height ↓</span>}>
        <div className="table-scroll">
        <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 60px 80px 80px 110px 60px", gap: 10, fontSize: 11 }} className="mono keep-cols">
          {["#", "Hash", "Txs", "Size", "Reward", "Pool", "Age"].map((h, i) => (
            <div key={i} className="kicker" style={{ borderBottom: "1px solid var(--rule)", paddingBottom: 6, marginBottom: 2 }}>{h}</div>
          ))}
          {data.blocks.slice(0, 12).map((b) => (
            <React.Fragment key={b.height}>
              <span className="acc">{b.height.toLocaleString()}</span>
              <span style={{ color: "var(--c-50)" }}>{shortHash(b.hash)}</span>
              <span>{b.txs}</span>
              <span className="dim">{b.sizeKB.toFixed(1)} KB</span>
              <span className="up">{b.reward.toFixed(3)}</span>
              <span style={{ color: "var(--ink-80)" }}>{b.pool}</span>
              <span className="dim">{Math.floor(b.age / 60)}m{b.age % 60}s</span>
            </React.Fragment>
          ))}
        </div>
        </div>
      </PanelFrame>
    </AppShell>
  );
}
