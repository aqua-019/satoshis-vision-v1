/**
 * pages/NetworkPage.tsx — Network telemetry surface (all-real data).
 *
 * Recent blocks + hashrate sparkline + difficulty curve + block fullness
 * + fee histogram + mempool size over time + block-interval histogram
 * + pool attribution + remote-node / chain-meta readouts + block-weight
 * median-vs-limit bar.
 *
 * Standalone page: owns its <PageShell> chrome. Every number on this page
 * comes from `useMoneroLive()` — node RPC via the public node cascade plus
 * CoinGecko for market data elsewhere. Chain values render "—" until the
 * first snapshot lands; if polling fails after a healthy start the header pill
 * flips to STALE · reconnecting. Each chart dims on the status of the ENDPOINT
 * ITS OWN DATA COMES FROM (`isStale(data.status.<key>)`), not on a page-wide
 * flag — so a dead /api/xmr/blocks dims the block panels and leaves the mempool
 * chart live. Nothing on this page is synthesized or hard-coded.
 */

import * as React from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/layout/AppShell";
import { PageShell } from "@/layout/PageShell";
import { Stat, PanelFrame, Crumbs, Pill, Provenance, NodeProvenance, DataLegend, type PanelFrameProps, type ProvSource } from "@/design/primitives";
import { AreaSeries, BarSeries } from "./markets/charts";
import { fmtN, fmtBytes, shortHash } from "@/data/types";
import { FEE_TIER_LABELS } from "@/data/map";
import { useMoneroLive } from "@/data/DataContext";
import { feeRateHistogram, intervalHistogram } from "@/data/histogram";
import { assertNever, CHAIN_CHROME_KEYS, FEED_ENDPOINT, freshAt, hasData, isDown, isStale, oldestFreshAt, type FeedKey, type FeedStatusMap } from "@/data/feed-status";
import { CHROME_LABEL, chromeDetail, useChromeState } from "@/design/useOnline";
import { Swap, SkeletonBox, SkeletonRows } from "@/design/Skeleton";
import { PanelBoundary } from "@/design/PanelBoundary";
import { useFeedActivity } from "@/data/feed-activity";
import { usePendingDelay } from "@/design/usePendingDelay";
import { NodePopulationPanel } from "./network/NodePopulationPanel";
import { BLOCK_TARGET_S, backlogBand, bandWindowLabel, cadenceBand, meanOf, sigmaBand, worstZone } from "./network/bands";
import { BandNote, CADENCE_H, CadenceStrip, HealthChip, SimLink, zoneOf } from "./network/BandPanels";
import { useDifficultyStream } from "./network/useDifficultyStream";
import { StreamPanel, streamView } from "./network/StreamPanel";
import { SmallMultiples, type TileSpec } from "./network/SmallMultiples";
import { SyncShell, type SyncColumn } from "./network/SyncShell";
import { heightAgreementPct, useNodePopulation } from "@/data/useNodePopulation";
import { R } from "../../scripts/routes.mjs";

/* Chart formatters are hoisted to module scope so their identity is stable
   across renders. `AreaSeries`/`BarSeries` are React.memo'd (see
   pages/markets/charts.tsx) and an inline `format={(v) => …}` arrow allocates
   a fresh function every render, which defeats the boundary entirely. None of
   these close over anything, so module scope is where they belonged anyway. */
const fmtGiga = (v: number): string => (v / 1e9).toFixed(2);
const fmtGigaSuffix = (v: number): string => (v / 1e9).toFixed(2) + "G";
const fmtRound = (v: number): string => String(Math.round(v));
const fmtPct = (v: number): string => (v * 100).toFixed(0) + "%";


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
    <div className="mono keep-cols" style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "9px 10px", fontSize: "var(--fs-mono)", alignItems: "center" }}>
      {rows.map(([k, v], i) => (
        <React.Fragment key={i}>
          <span className="dim">{k}</span>
          <span style={{ textAlign: "right", color: "var(--ink-80)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * `DataPanel`'s `keys` is read by `useFeedActivity` (via `DataPanel` itself,
 * below), which requires a referentially STABLE array — a fresh `["blocks"]`
 * literal every render would resubscribe on every tick. Module-scope `as
 * const` tuples give every call site below the same array identity across
 * renders (and across the several panels that read the same endpoint), so
 * the hook sees a real no-op re-render rather than a constant identity churn.
 */
const KEYS_NETWORK = ["network"] as const;
const KEYS_BLOCKS = ["blocks"] as const;
const KEYS_MEMPOOL = ["mempool"] as const;
const KEYS_MEMPOOL_FEES = ["mempool", "fees"] as const;
const KEYS_NETWORK_FEES = ["network", "fees"] as const;
/** The small-multiples grid spans all three chart endpoints; NodeProvenance
 *  folds them worst-of. */
const KEYS_SMALL_MULTIPLES = ["blocks", "network", "mempool"] as const;

/** Shared by the recent-blocks table's real grid and its `SkeletonRows`
 *  placeholder, so the placeholder's columns line up with the real table's
 *  exactly — one string, two consumers, and the swap moves nothing. */
const BLOCKS_TABLE_COLS = "100px 1fr 60px 80px 80px 110px 60px";

/**
 * The three non-overlapping situations a chart/table with nothing to draw can
 * be in (brief §3). "waiting" carries no copy of its own — the `Swap`
 * skeleton already says it, and prose over a shimmer would say it twice.
 */
type EmptyReason = "waiting" | "empty" | "down";

function emptyReason(status: FeedStatusMap, keys: readonly FeedKey[]): EmptyReason {
  if (keys.some((k) => isDown(status[k]))) return "down";
  if (keys.some((k) => hasData(status[k]))) return "empty";
  return "waiting";
}

/**
 * Failure copy for a chart/table whose endpoint answered before and is now
 * failing. Names the actual DOWN key(s) via `FEED_ENDPOINT` — the same
 * vocabulary `PanelBoundary` uses for a thrown render, so a live data hole and
 * a thrown one read as one system rather than two.
 */
function downNote(status: FeedStatusMap, keys: readonly FeedKey[], tail: string): string {
  const down = keys.filter((k) => isDown(status[k]));
  const named = (down.length ? down : keys).map((k) => FEED_ENDPOINT[k]);
  return `${named.join(" · ")} not answering — ${tail}`;
}

/** One line of dim mono text, reserving the same height the chart it replaces
 *  would occupy — the "down"/"empty" states cost no layout shift either. */
function ChartNote({ height, children }: { height: number; children: React.ReactNode }) {
  return (
    <div
      className="mono dim"
      style={{ minHeight: height, display: "flex", alignItems: "center", fontSize: "var(--fs-mono)", color: "var(--ink-40)" }}
    >
      {children}
    </div>
  );
}

/**
 * One measured chart's body: the real chart when there is anything to draw,
 * else exactly one of the three §3 situations.
 *
 * `chart` is rendered both when ready AND while still waiting — never
 * swapped for a different root — because every chart in `./markets/charts`
 * already mounts its own ref-attached `.chart-box` via `EmptyBox` even when
 * its `data` is `[]`. Swapping it for `ChartNote` mid-flight would only be
 * safe for "down"/"empty" (definitive, not a data type the chart will ever
 * populate without a real endpoint recovery, which remounts this component
 * tree via `resetKeys` anyway).
 */
function ChartBody({
  status, keys, height, hasContent, chart, emptyNote, downTail,
}: {
  status: FeedStatusMap;
  keys: readonly [FeedKey, ...FeedKey[]];
  height: number;
  /** True once there is real content to draw. */
  hasContent: boolean;
  chart: React.ReactNode;
  /** Copy for "answered, genuinely nothing to show". */
  emptyNote: React.ReactNode;
  /** Trailing clause for the down sentence; `downNote()` supplies the rest. */
  downTail: string;
}) {
  const reason = emptyReason(status, keys);
  const ready = hasContent || reason !== "waiting";
  return (
    <Swap ready={ready} reserve={height} skeleton={<SkeletonBox h={height} />}>
      {hasContent ? chart
        : reason === "down" ? <ChartNote height={height}>{downNote(status, keys, downTail)}</ChartNote>
        : reason === "empty" ? <ChartNote height={height}>{emptyNote}</ChartNote>
        : chart}
    </Swap>
  );
}

/**
 * PanelFrame, with everything it says about freshness derived from the very
 * keys it advertises.
 *
 * Passing `dataKey` and `stale` separately invites them to disagree — the
 * attribute a gate reads saying one thing and the chip a reader sees saying
 * another. One array, now FOUR things derived from it: the `data-panel-key`
 * attribute, the `· stale` chip, the "UPD" timestamp, and the provenance badge.
 *
 * The badge is in here for a reason worth stating. Before v6.1.4 two of these
 * panels passed `right={<Provenance source="node" fresh="live" …/>}` by hand
 * while DataPanel computed staleness correctly from the same keys — so on a
 * degraded network endpoint they rendered the literal text `· stale` and a
 * pulsing LIVE dot side by side, in the same flex row, four words apart. The
 * fix is not to correct those two call sites; it is to make the badge
 * underivable from anywhere except the keys, so the disagreement has no way to
 * be expressed.
 *
 * `keys` is a tuple rather than the space-separated string it used to be, so
 * the members are typed. `dataKey` still receives the joined string, byte for
 * byte, because verify-failure.mjs splits that attribute on whitespace.
 */
function DataPanel({ keys, status, provSource, provDetail, right, ...rest }: PanelFrameProps & {
  keys: readonly [FeedKey, ...FeedKey[]];
  status: FeedStatusMap;
  provSource?: ProvSource;
  provDetail?: React.ReactNode;
}) {
  const stale = keys.some((k) => isStale(status[k]));
  const badge = provSource ? <NodeProvenance source={provSource} keys={keys} status={status} detail={provDetail} /> : null;
  /* D0858: derived HERE, not at each of eleven call sites — same reasoning as
   * dataKey/stale/updatedAt above. Each `DataPanel` invocation is its own
   * component instance, so calling hooks in its body is unconditional per
   * render; the only obligation this pushes onto callers is that `keys` be
   * referentially stable, which useFeedActivity itself already requires (see
   * the module-scope KEYS_* consts above). Wrapped in usePendingDelay so a
   * refresh that resolves in under 100ms never flickers the chip. */
  const refreshing = usePendingDelay(useFeedActivity(keys).busy);
  return (
    <PanelFrame
      {...rest}
      dataKey={keys.join(" ")}
      stale={stale}
      updatedAt={oldestFreshAt(status, keys)}
      refreshing={refreshing}
      right={badge ? <>{badge}{right}</> : right}
    />
  );
}

export function NetworkPage() {
  const data = useMoneroLive();
  const chromeState = useChromeState(data.status, CHAIN_CHROME_KEYS);
  const ready = hasData(data.status.network);
  /** The mempool endpoint answers independently of the chain one — /api/xmr/mempool
   *  is on the 3s fast tier, /api/xmr/network on the 15s chain tier. */
  const poolReady = hasData(data.status.mempool);

  // Real, honestly-windowed series for the network charts (no synthesis).
  // hashSeries is the rolling buffer of real hashrate samples; pin its last point
  // to the live reading so the current-value pill always equals data.hashrate
  // (already true under the live feed, which pushes data.hashrate each tick).
  // Empty until the first snapshot lands — the charts render nothing, not zeros.
  const hashSeries = ready
    ? (data.hashSeries.length ? [...data.hashSeries.slice(0, -1), data.hashrate] : [data.hashrate])
    : [];
  // Keyed on the MEMPOOL endpoint: a sample is appended when pool data
  // actually arrives, not when any tier happens to commit.
  const mempoolBuf = useSessionSeries(data.mempool.length, freshAt(data.status.mempool));
  // If this page mounted before the first snapshot, the buffer's mount-time seed
  // was a placeholder zero, not a reading — drop it rather than chart it.
  const seededPreReady = React.useRef(!ready);
  // Gated on the MEMPOOL endpoint: this series counts data.mempool, so a cold
  // /api/xmr/network used to blank a chart whose data was arriving fine.
  const mempoolSeries = poolReady ? (seededPreReady.current ? mempoolBuf.slice(1) : mempoolBuf) : [];
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

  /* ── D0832 bands ───────────────────────────────────────────────────
     Three bands, each computed from a source the panel then prints. The
     WINDOW is part of every claim: what this page holds is `BLOCKS_CAP`
     block headers (100), which at the target is about 3.3 hours — NOT the
     30 days the mockup's hashrate caption asks for, and not a window any
     endpoint this client fetches would supply. See bands.ts's header.

     `intervals` is newest-first out of the loop above (it walks
     data.blocks, which is newest-first); the strip reads left-to-right as
     oldest→newest, so it takes a reversed copy. The MEAN is orientation-
     independent, so only the strip needs it. */
  const cadenceIntervals = intervals.slice().reverse();
  const meanInterval = meanOf(intervals);
  const cadence = cadenceBand(intervals.length);
  const cadenceZone = zoneOf(meanInterval, cadence);

  /* Difficulty's ±1σ envelope over the window actually held. `diffSeries` is
     the 14-block mini-window; the band is measured over the FULL block sample
     so the envelope is not derived from the same 14 points it is drawn over —
     a ±1σ band over its own 14 samples would sit tight around them by
     construction and could never be exceeded. */
  const diffAll = data.blocks.map((b) => b.difficulty).filter(Number.isFinite);
  const diffBand = sigmaBand(diffAll, bandWindowLabel(diffAll.length));

  /* Mempool backlog in blocks, against the node's own dynamic weight limit. */
  const poolBytes = data.mempool.reduce((a, x) => a + x.size, 0);
  const backlog = backlogBand(data.blockWeightLimit);
  const backlogDepth = data.blockWeightLimit > 0 ? poolBytes / data.blockWeightLimit : null;
  const backlogZone = zoneOf(backlogDepth, backlog);

  /* The page-header summary is the WORST of the zones actually measurable.
     A band whose inputs have not landed contributes nothing rather than a
     reassuring "healthy" — an unmeasured series is not a passing one. */
  const measuredZones = [
    meanInterval != null ? cadenceZone : null,
    backlogDepth != null ? backlogZone : null,
  ].filter((z) => z !== null);
  const healthZone = worstZone(measuredZones);
  // Pool attribution (P2): Monero coinbase outputs are stealth addresses, so every
  // block's pool reads "Unknown" from the node alone — this is the honest signal.
  const unattributed = recentBlocks.filter((b) => !b.pool || b.pool === "Unknown" || b.pool === "—").length;
  const unattributedPct = recentBlocks.length ? Math.round((unattributed / recentBlocks.length) * 100) : 0;
  const t = data.feeTiers;
  const weightKnown = ready && data.blockWeightMedian > 0 && data.blockWeightLimit > 0;
  // Recent-blocks table: a DIFFERENT window (12) than the 14-block mini-chart
  // sample above — kept as its own const so the skeleton's row count and the
  // real map() below can never drift apart.
  const blocksTableRows = data.blocks.slice(0, 12);
  // No `height` prop exists for the pool-attribution stat+bar block (it isn't
  // an SVG chart), so there is no pre-existing literal to reuse the way the
  // six real charts do. Derived instead from its own two rendered pieces —
  // the 26px stat row plus its 12px gap plus the 14px bar — so the reserve
  // still describes real layout rather than an invented number.
  /* MEASURED, not derived, across ALL THREE states — and the third is the one
     that bit. The arithmetic 26 + 12 + 14 = 52 describes the POPULATED state;
     the empty note renders 56; and the LOADING state — the stat row rendered
     with placeholder em-dashes at opacity 0 beneath the skeleton — renders 61
     once Geist replaces the fallback font. 56 therefore sat 5px BELOW its own
     content's tallest state, so the wrapper stopped tracking the reservation
     and tracked its content instead.

     That is why it was intermittent rather than constant: the height is only
     wrong while the loading state is on screen, so a run where fixtures land
     before §A's t=2500 sample measures 56 and passes. It reproduces on
     origin/main identically (56 -> 61), so it predates the nav work; CI is
     simply slower than this sandbox and sampled the state that was always
     wrong. A reservation that is correct only when the network is fast is not
     a reservation.

     Measured from the rendered boxes, not counted from a formula — counting is
     what produced 52 and then 56. Unlike the six chart panels this one has no
     `height` prop to borrow, so the constant must be >= the tallest state, and
     the tallest state is the loading one. */
  const POOL_ATTR_H = 61;

  /* ── D0828 streaming difficulty ────────────────────────────────────
     Seeded once from /api/xmr/network/difficulty, appended from the chain
     tier's block headers at zero extra request cost. `streamView` is computed
     HERE, once, and handed to both consumers — the panel and its small-
     multiples tile — so the two cannot derive the same window two ways. */
  const stream = useDifficultyStream(data.blocks);
  const streamV = streamView(stream);

  /* Public-node census, for the sync shell's NETWORK column. The hook is a
     module-level store, so this second subscriber shares NodePopulationPanel's
     fetch rather than issuing its own. */
  const pop = useNodePopulation();
  const popOk = pop.data && pop.data.status !== "unavailable" ? pop.data : null;
  const agreement = popOk ? heightAgreementPct(popOk.height) : null;

  /* BLOCK PRODUCTION VELOCITY, from real header timestamps only.
     (lastHeight − firstHeight) over the wall-clock span those two headers
     themselves report. Never Date.now()-derived: `Block.timestamp` exists
     precisely so this is a measurement rather than a reconstruction. Null
     under two points or a non-positive span — a rate over zero elapsed time
     is a division, not a reading. */
  const velocityPerH = (() => {
    const p = stream.points;
    if (p.length < 2) return null;
    const dh = p[p.length - 1].height - p[0].height;
    const dt = p[p.length - 1].t - p[0].t;
    if (!(dt > 0) || !(dh > 0)) return null;
    return (dh / dt) * 3600;
  })();

  /* ── D0837 small multiples ─────────────────────────────────────────
     Each tile scales to its OWN extent; the SHARED thing is the band grammar.
     See SmallMultiples.tsx's header for why they do not share a y-axis. */
  const idx = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
  const tiles: TileSpec[] = [
    {
      id: "difficulty-stream",
      title: "Difficulty · streamed",
      unit: "difficulty",
      xs: streamV.xs, ys: streamV.ys, band: streamV.band,
      /* The BLOCKS endpoint, not the seed — same content/freshness split
         StreamPanel's header explains. A dead seed shortens this tile's
         window; it does not make the tile last-good. */
      color: "var(--p-50)", stale: isStale(data.status.blocks),
      format: fmtGigaSuffix,
    },
    {
      id: "difficulty-headers",
      title: `Difficulty · last ${diffAll.length} headers`,
      unit: "difficulty",
      xs: idx(diffAll.length), ys: diffAll.slice().reverse(), band: diffBand,
      color: "var(--p-50)", stale: isStale(data.status.blocks),
      format: fmtGigaSuffix,
    },
    {
      id: "cadence",
      title: "Block cadence",
      unit: "seconds per block",
      xs: idx(cadenceIntervals.length), ys: cadenceIntervals,
      band: sigmaBand(cadenceIntervals, bandWindowLabel(cadenceIntervals.length)),
      color: "var(--c-50)", stale: isStale(data.status.blocks),
      format: (v) => `${Math.round(v)}s`,
    },
    {
      id: "hashrate-session",
      title: "Hashrate · session",
      unit: "GH/s (derived)",
      xs: idx(hashSeries.length), ys: hashSeries,
      band: sigmaBand(hashSeries, `${hashSeries.length} session samples`),
      color: "var(--tk-accent)", stale: isStale(data.status.network),
      format: fmtGigaSuffix,
    },
    {
      id: "mempool-session",
      title: "Mempool · session",
      unit: "transactions",
      xs: idx(mempoolSeries.length), ys: mempoolSeries,
      band: sigmaBand(mempoolSeries, `${mempoolSeries.length} session samples`),
      color: "var(--c-50)", stale: isStale(data.status.mempool),
      format: (v) => `${Math.round(v)} tx`,
    },
    {
      id: "fullness",
      title: `Block fullness · last ${fullness.length}`,
      unit: "fraction of cap",
      xs: idx(fullness.length), ys: fullness,
      band: sigmaBand(fullness, bandWindowLabel(fullness.length)),
      color: "var(--tk-accent)", stale: isStale(data.status.blocks),
      format: fmtPct,
    },
  ];

  /* ── D0993 node-sync shell ─────────────────────────────────────────
     ONE array entry today. The "your node" column is a second object in this
     array, not a redesign of SyncShell — see that file's header. */
  const syncColumns: SyncColumn[] = [
    {
      id: "network",
      label: "The network",
      source: "network",
      phase: pop.status,
      detail: "public node census",
      rows: [
        { k: "Chain tip", v: ready ? data.height.toLocaleString() : "—", note: "node this site reads" },
        { k: "Nodes agreeing on tip", v: agreement != null ? `${agreement}%` : "—", note: "within 2 blocks" },
        { k: "Reachable nodes", v: popOk ? popOk.counts.reachable.toLocaleString() : "—" },
        { k: "Block production", v: velocityPerH != null ? `${velocityPerH.toFixed(1)} blocks/h` : "—", note: "from header timestamps" },
        { k: "Census sampled", v: popOk?.sampledAt ? popOk.sampledAt.slice(11, 19) + " UTC" : "—" },
      ],
    },
  ];

  return (
    <PageShell width="standard" rail bg={{ intensity: "calm" }}>
      <Crumbs path={R.LIVE_NETWORK} status={`Block target 2:00 · fork ${data.majorVersion ? "v" + data.majorVersion : "—"}`} />
      <DataLegend sources={["node", "network"]} />
      <PageHeader
        kicker={<>Network telemetry <NodeProvenance source="node" keys={["network", "blocks", "mempool", "fees"]} status={data.status} bare /></>}
        title='Network — <em style="color:var(--tk-accent);text-shadow:var(--glow-1);font-style:normal">the numbers</em>.'
        sub="Pools, blocks, hashrate, difficulty, fees, fork readiness. The raw telemetry for the chain you trust."
        right={<>
          {/* Band health, beside the feed pill and distinct from it: the pill
              says whether the DATA is arriving, this says whether the CHAIN is
              inside its bands. Rendered only once something is measurable —
              an unmeasured series must not read as a passing one. */}
          {measuredZones.length ? <HealthChip zone={healthZone} /> : null}
          {(() => {
            // Exhaustive over ChromeState. `error` and `offline` are separate
            // facts from `loading` and now say so — see design/useOnline.ts.
            const title = chromeDetail(chromeState, data.status, CHAIN_CHROME_KEYS) ?? undefined;
            switch (chromeState) {
              case "stale": return <Pill tone="warn" dot title={title}>{CHROME_LABEL.stale}</Pill>;
              case "live": return <Pill tone="live" dot>LIVE</Pill>;
              case "loading": return <Pill dot title={title}>{CHROME_LABEL.loading}</Pill>;
              case "error": return <Pill tone="warn" dot title={title}>{CHROME_LABEL.error}</Pill>;
              case "offline": return <Pill dot title={title}>{CHROME_LABEL.offline}</Pill>;
              default: return assertNever(chromeState, "NetworkPage pill");
            }
          })()}
          <Pill>UPDATED {freshAt(data.status.network) > 0 ? new Date(freshAt(data.status.network)).toISOString().slice(11, 19) : "—"}</Pill>
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
      <section className="col-2" style={{ gap: 12 }}>
        <DataPanel keys={KEYS_NETWORK} status={data.status} title={`Hashrate · session · ${hashSeries.length} sample${hashSeries.length === 1 ? "" : "s"}`} right={<span>GH/s</span>}>
          <PanelBoundary keys={KEYS_NETWORK} reserve={180} resetKeys={[oldestFreshAt(data.status, KEYS_NETWORK)]}>
            <ChartBody
              status={data.status} keys={KEYS_NETWORK} height={180}
              hasContent={hashSeries.length > 0}
              chart={
                <AreaSeries data={hashSeries} height={180} color="var(--tk-accent)"
                  baseline="auto" xLabels={false} stale={isStale(data.status.network)}
                  format={fmtGiga} />
              }
              emptyNote="Node reported no hashrate for this sample"
              downTail="no hashrate to chart"
            />
          </PanelBoundary>
          {/* NO BAND HERE, and the reason is the panel's most useful sentence.
              The mockup asks for "the trailing 30-day ±1σ envelope"; this
              series cannot carry one twice over. It is a SESSION buffer that
              starts empty at mount, so it has no history at all on a cold
              load — and network hashrate is not an independent measurement
              anywhere in this stack: the node reports difficulty, and both
              api/xmr.js and data/map.ts derive hashrate as difficulty ÷ the
              block target. Banding it would band difficulty a second time,
              and plotting the two "against each other" would draw a feedback
              loop with zero lag by construction. Said plainly instead. */}
          <p className="mono dim" style={{ fontSize: "var(--fs-mono)", margin: "6px 0 0", lineHeight: 1.5, color: "var(--ink-40)" }}>
            Network hashrate is not measured — no node can observe it. It is <b>derived</b> as
            difficulty ÷ {BLOCK_TARGET_S} s, so this curve is difficulty in other units, and this
            session's samples only (it starts empty on a cold load, so there is no envelope to band
            it against).
          </p>
        </DataPanel>
        <DataPanel keys={KEYS_BLOCKS} status={data.status} title={`Difficulty · last ${diffSeries.length} blocks`} right={<span>{ready ? `Δ ${(data.difficulty / 1e9).toFixed(2)}G` : "—"}</span>}>
          <PanelBoundary keys={KEYS_BLOCKS} reserve={180} resetKeys={[oldestFreshAt(data.status, KEYS_BLOCKS)]}>
            <ChartBody
              status={data.status} keys={KEYS_BLOCKS} height={180}
              hasContent={diffSeries.length > 0}
              chart={
                <AreaSeries data={diffSeries} height={180} color="var(--p-50)"
                  baseline="auto" xLabels={false} stale={isStale(data.status.blocks)}
                  format={fmtGigaSuffix} band={diffBand ?? undefined} />
              }
              emptyNote="Node answered with zero blocks in range — no difficulty to plot"
              downTail="no difficulty series"
            />
          </PanelBoundary>
          {diffBand ? (
            <BandNote band={diffBand}>
              Difficulty is the retarget controller's output; the cadence strip below is the process
              it controls. Its feedback loop is the{" "}
              <SimLink to={`${R.LEARN_SIM}?p=thermostat`}>Thermostat simulator</SimLink>.
            </BandNote>
          ) : null}
        </DataPanel>
      </section>

      <section className="col-2" style={{ gap: 12 }}>
        <DataPanel keys={KEYS_MEMPOOL} status={data.status} title={`Mempool size · session · ${mempoolSeries.length} sample${mempoolSeries.length === 1 ? "" : "s"}`} right={<span>{ready ? `${data.mempool.length} tx now` : "—"}</span>}>
          <PanelBoundary keys={KEYS_MEMPOOL} reserve={180} resetKeys={[oldestFreshAt(data.status, KEYS_MEMPOOL)]}>
            <ChartBody
              status={data.status} keys={KEYS_MEMPOOL} height={180}
              hasContent={mempoolSeries.length > 0}
              chart={
                <AreaSeries data={mempoolSeries} height={180} color="var(--c-50)"
                  baseline="zero" xLabels={false} stale={isStale(data.status.mempool)}
                  format={fmtRound} />
              }
              emptyNote="Mempool reachable — no size samples recorded yet"
              downTail="no mempool-size series"
            />
          </PanelBoundary>
          {backlog && backlogDepth != null ? (
            <BandNote band={backlog}>
              Right now: <b className="acc">{backlogDepth.toFixed(2)}</b> blocks deep
              ({fmtBytes(poolBytes)}) — <HealthChip zone={backlogZone} />.
            </BandNote>
          ) : null}
        </DataPanel>
        <DataPanel keys={KEYS_BLOCKS} status={data.status} title={`Block fullness · last ${fullness.length} blocks`} right={<span>{recentBlocks.length ? `cap ≈ ${fullCap.toFixed(0)} KB` : "—"}</span>}>
          <PanelBoundary keys={KEYS_BLOCKS} reserve={180} resetKeys={[oldestFreshAt(data.status, KEYS_BLOCKS)]}>
            <ChartBody
              status={data.status} keys={KEYS_BLOCKS} height={180}
              hasContent={fullness.length > 0}
              chart={
                <BarSeries data={fullness} height={180} color="var(--tk-accent)"
                  baseline="zero" stale={isStale(data.status.blocks)} endLabels={["older", "newer"]}
                  format={fmtPct} />
              }
              emptyNote="Node answered with zero blocks in range — nothing to measure"
              downTail="fullness unknown"
            />
          </PanelBoundary>
        </DataPanel>
      </section>

      {/* D0828 — the streaming difficulty line. Full width: it carries a real
          time axis (block-header timestamps, not indices) over a window the
          server labels, so it needs the horizontal room the two-up panels
          above cannot give it. */}
      <StreamPanel stream={stream} view={streamV} status={data.status} />

      {/* Block cadence strip (D0828/D0832) — the chain's heartbeat, and the
          one panel whose reading is a RUN rather than a number. Full width:
          the run is only legible with enough horizontal room for ~100 ticks. */}
      <DataPanel
        keys={KEYS_BLOCKS} status={data.status} title={`Block cadence · last ${cadenceIntervals.length} intervals`}
        right={meanInterval != null
          /* "SD" rather than "σ", and this was found in a render. PanelFrame's
             header is uppercased by the design system, and CSS `text-transform`
             maps σ → Σ — which is not a styling wobble but a different
             operator: Σ is summation, σ is a standard deviation. The band's
             own source note below is body copy and keeps the real symbol. */
          ? <HealthChip zone={cadenceZone} label={`mean ${Math.round(meanInterval)}s · ${cadenceZone === "healthy" ? "in band" : cadenceZone === "warn" ? "outside 2 SD" : "outside 3 SD"}`} />
          : <span className="dim">—</span>}
      >
        <PanelBoundary keys={KEYS_BLOCKS} reserve={CADENCE_H} resetKeys={[oldestFreshAt(data.status, KEYS_BLOCKS)]}>
          <ChartBody
            status={data.status} keys={KEYS_BLOCKS} height={CADENCE_H}
            hasContent={cadenceIntervals.length > 0}
            chart={<CadenceStrip intervals={cadenceIntervals} stale={isStale(data.status.blocks)} targetS={BLOCK_TARGET_S} />}
            emptyNote="Node answered with zero blocks in range — no cadence to draw"
            downTail="cadence strip unavailable"
          />
        </PanelBoundary>
        {cadenceIntervals.length ? (
          <BandNote band={cadence}>
            The strip itself carries no health band on purpose — a single interval cannot be judged
            against a target. Why blocks wobble around {BLOCK_TARGET_S} s is the{" "}
            <SimLink to={`${R.LEARN_SIM}?p=metronome`}>Metronome simulator</SimLink>.
          </BandNote>
        ) : null}
      </DataPanel>

      {/* D0837 — every series on this page at one glance, each on its own
          scale, all sharing one band grammar. */}
      <SmallMultiples specs={tiles} keys={KEYS_SMALL_MULTIPLES} status={data.status} />

      {/* D0993 — height vs the network, velocity, census. One column today. */}
      <SyncShell columns={syncColumns} />

      {/* Block intervals + fee histogram — top-align so each panel hugs its chart. */}
      <section className="col-2" style={{ gap: 12, alignItems: "start" }}>
        <DataPanel keys={KEYS_BLOCKS} status={data.status} title="Block intervals · last ~100 blocks" right={<span>count · seconds</span>}>
          <PanelBoundary keys={KEYS_BLOCKS} reserve={230} resetKeys={[oldestFreshAt(data.status, KEYS_BLOCKS)]}>
            <ChartBody
              status={data.status} keys={KEYS_BLOCKS} height={230}
              hasContent={ivHist.counts.length > 0}
              chart={
                <BarSeries data={ivHist.counts} labels={ivHist.labels} height={230} color="var(--tk-accent)"
                  baseline="zero" stale={isStale(data.status.blocks)} format={fmtRound}
                  marker={ivHist.medBin >= 0 ? { index: ivHist.medBin, label: `median ~${Math.round(ivHist.med)}s` } : undefined} />
              }
              emptyNote="Node answered with zero blocks in range — no intervals to bucket"
              downTail="interval histogram unavailable"
            />
            {ivHist.counts.length ? (
              <p className="mono dim" style={{ fontSize: "var(--fs-mono)", marginTop: 6, color: "var(--ink-40)" }}>
                μ <b className="acc">{Math.round(ivHist.mean)}s</b> · target 120 s · {intervals.length} intervals
                · timestamps are miner-set, filtered to 5–1800 s
              </p>
            ) : null}
          </PanelBoundary>
        </DataPanel>

        <DataPanel keys={KEYS_MEMPOOL_FEES} status={data.status} title="Fee histogram" right={<span>tx count · piconero / B</span>}>
          <PanelBoundary keys={KEYS_MEMPOOL_FEES} reserve={230} resetKeys={[oldestFreshAt(data.status, KEYS_MEMPOOL_FEES)]}>
            <ChartBody
              status={data.status} keys={KEYS_MEMPOOL_FEES} height={230}
              hasContent={feeHist.counts.length > 0 || data.feeHist.length > 0}
              chart={feeHist.counts.length ? (
                <BarSeries data={feeHist.counts} labels={feeHist.labels} height={230} color="var(--p-50)"
                  baseline="zero" stale={isStale(data.status.mempool)} format={fmtRound}
                  marker={medBucket >= 0 ? { index: medBucket, label: `median ~${Math.round(medPerB).toLocaleString()} pcn/B` } : undefined} />
              ) : (
                <BarSeries data={data.feeHist} endLabels={["low", "high"]} height={230} color="var(--p-50)"
                  baseline="zero" stale={isStale(data.status.mempool)} format={fmtRound} />
              )}
              emptyNote="Mempool answered with no fee-paying transactions"
              downTail="no fee data to bucket"
            />
            {(() => {
              if (data.mempool.length) return (
                <p className="mono dim" style={{ fontSize: "var(--fs-mono)", marginTop: 6, color: "var(--ink-40)" }}>
                  Over <b className="acc">{data.mempool.length}</b> mempool tx · median fee marked on-chart
                </p>
              );
              const reason = emptyReason(data.status, KEYS_MEMPOOL_FEES);
              // "waiting" says nothing here on purpose: the skeleton above is
              // already saying it, and this caption would say it twice.
              if (reason === "waiting") return null;
              return (
                <p className="mono dim" style={{ fontSize: "var(--fs-mono)", marginTop: 6, color: "var(--ink-40)" }}>
                  {reason === "down" ? downNote(data.status, KEYS_MEMPOOL_FEES, "fee sample unavailable") : "Mempool answered with no fee-paying transactions"}
                </p>
              );
            })()}
          </PanelBoundary>
        </DataPanel>
      </section>

      {/* Pool attribution + Remote node */}
      <section className="col-2" style={{ gap: 12 }}>
        <DataPanel keys={KEYS_BLOCKS} status={data.status} title="Pool attribution" right={<span className="dim">unattributed</span>}>
          <PanelBoundary keys={KEYS_BLOCKS} reserve={POOL_ATTR_H} resetKeys={[oldestFreshAt(data.status, KEYS_BLOCKS)]}>
            <ChartBody
              status={data.status} keys={KEYS_BLOCKS} height={POOL_ATTR_H}
              hasContent={recentBlocks.length > 0}
              chart={
                <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: "var(--f-mono)" }}>
                  {/* lead with the real signal as a compact stat, not a paragraph */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span style={{ fontSize: 26, color: "var(--ink-100)" }}>{recentBlocks.length ? `${unattributedPct}%` : "—"}</span>
                    <span className="dim" style={{ fontSize: "var(--fs-mono)" }}>
                      {recentBlocks.length
                        ? <>unattributed · {unattributed}/{recentBlocks.length} recent blocks report pool "Unknown"</>
                        : <>—</>}
                    </span>
                  </div>
                  {/* single full-width bar, matching the block-weight idiom below */}
                  <div style={{ height: 14, background: "var(--ink-10)", position: "relative", borderRadius: 1 }}>
                    {recentBlocks.length ? (
                      <div style={{ position: "absolute", inset: "0 auto 0 0", width: unattributedPct + "%", background: "var(--ink-40)", opacity: 0.5, boxShadow: "0 0 8px var(--ink-40)" }} />
                    ) : null}
                  </div>
                </div>
              }
              emptyNote="Node answered with zero blocks in range — nothing to attribute"
              downTail="pool attribution unavailable"
            />
          </PanelBoundary>
          {/* one-line caption: the why lives in a hover tooltip; Skyline link stays visible.
              Static prose — not gated on block data, so it stays outside PanelBoundary/ChartBody. */}
          <p className="mono dim" style={{ fontSize: "var(--fs-body)", margin: "12px 0 0", lineHeight: 1.5, color: "var(--ink-40)" }}>
            Coinbase outputs are one-time stealth addresses — pools can't be matched on-chain{" "}
            <span
              title="Real explorers show pool names from a maintained dataset of coinbase tx_extra signatures, or a third-party pool API. Both are off-limits here: a bundled list goes stale and is partial, and an API would break the zero-third-party privacy invariant. So 'Unknown' from the node alone is the honest representation."
              style={{ cursor: "help", color: "var(--ink-60)", borderBottom: "1px dotted var(--ink-40)" }}
            >why ⓘ</span>. HHI concentration is explored in the{" "}
            <Link to={`${R.LEARN_SIM}?p=skyline`} className="acc">Skyline simulator</Link>.
          </p>
        </DataPanel>

        <DataPanel keys={KEYS_NETWORK} status={data.status} title="Remote node" provSource="node" provDetail="public node cascade">
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
        </DataPanel>
      </section>

      {/* Two-part shell: the live public node population (NETWORK) beside this
          site's own paused peer telemetry (NODE). .col-2 stacks at ≤1279px and
          ≤768px in source order, so at 390px the live panel leads. */}
      <section className="col-2" style={{ gap: 12, alignItems: "start" }}>
        <NodePopulationPanel />

        {/* Peer telemetry — paused placeholder. Peer topology can't come from a public
            restricted node (all peer fields read 0; get_connections / get_peer_list are
            admin-only), so instead of a misleading "0 peers" we reserve the space for real,
            node-pointed telemetry. No fabricated peers, IPs, latencies, counts, or geography. */}
        {/* No dataKey, deliberately: this panel renders no feed data at all, so
            there is no endpoint whose failure could degrade it. */}
        <PanelFrame
          title="Your node · peer telemetry"
          right={<><Provenance source="node" /><span className="soon-badge">Soon</span></>}
          style={{ opacity: 0.62 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: "var(--f-mono)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 26, color: "var(--ink-60)" }}>—</span>
              <span className="dim" style={{ fontSize: "var(--fs-mono)" }}>Not live network data — peer telemetry paused</span>
            </div>
            <p className="mono dim" style={{ fontSize: "var(--fs-body)", margin: 0, lineHeight: 1.5, color: "var(--ink-40)" }}>
              Peer topology — connection counts, the peer list, and latencies — requires a dedicated
              unrestricted node. The public node cascade this site reads runs restricted RPC (all peer
              fields report 0, peer lists are admin-only), so this panel stays paused and populates
              once a node is pointed at the site — your own node's peers, not the network census beside it.
            </p>
          </div>
        </PanelFrame>
      </section>

      {/* Chain meta + Block weight */}
      <section className="col-2" style={{ gap: 12 }}>
        <DataPanel keys={KEYS_NETWORK_FEES} status={data.status} title="Chain meta" provSource="node" provDetail="node reported">
          <KVRows rows={[
            ["RandomX seed", ready ? shortHash(data.randomxSeedHash) : "—"],
            ["Adjusted time", ready && data.adjustedTime > 0 ? new Date(data.adjustedTime * 1000).toISOString().slice(11, 19) + " UTC" : "—"],
            ["Nettype", ready && data.nettype ? data.nettype : "—"],
            ["Txs all-time", ready ? fmtN(data.txCountTotal) : "—"],
            ["Fee tiers", ready && t.length === 4
              ? <span title={FEE_TIER_LABELS.join(" / ")}>{`${fmtPcnB(t[0])}/${fmtPcnB(t[1])}/${fmtPcnB(t[2])}/${fmtPcnB(t[3])} pcn/B`}</span>
              : "—"],
          ]} />
        </DataPanel>

        <DataPanel keys={KEYS_NETWORK} status={data.status} title="Block weight · median vs limit" right={<span>dynamic block size</span>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: "var(--f-mono)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-mono)" }}>
              <span style={{ color: "var(--tk-accent)" }}>median {ready && data.blockWeightMedian > 0 ? fmtBytes(data.blockWeightMedian) : "—"}</span>
              <span className="dim">limit {ready && data.blockWeightLimit > 0 ? fmtBytes(data.blockWeightLimit) : "—"}</span>
            </div>
            {/* single full-width bar: median weight as a fraction of the dynamic limit */}
            <div style={{ height: 14, background: "var(--ink-10)", position: "relative", borderRadius: 1 }}>
              {weightKnown ? (
                <div style={{ position: "absolute", inset: "0 auto 0 0", width: Math.min(100, (data.blockWeightMedian / data.blockWeightLimit) * 100).toFixed(1) + "%", background: "var(--tk-accent)", opacity: 0.5, boxShadow: "0 0 8px var(--tk-accent)" }} />
              ) : null}
            </div>
            <p className="mono dim" style={{ fontSize: "var(--fs-body)", margin: 0, lineHeight: 1.5, color: "var(--ink-40)" }}>
              Monero's block size is dynamic: blocks above the median weight enter the penalty
              zone and pay a quadratic coinbase-reward penalty, and the node's dynamic limit
              is 2× the median — so the limit grows only as sustained demand lifts the median.
            </p>
          </div>
        </DataPanel>
      </section>

      {/* Recent blocks table */}
      <DataPanel keys={KEYS_BLOCKS} status={data.status} title="Recent blocks" right={<span>height ↓</span>}>
        <div className="table-scroll">
        <div style={{ display: "grid", gridTemplateColumns: BLOCKS_TABLE_COLS, gap: 10, fontSize: "var(--fs-mono)" }} className="mono keep-cols">
          {["#", "Hash", "Txs", "Size", "Reward", "Pool", "Age"].map((h, i) => (
            <div key={i} className="kicker" style={{ borderBottom: "1px solid var(--rule)", paddingBottom: 6, marginBottom: 2 }}>{h}</div>
          ))}
        </div>
        {(() => {
          const reason = emptyReason(data.status, KEYS_BLOCKS);
          // Same 12 rows / 18px / 8px gap SkeletonRows uses by default, so the
          // reservation and the skeleton it wraps can't drift apart.
          const RESERVE = 12 * 18 + 11 * 8;
          return (
            <Swap ready={blocksTableRows.length > 0 || reason !== "waiting"} reserve={RESERVE}
              skeleton={<SkeletonRows n={12} cols={BLOCKS_TABLE_COLS} />}>
              {blocksTableRows.length ? (
                <div style={{ display: "grid", gridTemplateColumns: BLOCKS_TABLE_COLS, gap: 10, fontSize: "var(--fs-mono)" }} className="mono keep-cols">
                  {blocksTableRows.map((b) => (
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
              ) : reason === "down" ? (
                <p className="mono dim" style={{ fontSize: "var(--fs-mono)", color: "var(--ink-40)" }}>
                  {downNote(data.status, KEYS_BLOCKS, "no recent blocks to list")}
                </p>
              ) : reason === "empty" ? (
                <p className="mono dim" style={{ fontSize: "var(--fs-mono)", color: "var(--ink-40)" }}>
                  Node answered with zero blocks in range — table is empty
                </p>
              ) : null}
            </Swap>
          );
        })()}
        </div>
      </DataPanel>
    </PageShell>
  );
}
