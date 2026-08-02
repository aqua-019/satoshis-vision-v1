/**
 * data/xmrirish-feed.ts — the single data seam wiring v5 to v4's backend.
 *
 * `useXmrIrishFeed()` yields the MoneroLive shape the whole app reads via
 * `useMoneroLive()`. It:
 *
 *   1. boots empty           → every `status[key].phase` is "loading"; surfaces
 *                              render "—" until real data lands. The UI never
 *                              displays a number that didn't come from the node
 *                              or CoinGecko.
 *   2. polls in three tiers  → each endpoint is refreshed at the rate its data
 *                              actually changes (see below), mapped through
 *                              map.ts (source "rpc" / "coingecko").
 *   3. takes live deltas     → over the optional relay WebSocket (source "ws"),
 *                              which supersedes the chain-data tiers while open.
 *   4. degrades to stale     → on repeated poll failure the last-good snapshot
 *                              is kept, the failing endpoint's phase becomes
 *                              "stale" (badges show "STALE · reconnecting"), and
 *                              polling continues — the next success flips it
 *                              back to "live". An endpoint that has NEVER
 *                              succeeded goes to "error" instead, which is the
 *                              distinction the old `ready` boolean could not
 *                              draw: it left a dead-from-cold feed saying
 *                              "connecting" forever.
 *
 * ── Tiering (v6.0.6) ──────────────────────────────────────────────────────
 * This used to be ONE `setInterval` at 2.5s firing a `Promise.all` over five
 * endpoints. Measured against a public node, the mempool changed every 3s but
 * height did not move at all across 6s — the block target is 120s, so a 2.5s
 * poll re-fetched an unchanged height ~48× per block, per visitor.
 *
 *   FAST   3s  — /api/xmr/mempool, /api/xmr/fees      genuinely changes this fast
 *   CHAIN  15s — /api/xmr/tip, and ONLY on a height change /api/xmr/network
 *                + /api/xmr/blocks                     120s block target
 *   MARKET 60s — /api/coingecko                        rate-limited upstream
 *
 * Polling pauses entirely on a hidden tab and resumes with an immediate
 * catch-up tick; repeated failures back off. See `usePolling`.
 *
 * The tiers are cheap in aggregate only because the proxy sets matching
 * `s-maxage` values (api/xmr.js CACHE_CONTROL), so the CDN collapses every
 * visitor's polls into ~1 upstream request per tier interval.
 *
 * Privacy invariant: the browser only ever talks to same-origin /api/* (and the
 * relay WS). The dev proxy (vite.config.ts) keeps `npm run dev` same-origin too.
 * It never reaches a Monero RPC node or the CoinGecko API host directly.
 */

import * as React from "react";
import type { MoneroLive } from "./types";
import { getJSON } from "./http";
import { usePolling } from "./usePolling";
import { setFeedActivity } from "./feed-activity";
import {
  BOOT_OBS,
  deriveAll,
  type FailReason,
  type FeedKey,
  type ObsMap,
} from "./feed-status";
import {
  applyWsBlock,
  applyWsMempool,
  applyWsNetwork,
  mapToMoneroLive,
  type SnapshotSources,
} from "./map";

// Type the handful of Vite client env vars this seam reads. (No `vite/client`
// reference exists in the project, and adding a vite-env.d.ts would fall outside
// this phase's data-only file set — so we augment the globals here instead.)
declare global {
  interface ImportMetaEnv {
    readonly VITE_RELAY_WS?: string;
    readonly VITE_API_ORIGIN?: string;
    /** Vite built-in: true in `vite dev`, false in production builds. */
    readonly DEV: boolean;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

/* The consecutive-failure thresholds moved to feed-status.ts `STALE_AFTER`
   (v6.1.4). They are per-ENDPOINT now rather than per-tier, at the same value of
   2, so a fast-tier outage still surfaces in ~6s and a chain-only one in ~30s. */
/**
 * Even with a static height, re-pull chain meta this often so slow-moving fields
 * (daemon version, DB size, fee tiers) can't sit unrefreshed forever if the tip
 * watch is somehow wedged.
 */
const FULL_REFRESH_FLOOR_MS = 5 * 60_000;

const COINGECKO =
  "/api/coingecko?path=simple/price&ids=monero,bitcoin&vs_currencies=usd&include_24hr_change=true";

/* D0858 · which endpoints each tier owns, for the activity store.
   Module-level constants, not inline arrows: usePolling holds the callback in a
   ref so a fresh closure would not restart the loop, but a stable identity is
   still the honest thing to hand a hook, and these never close over anything. */
const FAST_KEYS = ["mempool", "fees"] as const;
const CHAIN_KEYS = ["tip", "network", "blocks"] as const;
const MARKET_KEYS = ["market"] as const;

const FAST_ACTIVITY = (a: { busy: boolean; nextAt: number }) => setFeedActivity(FAST_KEYS, a);
const CHAIN_ACTIVITY = (a: { busy: boolean; nextAt: number }) => setFeedActivity(CHAIN_KEYS, a);
const MARKET_ACTIVITY = (a: { busy: boolean; nextAt: number }) => setFeedActivity(MARKET_KEYS, a);

/** /api/xmr/tip — the cheap 1-RPC tip watch. */
interface XmrTip {
  /** NOTE: this is `get_info.height - 1`, i.e. the TIP BLOCK NUMBER, whereas
   *  /api/xmr/network reports the raw block COUNT. They differ by one, so this
   *  is used ONLY as a change detector — never as MoneroLive.height. */
  height?: number;
}

/**
 * BOOT — the pre-data state. Every numeric is 0 / [] / "" and `ready` is false;
 * surfaces gate number rendering on `ready`/`marketReady`, so none of these
 * zeros ever appear on screen. blockTarget is the protocol constant (120s).
 */
const BOOT: MoneroLive = {
  height: 0,
  hashrate: 0,
  difficulty: 0,
  hardfork: "",
  protocol: "",
  blockTarget: 120,
  version: "",
  majorVersion: 0,
  feeTiers: [],
  txCountTotal: 0,
  topBlockHash: "",
  altBlocksCount: 0,
  randomxSeedHash: "",
  blockWeightLimit: 0,
  blockWeightMedian: 0,
  databaseSize: 0,
  synchronized: false,
  nettype: "",
  adjustedTime: 0,
  peerCount: 0,
  incomingPeers: 0,
  outgoingPeers: 0,
  mempool: [],
  blocks: [],
  price: 0,
  change24h: 0,
  btcRatio: 0,
  btc: 0,
  btcChg: 0,
  hashSeries: [],
  priceSeries: [],
  feeHist: [],
  source: "rpc",
  lastUpdate: 0,
  status: deriveAll(BOOT_OBS),
};

/**
 * Resolve the relay WebSocket URL — ONLY when VITE_RELAY_WS is explicitly set.
 *
 * This deployment has no relay (`wss://…/ws` returns 502), and auto-deriving a
 * same-origin `/ws` made the browser open a dead socket on every load, logging a
 * handshake error and leaving polling fragilely gated on the WS `onclose`. With
 * no override we return null → the caller polls unconditionally (zero WS errors).
 * Set VITE_RELAY_WS to opt back into the live socket where a relay actually runs.
 */
function relayWsUrl(): string | null {
  const override = import.meta.env.VITE_RELAY_WS as string | undefined;
  return override && override.trim() ? override : null;
}

export function useXmrIrishFeed(): MoneroLive {
  /* The snapshot (numbers) and the observations (per-endpoint facts) are held
     separately, because they change for different reasons: a snapshot only ever
     moves forward on success, while an observation records failures too. */
  const [snap, setSnap] = React.useState<MoneroLive>(BOOT);
  const [obs, setObs] = React.useState<ObsMap>(BOOT_OBS);

  /** Last tip height observed, for change detection. null = never seen. */
  const lastTip = React.useRef<number | null>(null);
  /** When the chain tier last pulled network+blocks. */
  const lastFull = React.useRef(0);
  /** True while a relay socket is delivering deltas — suspends the chain tiers. */
  const [wsLive, setWsLive] = React.useState<boolean>(() => relayWsUrl() !== null);

  /**
   * Record ONE endpoint's outcome. Facts only — no phase is computed here, and
   * nothing derived is stored (D1624). This is the whole reason a per-endpoint
   * union is expressible at all: the old code folded mempool and fees into a
   * single `fastFails` counter, so "mempool answered, fees didn't" had nowhere
   * to live.
   */
  const note = React.useCallback((key: FeedKey, ok: boolean, reason: FailReason = "http") => {
    setObs((o) => {
      const prev = o[key];
      if (ok) {
        return { ...o, [key]: { okAt: Date.now(), fails: 0, reason: null } };
      }
      return { ...o, [key]: { okAt: prev.okAt, fails: prev.fails + 1, reason } };
    });
  }, []);

  /** Classify a failure from what we can actually observe. `getJSON` collapses
   *  every failure to null, so anything beyond these three would be invented. */
  const why = (signal: AbortSignal): FailReason => {
    if (signal.aborted) return "timeout";
    if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
    return "http";
  };

  /** Fold a successful tier result into the snapshot. */
  const commit = React.useCallback((src: SnapshotSources, opts: { pushHash?: boolean }) => {
    setSnap((s) =>
      mapToMoneroLive(s, src, s.source === "ws" ? "ws" : "rpc", { pushHash: opts.pushHash }),
    );
  }, []);

  // ── FAST tier (3s): mempool + fee estimate ──────────────────────────────
  const fastTick = async (signal: AbortSignal): Promise<boolean> => {
    const [mempool, fees] = await Promise.all([
      getJSON("/api/xmr/mempool", { signal }),
      getJSON("/api/xmr/fees", { signal }),
    ]);
    /* Recorded SEPARATELY (v6.1.4). The old code kept one counter for the pair
       and only incremented it when BOTH failed, so a dead /api/xmr/fees behind a
       healthy /api/xmr/mempool was invisible. `feedDegraded` still applies the
       pair-AND rule, so this changes what is KNOWABLE, not what is rendered. */
    note("mempool", mempool != null, why(signal));
    note("fees", fees != null, why(signal));
    if (!mempool && !fees) return false;
    /* Deliberately does NOT mark the chain ready: chain numbers gate on
       status.network, which only the chain tier supplies. Marking them here
       would render BOOT's 0 as a block height. */
    commit(
      {
        mempool: mempool as SnapshotSources["mempool"],
        fees: fees as SnapshotSources["fees"],
      },
      {},
    );
    return true;
  };

  // ── CHAIN tier (15s): tip watch, full pull only when the tip moves ───────
  const chainTick = async (signal: AbortSignal): Promise<boolean> => {
    const tip = await getJSON<XmrTip>("/api/xmr/tip");
    const tipHeight = typeof tip?.height === "number" ? tip.height : null;
    /* The tip watch has its own status, but it is NOT part of `feedDegraded`:
       a failed watch falls through to the full pull below rather than freezing
       the chain numbers, so it is a cost, not a degradation. */
    note("tip", tipHeight !== null, why(signal));

    const first = lastTip.current === null;
    const advanced = tipHeight !== null && tipHeight !== lastTip.current;
    const floorDue = Date.now() - lastFull.current >= FULL_REFRESH_FLOOR_MS;
    /* A null tip means the watch itself failed; fall through to the full pull
       rather than silently freezing the chain numbers. */
    const needFull = first || advanced || floorDue || tipHeight === null;

    if (!needFull) {
      // Tip answered and hasn't moved — nothing to fetch. This is the steady
      // state and the whole point of the tier: 1 cheap RPC instead of 20.
      return true;
    }

    const [network, blocks] = await Promise.all([
      getJSON("/api/xmr/network", { signal }),
      getJSON("/api/xmr/blocks?limit=100", { signal }),
    ]);

    // Separately, for the same reason as the fast tier above: /network feeds the
    // KPI row and the hashrate chart, /blocks feeds the block panels, and they
    // can fail independently.
    note("network", network != null, why(signal));
    note("blocks", blocks != null, why(signal));

    if (!network && !blocks) return false;

    if (tipHeight !== null) lastTip.current = tipHeight;
    lastFull.current = Date.now();
    /* pushHash here and nowhere else — hashrate derives from difficulty, which
       only moves on a new block. */
    commit(
      {
        network: network as SnapshotSources["network"],
        blocks: blocks as SnapshotSources["blocks"],
      },
      { pushHash: true },
    );
    return true;
  };

  // ── MARKET tier (60s): CoinGecko spot ───────────────────────────────────
  const marketTick = async (signal: AbortSignal): Promise<boolean> => {
    const market = await getJSON(COINGECKO, { signal });
    /* v6.1.4: a market failure is now RECORDED. It still never marks the chain
       feed stale (feedDegraded excludes `market` — CoinGecko failing says
       nothing about node health), but it used to return here with no state
       write at all, which made a total CoinGecko outage indistinguishable from
       a cold boot: both rendered "connecting", forever. */
    note("market", market != null, why(signal));
    if (!market) return false;
    commit({ market: market as SnapshotSources["market"] }, {});
    return true;
  };

  /* D0858: tier -> FeedKeys. The mapping lives here because this is where the
     tick functions already encode which endpoints they touch; usePolling has no
     business knowing about FeedKey at all.

     Note the chain tier reports for all three of its keys while only ever
     GUARANTEEING a /tip request — `network` and `blocks` are pulled only when
     the tip moved. So a busy chain tier means "the loop that owns these
     endpoints is running", not "these URLs are on the wire", and the UI copy
     for it says "checking" rather than naming a path. */
  usePolling("fast", fastTick, !wsLive, FAST_ACTIVITY);
  usePolling("chain", chainTick, !wsLive, CHAIN_ACTIVITY);
  usePolling("market", marketTick, true, MARKET_ACTIVITY);

  // ── Optional relay WebSocket ────────────────────────────────────────────
  React.useEffect(() => {
    const url = relayWsUrl();
    if (!url) return;

    let alive = true;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(url);
      ws.onopen = () => {
        ws?.send(JSON.stringify({ action: "want", data: ["mempool", "blocks", "fees", "network"] }));
      };
      ws.onmessage = (e) => {
        let m: { type?: string; data?: unknown };
        try {
          m = JSON.parse(e.data as string);
        } catch {
          return;
        }
        if (!alive || !m || !m.type) return;
        switch (m.type) {
          case "block":
            setSnap((s) => applyWsBlock(s, m.data as never));
            note("blocks", true);
            break;
          case "mempool-update":
            setSnap((s) => applyWsMempool(s, m.data as never));
            note("mempool", true);
            break;
          case "network-update":
            setSnap((s) => applyWsNetwork(s, m.data as never));
            note("network", true);
            break;
          // hello / fee-update / pong / tx-confirmed: no MoneroLive field to map
          default:
            break;
        }
      };
      ws.onerror = () => {
        ws?.close();
      };
      ws.onclose = () => {
        // Socket gone → hand the chain tiers back to polling.
        if (alive) setWsLive(false);
      };
    } catch {
      setWsLive(false);
    }

    return () => {
      alive = false;
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [note]);

  /**
   * D1624 — the ONE derivation. Phase is computed here, during render, from the
   * facts in `obs`; nothing stores it, so nothing can hold a copy that has gone
   * out of date the way the old `commit`-time `stale` did.
   *
   * Memoised because this object is the Context value read by 12 call sites and
   * prop-drilled to ~29 more. A fresh identity on every render would re-render
   * the entire tree on every parent render, which on /mempool is a measurable
   * regression rather than a theoretical one.
   */
  return React.useMemo<MoneroLive>(() => ({ ...snap, status: deriveAll(obs) }), [snap, obs]);
}
