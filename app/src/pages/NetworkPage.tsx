/**
 * pages/NetworkPage.tsx — Network telemetry surface (all-real data).
 *
 * Recent blocks + hashrate sparkline + difficulty curve + block fullness
 * + fee histogram + mempool size over time + block-interval histogram
 * + pool attribution + remote-node / chain-meta readouts + block-weight
 * median-vs-limit bar.
 *
 * Standalone page: owns its <AppShell> chrome. Every number on this page
 * comes from `useMoneroLive()` — node RPC via the public node cascade plus
 * CoinGecko for market data elsewhere. Chain values render "—" until the
 * first snapshot lands (`data.ready`); if polling fails after a healthy
 * start, the header pill flips to STALE · RECONNECTING and the charts dim
 * (`data.stale`). Nothing on this page is synthesized or hard-coded.
 */

import * as React from "react";
import { Link } from "react-router-dom";
import { AppShell, PageHeader } from "@/layout/AppShell";
import { Stat, PanelFrame, Crumbs, Pill, Provenance, DataLegend } from "@/design/primitives";
import { AreaSeries, BarSeries } from "./markets/charts";
import { fmtN, fmtBytes, shortHash } from "@/data/types";
import { FEE_TIER_LABELS } from "@/data/map";
import { useMoneroLive } from "@/data/DataContext";

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

/** Compact seconds label for interval bin edges (e.g. 45s, 2.5m, 12m). */
function fmtSecs(s: number): string {
  if (s >= 120) return (s / 60).toFixed(s >= 600 ? 0 : 1) + "m";
  return Math.round(s) + "s";
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

/** Bin real block intervals (seconds) into a linear histogram with real
 *  second-valued bin-edge labels, plus the median bin index for the on-chart
 *  marker. Returns empty arrays when the sample is too small to bin honestly. */
function intervalHistogram(intervals: number[], bins = 12): {
  counts: number[]; labels: string[]; medBin: number; med: number; mean: number;
} {
  if (intervals.length < 4) return { counts: [], labels: [], medBin: -1, med: 0, mean: 0 };
  const sorted = [...intervals].sort((a, b) => a - b);
  const lo = sorted[0];
  const span = Math.max(1, sorted[sorted.length - 1] - lo);
  const counts = new Array(bins).fill(0);
  const binOf = (v: number) => Math.min(bins - 1, Math.max(0, Math.floor(((v - lo) / span) * bins)));
  for (const v of intervals) counts[binOf(v)]++;
  const med = median(intervals);
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  return {
    counts,
    labels: counts.map((_, i) => fmtSecs(lo + (i / bins) * span)),
    medBin: binOf(med),
    med,
    mean,
  };
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

/** Mono key/value grid rows — the same idiom as the recent-blocks table. */
function KVRows({ rows }: { rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <div className="mono keep-cols" style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "9px 10px", fontSize: 11, alignItems: "center" }}>
      {rows.map(([k, v], i) => (
        <React.Fragment key={i}>
          <span className="dim">{k}</span>
          <span style={{ textAlign: "right", color: "var(--ink-80)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

export function NetworkPage() {
  const data = useMoneroLive();
  const ready = data.ready;

  // Real, honestly-windowed series for the network charts (no synthesis).
  // hashSeries is the rolling buffer of real hashrate samples; pin its last point
  // to the live reading so the current-value pill always equals data.hashrate
  // (already true under the live feed, which pushes data.hashrate each tick).
  // Empty until the first snapshot lands — the charts render nothing, not zeros.
  const hashSeries = ready
    ? (data.hashSeries.length ? [...data.hashSeries.slice(0, -1), data.hashrate] : [data.hashrate])
    : [];
  const mempoolBuf = useSessionSeries(data.mempool.length, data.lastUpdate);
  // If this page mounted before the first snapshot, the buffer's mount-time seed
  // was a placeholder zero, not a reading — drop it rather than chart it.
  const seededPreReady = React.useRef(!ready);
  const mempoolSeries = ready ? (seededPreReady.current ? mempoolBuf.slice(1) : mempoolBuf) : [];
  // BLOCKS_CAP is now 100 (Sediment); these mini-charts intentionally keep the recent 14-block window.
  const recentBlocks = data.blocks.slice(0, 14);
  const diffSeries = recentBlocks.map((b) => b.difficulty).reverse();          // oldest → newest
  const blockSizes = recentBlocks.map((b) => b.sizeKB);
  const FULL_CAP_FLOOR_KB = 600;                                              // ~2× the 300 KB penalty-free median floor
  const fullCap = Math.max(FULL_CAP_FLOOR_KB, 2 * median(blockSizes));
  const fullness = recentBlocks.map((b) => Math.min(1, b.sizeKB / fullCap)).reverse();
  const feeHist = feeRateHistogram(data.mempool.map((t) => t.perB));
  const sortedPerB = data.mempool.map((t) => t.perB).sort((a, b) => a - b);
  const medPerB = sortedPerB.length ? sortedPerB[Math.floor(sortedPerB.length / 2)] : 0;
  // Median BUCKET index (cumulative-50% crossing) for the on-chart fee marker (P3).
  const medBucket = (() => {
    const c = feeHist.counts;
    const total = c.reduce((a, b) => a + b, 0);
    if (!total) return -1;
    let acc = 0;
    for (let i = 0; i < c.length; i++) { acc += c[i]; if (acc >= total / 2) return i; }
    return c.length - 1;
  })();
  // Block intervals from the real block sample (newest-first): the gap between a
  // block and its parent is blocks[i+1].age - blocks[i].age (older minus newer).
  // Miner timestamps are non-monotonic, so filter to a sane 5..1800 s window
  // rather than trusting raw deltas.
  const intervals: number[] = [];
  for (let i = 0; i + 1 < data.blocks.length; i++) {
    const iv = data.blocks[i + 1].age - data.blocks[i].age;
    if (Number.isFinite(iv) && iv >= 5 && iv <= 1800) intervals.push(iv);
  }
  const ivHist = intervalHistogram(intervals);
  // Pool attribution (P2): Monero coinbase outputs are stealth addresses, so every
  // block's pool reads "Unknown" from the node alone — this is the honest signal.
  const unattributed = recentBlocks.filter((b) => !b.pool || b.pool === "Unknown" || b.pool === "—").length;
  const unattributedPct = recentBlocks.length ? Math.round((unattributed / recentBlocks.length) * 100) : 0;
  const t = data.feeTiers;
  const weightKnown = ready && data.blockWeightMedian > 0 && data.blockWeightLimit > 0;

  return (
    <AppShell bg={{ intensity: "calm" }}>
      <Crumbs items={["xmr.irish", "v5.0", "network"]} status={`Block target 2:00 · fork ${data.majorVersion ? "v" + data.majorVersion : "—"}`} />
      <DataLegend sources={["node"]} />
      <PageHeader
        kicker={<>Network telemetry <Provenance source="node" fresh="live" bare /></>}
        title='Network — <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">the numbers</em>.'
        sub="Pools, blocks, hashrate, difficulty, fees, fork readiness. The raw telemetry for the chain you trust."
        right={<>
          {data.stale
            ? <Pill tone="warn" dot>STALE · RECONNECTING</Pill>
            : ready
              ? <Pill tone="live" dot>LIVE</Pill>
              : <Pill dot>CONNECTING</Pill>}
          <Pill>UPDATED {data.lastUpdate > 0 ? new Date(data.lastUpdate).toISOString().slice(11, 19) : "—"}</Pill>
        </>}
      />

      {/* KPI row */}
      <section className="kpi-grid" style={{ ["--kpi-cols" as any]: 6, gap: 10 }}>
        <Stat k="Block height" v={ready ? data.height.toLocaleString() : "—"} sub="live" tone="acc" />
        <Stat k="Hashrate" v={ready ? `${(data.hashrate / 1e9).toFixed(2)} GH/s` : "—"} sub="live" />
        <Stat k="Difficulty" v={ready ? `${(data.difficulty / 1e9).toFixed(2)}G` : "—"} sub="adj every 720" />
        <Stat k="Total txs" v={ready ? fmtN(data.txCountTotal) : "—"} sub="all-time" />
        <Stat k="Mempool" v={ready ? `${data.mempool.length} tx` : "—"} sub={ready ? fmtBytes(data.mempool.reduce((a, x) => a + x.size, 0)) : "—"} />
        <Stat k="Fork" v={data.majorVersion ? `v${data.majorVersion}` : "—"} sub="FCMP++ Q3" tone="p" />
      </section>

      {/* Hashrate + Difficulty + Mempool size + Block fullness */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PanelFrame title={`Hashrate · session · ${hashSeries.length} sample${hashSeries.length === 1 ? "" : "s"}`} right={<span>GH/s</span>}>
          {hashSeries.length ? (
            <AreaSeries data={hashSeries} height={180} color="var(--tk-accent)"
              baseline="auto" xLabels={false} stale={data.stale}
              format={(v) => (v / 1e9).toFixed(2)} />
          ) : (
            <p className="mono dim" style={{ fontSize: 10.5, color: "var(--ink-40)" }}>Awaiting chain sample</p>
          )}
        </PanelFrame>
        <PanelFrame title={`Difficulty · last ${diffSeries.length} blocks`} right={<span>{ready ? `Δ ${(data.difficulty / 1e9).toFixed(2)}G` : "—"}</span>}>
          {diffSeries.length ? (
            <AreaSeries data={diffSeries} height={180} color="var(--p-50)"
              baseline="auto" xLabels={false} stale={data.stale}
              format={(v) => (v / 1e9).toFixed(2) + "G"} />
          ) : (
            <p className="mono dim" style={{ fontSize: 10.5, color: "var(--ink-40)" }}>Awaiting block sample</p>
          )}
        </PanelFrame>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PanelFrame title={`Mempool size · session · ${mempoolSeries.length} sample${mempoolSeries.length === 1 ? "" : "s"}`} right={<span>{ready ? `${data.mempool.length} tx now` : "—"}</span>}>
          {mempoolSeries.length ? (
            <AreaSeries data={mempoolSeries} height={180} color="var(--c-50)"
              baseline="zero" xLabels={false} stale={data.stale}
              format={(v) => String(Math.round(v))} />
          ) : (
            <p className="mono dim" style={{ fontSize: 10.5, color: "var(--ink-40)" }}>Awaiting mempool sample</p>
          )}
        </PanelFrame>
        <PanelFrame title={`Block fullness · last ${fullness.length} blocks`} right={<span>{recentBlocks.length ? `cap ≈ ${fullCap.toFixed(0)} KB` : "—"}</span>}>
          {fullness.length ? (
            <BarSeries data={fullness} height={180} color="var(--tk-accent)"
              baseline="zero" stale={data.stale} endLabels={["older", "newer"]}
              format={(v) => (v * 100).toFixed(0) + "%"} />
          ) : (
            <p className="mono dim" style={{ fontSize: 10.5, color: "var(--ink-40)" }}>Awaiting block sample</p>
          )}
        </PanelFrame>
      </section>

      {/* Block intervals + fee histogram — top-align so each panel hugs its chart. */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
        <PanelFrame title="Block intervals · last ~100 blocks" right={<span>count · seconds</span>}>
          {ivHist.counts.length ? (
            <>
              <BarSeries data={ivHist.counts} labels={ivHist.labels} height={230} color="var(--tk-accent)"
                baseline="zero" stale={data.stale} format={(v) => String(Math.round(v))}
                marker={ivHist.medBin >= 0 ? { index: ivHist.medBin, label: `median ~${Math.round(ivHist.med)}s` } : undefined} />
              <p className="mono dim" style={{ fontSize: 10.5, marginTop: 6, color: "var(--ink-40)" }}>
                μ <b className="acc">{Math.round(ivHist.mean)}s</b> · target 120 s · {intervals.length} intervals
                · timestamps are miner-set, filtered to 5–1800 s
              </p>
            </>
          ) : (
            <p className="mono dim" style={{ fontSize: 10.5, color: "var(--ink-40)" }}>Awaiting block sample</p>
          )}
        </PanelFrame>

        <PanelFrame title="Fee histogram" right={<span>tx count · piconero / B</span>}>
          {feeHist.counts.length ? (
            <BarSeries data={feeHist.counts} labels={feeHist.labels} height={230} color="var(--p-50)"
              baseline="zero" stale={data.stale} format={(v) => String(Math.round(v))}
              marker={medBucket >= 0 ? { index: medBucket, label: `median ~${Math.round(medPerB).toLocaleString()} pcn/B` } : undefined} />
          ) : (
            <BarSeries data={data.feeHist} endLabels={["low", "high"]} height={230} color="var(--p-50)"
              baseline="zero" stale={data.stale} format={(v) => String(Math.round(v))} />
          )}
          <p className="mono dim" style={{ fontSize: 10.5, marginTop: 6, color: "var(--ink-40)" }}>
            {data.mempool.length
              ? <>Over <b className="acc">{data.mempool.length}</b> mempool tx · median fee marked on-chart</>
              : <>Awaiting mempool sample</>}
          </p>
        </PanelFrame>
      </section>

      {/* Pool attribution + Remote node */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PanelFrame title="Pool attribution" right={<span className="dim">unattributed</span>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: "var(--f-mono)" }}>
            {/* lead with the real signal as a compact stat, not a paragraph */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 26, color: "var(--ink-100)" }}>{recentBlocks.length ? `${unattributedPct}%` : "—"}</span>
              <span className="dim" style={{ fontSize: 11 }}>
                {recentBlocks.length
                  ? <>unattributed · {unattributed}/{recentBlocks.length} recent blocks report pool "Unknown"</>
                  : <>awaiting block sample</>}
              </span>
            </div>
            {/* single full-width bar, matching the block-weight idiom below */}
            <div style={{ height: 14, background: "var(--ink-10)", position: "relative", borderRadius: 1 }}>
              {recentBlocks.length ? (
                <div style={{ position: "absolute", inset: "0 auto 0 0", width: unattributedPct + "%", background: "var(--ink-40)", opacity: 0.5, boxShadow: "0 0 8px var(--ink-40)" }} />
              ) : null}
            </div>
            {/* one-line caption: the why lives in a hover tooltip; Skyline link stays visible */}
            <p className="mono dim" style={{ fontSize: 10.5, margin: 0, lineHeight: 1.5, color: "var(--ink-40)" }}>
              Coinbase outputs are one-time stealth addresses — pools can't be matched on-chain{" "}
              <span
                title="Real explorers show pool names from a maintained dataset of coinbase tx_extra signatures, or a third-party pool API. Both are off-limits here: a bundled list goes stale and is partial, and an API would break the zero-third-party privacy invariant. So 'Unknown' from the node alone is the honest representation."
                style={{ cursor: "help", color: "var(--ink-60)", borderBottom: "1px dotted var(--ink-40)" }}
              >why ⓘ</span>. HHI concentration is explored in the{" "}
              <Link to="/simulate?p=skyline" className="acc">Skyline simulator</Link>.
            </p>
          </div>
        </PanelFrame>

        <PanelFrame title="Remote node" right={<Provenance source="node" fresh="live" detail="public node cascade" />}>
          <KVRows rows={[
            ["Daemon", ready && data.version ? data.version : "—"],
            ["Network", ready && data.nettype ? data.nettype : "—"],
            ["DB size", ready && data.databaseSize > 0 ? `${(data.databaseSize / 1e9).toFixed(1)} GB` : "—"],
            ["Synchronized", ready
              ? (data.synchronized
                ? <span style={{ color: "var(--g-50)" }}>✓ synchronized</span>
                : <span style={{ color: "var(--y-50)" }}>syncing</span>)
              : "—"],
            ["Top block", ready ? shortHash(data.topBlockHash) : "—"],
            ["Alt blocks", ready ? String(data.altBlocksCount) : "—"],
          ]} />
        </PanelFrame>
      </section>

      {/* Peer telemetry — paused placeholder. Peer topology can't come from a public
          restricted node (all peer fields read 0; get_connections / get_peer_list are
          admin-only), so instead of a misleading "0 peers" we reserve the space for real,
          node-pointed telemetry. No fabricated peers, IPs, latencies, counts, or geography. */}
      <PanelFrame
        title="Connections · peer telemetry"
        right={<><Provenance source="node" /><span className="soon-badge">Soon</span></>}
        style={{ opacity: 0.62 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: "var(--f-mono)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 26, color: "var(--ink-60)" }}>—</span>
            <span className="dim" style={{ fontSize: 11 }}>Not live network data — peer telemetry paused</span>
          </div>
          <p className="mono dim" style={{ fontSize: 10.5, margin: 0, lineHeight: 1.5, color: "var(--ink-40)" }}>
            Peer topology — connection counts, the peer list, and latencies — requires a dedicated
            unrestricted node. The public node cascade this site reads runs restricted RPC (all peer
            fields report 0, peer lists are admin-only), so this panel stays paused and populates
            once a node is pointed at the site. No peer data is shown here until then.
          </p>
        </div>
      </PanelFrame>

      {/* Chain meta + Block weight */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <PanelFrame title="Chain meta" right={<Provenance source="node" fresh="live" detail="node reported" />}>
          <KVRows rows={[
            ["RandomX seed", ready ? shortHash(data.randomxSeedHash) : "—"],
            ["Adjusted time", ready && data.adjustedTime > 0 ? new Date(data.adjustedTime * 1000).toISOString().slice(11, 19) + " UTC" : "—"],
            ["Nettype", ready && data.nettype ? data.nettype : "—"],
            ["Txs all-time", ready ? fmtN(data.txCountTotal) : "—"],
            ["Fee tiers", ready && t.length === 4
              ? <span title={FEE_TIER_LABELS.join(" / ")}>{`${fmtPcnB(t[0])}/${fmtPcnB(t[1])}/${fmtPcnB(t[2])}/${fmtPcnB(t[3])} pcn/B`}</span>
              : "—"],
          ]} />
        </PanelFrame>

        <PanelFrame title="Block weight · median vs limit" right={<span>dynamic block size</span>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: "var(--f-mono)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
              <span style={{ color: "var(--tk-accent)" }}>median {ready && data.blockWeightMedian > 0 ? fmtBytes(data.blockWeightMedian) : "—"}</span>
              <span className="dim">limit {ready && data.blockWeightLimit > 0 ? fmtBytes(data.blockWeightLimit) : "—"}</span>
            </div>
            {/* single full-width bar: median weight as a fraction of the dynamic limit */}
            <div style={{ height: 14, background: "var(--ink-10)", position: "relative", borderRadius: 1 }}>
              {weightKnown ? (
                <div style={{ position: "absolute", inset: "0 auto 0 0", width: Math.min(100, (data.blockWeightMedian / data.blockWeightLimit) * 100).toFixed(1) + "%", background: "var(--tk-accent)", opacity: 0.5, boxShadow: "0 0 8px var(--tk-accent)" }} />
              ) : null}
            </div>
            <p className="mono dim" style={{ fontSize: 10.5, margin: 0, lineHeight: 1.5, color: "var(--ink-40)" }}>
              Monero's block size is dynamic: blocks above the median weight enter the penalty
              zone and pay a quadratic coinbase-reward penalty, and the node's dynamic limit
              is 2× the median — so the limit grows only as sustained demand lifts the median.
            </p>
          </div>
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
