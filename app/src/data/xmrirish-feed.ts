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
 *   2. snapshots on mount    → Promise.all over v4's existing proxies, mapped
 *                              through map.ts (source "rpc" / "coingecko").
 *   3. takes live deltas     → over the optional relay WebSocket (source "ws"),
 *                              otherwise polls the snapshot every ~2.5s.
 *   4. degrades to stale     → on repeated poll failure the last-good snapshot
 *                              is kept, `stale` flips true (badges show
 *                              "STALE · reconnecting"), and polling continues —
 *                              the next success flips back to live.
 *
 * Privacy invariant: the browser only ever talks to same-origin /api/* (and the
 * relay WS). The dev proxy (vite.config.ts) keeps `npm run dev` same-origin too.
 * It never reaches a Monero RPC node or the CoinGecko API host directly.
 */

import * as React from "react";
import type { MoneroLive } from "./types";
import { getJSON } from "./http";
import {
  applyWsBlock,
  applyWsMempool,
  applyWsNetwork,
  mapMarket,
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

/**
 * Poll cadence — v6.0.7, rebuilt for Tor.
 *
 * This was `setInterval(snapshot, 2500)` where snapshot() fires FIVE parallel
 * fetches. On a LAN that is fine. On Tor, where a round trip is 2-10s, the
 * interval kept firing while the previous round was still outstanding and the
 * requests stacked without bound — each one its own circuit. There was no
 * AbortController anywhere in browser code, so nothing was ever cancelled.
 *
 * The shape below is the one already proven in useTickers.ts: a recursive
 * setTimeout, which structurally cannot overlap because the next delay is only
 * scheduled once the previous round has settled.
 */
const BASE_MS = 2500;      // healthy cadence — unchanged for good networks
const MAX_MS = 30_000;     // ceiling under sustained failure
const TIMEOUT_MS = 12_000; // per-round abort budget; Tor RTT is 2-10s
const HIDDEN_MS = 60_000;  // backgrounded tab / phone in pocket
/** Consecutive total chain-poll failures before the feed is marked stale (~5s). */
const STALE_AFTER = 2;
const COINGECKO =
  "/api/coingecko?path=simple/price&ids=monero,bitcoin&vs_currencies=usd&include_24hr_change=true";

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

  React.useEffect(() => {
    let alive = true;
    let ws: WebSocket | null = null;
    let poll: ReturnType<typeof setTimeout> | null = null;
    let polling = false;
    let inFlight = false;
    let inFlightCtrl: AbortController | null = null;
    /** Wall time of the last completed round — the adaptive latency floor. */
    let lastRoundMs = 0;
    // Consecutive snapshots where NO chain endpoint answered. Drives `stale`.
    let chainFails = 0;

    // 1. Snapshot over v4's existing proxies (same-origin).
    async function snapshot() {
      // The recursive scheduler below can't overlap on its own, but the WS
      // onclose → startPolling() path can double-start it. Cheap to be sure.
      if (inFlight) return;
      inFlight = true;

      const ctrl = new AbortController();
      inFlightCtrl = ctrl;
      const budget = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const started = Date.now();

      // Deployed /api/xmr/* exposes ONLY network, mempool, blocks (peers, pools
      // etc. 404 / read zero on the restricted public nodes) — so we never call
      // them. get_info (/api/monero) and the CoinGecko proxy are same-origin too.
      const { signal } = ctrl;
      let info, network, mempool, blocks, market;
      try {
        [info, network, mempool, blocks, market] = await Promise.all([
          getJSON("/api/monero", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ method: "get_info" }),
            signal,
          }),
          getJSON("/api/xmr/network", { signal }),
          getJSON("/api/xmr/mempool", { signal }),
          getJSON("/api/xmr/blocks?limit=100", { signal }),
          getJSON(COINGECKO, { signal }),
        ]);
      } finally {
        clearTimeout(budget);
        lastRoundMs = Date.now() - started;
        inFlight = false;
        if (inFlightCtrl === ctrl) inFlightCtrl = null;
      }
      if (!alive) return;

      const src: SnapshotSources = {
        info: info as SnapshotSources["info"],
        network: network as SnapshotSources["network"],
        mempool: mempool as SnapshotSources["mempool"],
        blocks: blocks as SnapshotSources["blocks"],
        market: market as SnapshotSources["market"],
      };

      const gotChain = info || network || mempool || blocks;
      if (gotChain) {
        // chain data is reaching us → "rpc" (or "ws" once a socket message lands)
        chainFails = 0;
        setState((s) => ({
          ...mapToMoneroLive(s, src, s.source === "ws" ? "ws" : "rpc"),
          ready: true,
          marketReady: s.marketReady || !!market,
          stale: false,
        }));
      } else if (market) {
        // only the price proxy answered → market stays fresh, chain may go stale
        chainFails++;
        const chainStale = chainFails >= STALE_AFTER;
        setState((s) => ({
          ...s,
          ...mapMarket(market as never, s),
          source: "coingecko",
          marketReady: true,
          lastUpdate: Date.now(),
          stale: s.ready && chainStale,
          live: !(s.ready && chainStale),
        }));
      } else {
        // nothing answered → keep the last-good snapshot; flag stale once the
        // failure streak is established. Polling continues = auto-retry.
        chainFails++;
        if (chainFails >= STALE_AFTER) {
          setState((s) => (s.ready && !s.stale ? { ...s, stale: true, live: false } : s));
        }
      }
    }

    /**
     * How long to wait before the next round. Three independent brakes:
     *
     *  · backoff  — exponential on consecutive failures, so a dead endpoint is
     *    retried 2.5s / 5 / 10 / 20 / 30s rather than 24 times a minute.
     *  · jitter   — ±20%, so a fleet of Tor clients coming back from an outage
     *    doesn't thunder the same exit node in lockstep.
     *  · latency floor — never schedule sooner than the last round actually
     *    took. This is the single most valuable line for Tor: if a snapshot
     *    needed 9s, the next one is at least 9s out, so slow circuits
     *    self-tune instead of piling up. No configuration, no guessing.
     *
     * A hidden tab drops to HIDDEN_MS regardless — the biggest battery and
     * circuit win on mobile, which is the surface that was reported.
     */
    function nextDelay(): number {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return HIDDEN_MS;
      const backoff = Math.min(MAX_MS, BASE_MS * 2 ** Math.min(chainFails, 4));
      const jittered = backoff * (0.8 + Math.random() * 0.4);
      return Math.max(jittered, lastRoundMs);
    }

    function scheduleNext() {
      if (!alive) return;
      poll = setTimeout(tick, nextDelay());
    }

    async function tick() {
      if (!alive) return;
      try {
        await snapshot();
      } finally {
        scheduleNext();
      }
    }

    function startPolling() {
      if (polling || !alive) return;
      polling = true;
      void tick();
    }

    // Coming back to a backgrounded tab should feel instant, not "up to 60s
    // stale". Re-arm immediately on return rather than waiting out HIDDEN_MS.
    const onVisibility = () => {
      if (!alive || document.visibilityState !== "visible" || !polling) return;
      if (poll) clearTimeout(poll);
      void tick();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    // 2. Try the relay WS when explicitly configured, else poll. Each path owns
    //    exactly one immediate snapshot (the WS path primes here; the polling path
    //    primes inside startPolling), so first paint upgrades from skeletons
    //    without a redundant double-fetch.
    const url = relayWsUrl();
    if (url) {
      try {
        void snapshot();
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
          if (alive) startPolling();
        };
      } catch {
        startPolling();
      }
    } else {
      startPolling();
    }

    return () => {
      alive = false;
      if (poll) clearTimeout(poll);
      // Cancel any round still on the wire. Previously these ran to completion
      // after unmount — on Tor that could be another 10s of pointless circuit
      // traffic per navigation.
      inFlightCtrl?.abort();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  return state;
}
