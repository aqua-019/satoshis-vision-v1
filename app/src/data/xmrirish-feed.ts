/**
 * data/xmrirish-feed.ts — the single data seam wiring v5 to v4's backend.
 *
 * `useXmrIrishFeed()` yields the MoneroLive shape the whole app reads via
 * `useMoneroLive()`. It:
 *
 *   1. boots empty           → `ready`/`marketReady` are false; surfaces render
 *                              skeletons / "—" until real data lands. The UI
 *                              never displays a number that didn't come from
 *                              the node or CoinGecko.
 *   2. polls in three tiers  → each endpoint is refreshed at the rate its data
 *                              actually changes (see below), mapped through
 *                              map.ts (source "rpc" / "coingecko").
 *   3. takes live deltas     → over the optional relay WebSocket (source "ws"),
 *                              which supersedes the chain-data tiers while open.
 *   4. degrades to stale     → on repeated poll failure the last-good snapshot
 *                              is kept, `stale` flips true (badges show
 *                              "STALE · reconnecting"), and polling continues —
 *                              the next success flips back to live.
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

/** Consecutive FAST-tier failures before the feed is marked stale (~6s). */
const STALE_AFTER_FAST = 2;
/** Consecutive CHAIN-tier failures before the feed is marked stale (~30s). */
const STALE_AFTER_CHAIN = 2;
/**
 * Even with a static height, re-pull chain meta this often so slow-moving fields
 * (daemon version, DB size, fee tiers) can't sit unrefreshed forever if the tip
 * watch is somehow wedged.
 */
const FULL_REFRESH_FLOOR_MS = 5 * 60_000;

const COINGECKO =
  "/api/coingecko?path=simple/price&ids=monero,bitcoin&vs_currencies=usd&include_24hr_change=true";

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
  live: false,
  ready: false,
  marketReady: false,
  stale: false,
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
  const [state, setState] = React.useState<MoneroLive>(BOOT);

  /* Consecutive-failure streaks, per tier. Either crossing its threshold means
     the chain numbers on screen are last-good, so `stale` is raised. Tracking
     them separately keeps the flag truthful: the 3s tier detects a total outage
     in ~6s, while a chain-only outage still surfaces without waiting on it. */
  const fastFails = React.useRef(0);
  const chainFails = React.useRef(0);
  /** Last tip height observed, for change detection. null = never seen. */
  const lastTip = React.useRef<number | null>(null);
  /** When the chain tier last pulled network+blocks. */
  const lastFull = React.useRef(0);
  /** True while a relay socket is delivering deltas — suspends the chain tiers. */
  const [wsLive, setWsLive] = React.useState<boolean>(() => relayWsUrl() !== null);

  const isStale = () =>
    fastFails.current >= STALE_AFTER_FAST || chainFails.current >= STALE_AFTER_CHAIN;

  /** Fold a successful tier result into state, recomputing the meta flags. */
  const commit = React.useCallback(
    (src: SnapshotSources, opts: { pushHash?: boolean; ready?: boolean; marketReady?: boolean }) => {
      setState((s) => {
        const stale = s.ready && isStale();
        return {
          ...mapToMoneroLive(s, src, s.source === "ws" ? "ws" : "rpc", { pushHash: opts.pushHash }),
          ready: s.ready || !!opts.ready,
          marketReady: s.marketReady || !!opts.marketReady,
          stale,
          live: !stale,
        };
      });
    },
    [],
  );

  /** Record a failed tier tick — keep last-good values, raise `stale` on a streak. */
  const noteFailure = React.useCallback(() => {
    setState((s) => {
      const stale = s.ready && isStale();
      return stale === s.stale ? s : { ...s, stale, live: !stale };
    });
  }, []);

  // ── FAST tier (3s): mempool + fee estimate ──────────────────────────────
  const fastTick = async (signal: AbortSignal): Promise<boolean> => {
    const [mempool, fees] = await Promise.all([
      getJSON("/api/xmr/mempool", { signal }),
      getJSON("/api/xmr/fees", { signal }),
    ]);
    if (!mempool && !fees) {
      fastFails.current++;
      noteFailure();
      return false;
    }
    fastFails.current = 0;
    /* Deliberately does NOT set `ready`: that flag gates height/difficulty, which
       only the chain tier supplies. Flipping it here would render BOOT's 0 as a
       block height. */
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

    const first = lastTip.current === null;
    const advanced = tipHeight !== null && tipHeight !== lastTip.current;
    const floorDue = Date.now() - lastFull.current >= FULL_REFRESH_FLOOR_MS;
    /* A null tip means the watch itself failed; fall through to the full pull
       rather than silently freezing the chain numbers. */
    const needFull = first || advanced || floorDue || tipHeight === null;

    if (!needFull) {
      // Tip answered and hasn't moved — nothing to fetch. This is the steady
      // state and the whole point of the tier: 1 cheap RPC instead of 20.
      chainFails.current = 0;
      return true;
    }

    const [network, blocks] = await Promise.all([
      getJSON("/api/xmr/network", { signal }),
      getJSON("/api/xmr/blocks?limit=100", { signal }),
    ]);

    if (!network && !blocks) {
      chainFails.current++;
      noteFailure();
      return false;
    }

    chainFails.current = 0;
    if (tipHeight !== null) lastTip.current = tipHeight;
    lastFull.current = Date.now();
    /* pushHash here and nowhere else — hashrate derives from difficulty, which
       only moves on a new block. */
    commit(
      {
        network: network as SnapshotSources["network"],
        blocks: blocks as SnapshotSources["blocks"],
      },
      { pushHash: true, ready: !!network },
    );
    return true;
  };

  // ── MARKET tier (60s): CoinGecko spot ───────────────────────────────────
  const marketTick = async (signal: AbortSignal): Promise<boolean> => {
    const market = await getJSON(COINGECKO, { signal });
    if (!market) return false; // market outage never marks the chain feed stale
    commit({ market: market as SnapshotSources["market"] }, { marketReady: true });
    return true;
  };

  usePolling("fast", fastTick, !wsLive);
  usePolling("chain", chainTick, !wsLive);
  usePolling("market", marketTick);

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
            setState((s) => ({ ...applyWsBlock(s, m.data as never), ready: true, stale: false }));
            break;
          case "mempool-update":
            setState((s) => ({ ...applyWsMempool(s, m.data as never), ready: true, stale: false }));
            break;
          case "network-update":
            setState((s) => ({ ...applyWsNetwork(s, m.data as never), ready: true, stale: false }));
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
  }, []);

  return state;
}
