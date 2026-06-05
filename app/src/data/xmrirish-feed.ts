/**
 * data/xmrirish-feed.ts — the single data seam wiring v5 to v4's backend.
 *
 * `useXmrIrishFeed()` returns the same MoneroLive shape the simulated feed does,
 * so the entire app (which reads via `useMoneroLive()`) is untouched. It:
 *
 *   1. seeds from SIM_SEED  → first paint is never empty (source "simulated").
 *   2. snapshots on mount   → Promise.all over v4's existing proxies, mapped
 *                             through map.ts (source "rpc" / "coingecko").
 *   3. takes live deltas    → over the optional relay WebSocket (source "ws"),
 *                             otherwise polls the snapshot every ~2.5s.
 *   4. degrades honestly    → WS → polling → simulated, flipping data.source /
 *                             data.live truthfully at every step.
 *
 * Privacy invariant: the browser only ever talks to same-origin /api/* (and the
 * relay WS). The dev proxy (vite.config.ts) keeps `npm run dev` same-origin too.
 * It never reaches a Monero RPC node or coingecko.com directly.
 */

import * as React from "react";
import type { MoneroLive } from "./types";
import { SIM_SEED } from "./simulated";
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
    readonly VITE_LIVE_DATA?: string;
    readonly VITE_RELAY_WS?: string;
    readonly VITE_API_ORIGIN?: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

const POLL_MS = 2500;
const COINGECKO =
  "/api/coingecko?path=simple/price&ids=monero,bitcoin&vs_currencies=usd&include_24hr_change=true";

/** GET helper that resolves to parsed JSON or null (never throws). */
async function getJSON<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(url, init);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** Resolve the relay WebSocket URL (same-origin /ws unless overridden). */
function relayWsUrl(): string | null {
  const override = import.meta.env.VITE_RELAY_WS as string | undefined;
  if (override) return override;
  if (typeof location === "undefined") return null;
  return location.origin.replace(/^http/, "ws") + "/ws";
}

export function useXmrIrishFeed(): MoneroLive {
  const [state, setState] = React.useState<MoneroLive>(() => ({
    ...SIM_SEED,
    source: "simulated",
    live: false,
    lastUpdate: Date.now(),
  }));

  React.useEffect(() => {
    let alive = true;
    let ws: WebSocket | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let polling = false;

    // 1. Snapshot over v4's existing proxies (same-origin).
    async function snapshot() {
      const [info, network, mempool, blocks, pools, market] = await Promise.all([
        getJSON("/api/monero", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method: "get_info" }),
        }),
        getJSON("/api/xmr/network"),
        getJSON("/api/xmr/mempool"),
        getJSON("/api/xmr/blocks?limit=14"),
        getJSON("/api/xmr/mining/pools"),
        getJSON(COINGECKO),
      ]);
      if (!alive) return;

      const src: SnapshotSources = {
        info: info as SnapshotSources["info"],
        network: network as SnapshotSources["network"],
        mempool: mempool as SnapshotSources["mempool"],
        blocks: blocks as SnapshotSources["blocks"],
        pools: pools as SnapshotSources["pools"],
        market: market as SnapshotSources["market"],
      };

      const gotChain = info || network || mempool || blocks || pools;
      if (gotChain) {
        // chain data is reaching us → "rpc" (or "ws" once a socket message lands)
        setState((s) => mapToMoneroLive(s, src, s.source === "ws" ? "ws" : "rpc"));
      } else if (market) {
        // only the price proxy answered → degrade to "coingecko"
        setState((s) => ({ ...s, ...mapMarket(market as never, s), source: "coingecko", live: true, lastUpdate: Date.now() }));
      }
      // nothing answered → leave prev state untouched (stays on the seed / sim)
    }

    function startPolling() {
      if (polling || !alive) return;
      polling = true;
      void snapshot();
      poll = setInterval(snapshot, POLL_MS);
    }

    // 2. Prime immediately, then 3. try the relay WS, else poll.
    void snapshot();

    const url = relayWsUrl();
    if (url) {
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
              setState((s) => applyWsBlock(s, m.data as never));
              break;
            case "mempool-update":
              setState((s) => applyWsMempool(s, m.data as never));
              break;
            case "network-update":
              setState((s) => applyWsNetwork(s, m.data as never));
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
      if (poll) clearInterval(poll);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  return state;
}
