/**
 * data/xmrirish-feed.ts — LIVE data hook for xmr.irish v5.
 *
 * This is the single seam between the v5 UI and v4's existing backend.
 * It returns the exact `MoneroLive` shape every view reads (see types.ts),
 * so NO view changes when you swap it in:
 *
 *   import { DataProvider } from "@/data/DataContext";
 *   import { useXmrIrishFeed } from "@/data/xmrirish-feed";
 *
 *   <DataProvider useFeed={useXmrIrishFeed}>
 *     <App />
 *   </DataProvider>
 *
 * Strategy (graceful degradation — see DATA_LAYER.md):
 *   1. Snapshot on mount via v4's same-origin /api/* proxies.
 *   2. Subscribe to the relay WebSocket for live block/tx/price deltas.
 *   3. If the relay is absent, fall back to polling the snapshot.
 *   4. Always seed from the simulated shape so the UI never flashes empty,
 *      and report `source`/`live` honestly so the LIVE badge can't lie.
 *
 * Endpoints are v4's existing surface (github.com/aqua-019/satoshis-vision-v1):
 *   POST /api/monero          JSON-RPC proxy (get_info, get_block_*, …)
 *   GET  /api/xmr/mempool     relay-bridge mempool snapshot
 *   GET  /api/xmr/blocks      recent blocks
 *   GET  /api/xmr/peers       connection list
 *   GET  /api/coingecko       price proxy (browser never hits CoinGecko on Tor)
 *   WSS  <origin>/ws          optional relay push (monerod --zmq-pub → WS)
 */

import * as React from "react";
import type { MoneroLive, Tx, Block, Peer, Pool } from "./types";
import { useSimulatedMoneroLive } from "./simulated";

// Tune to taste. Relay-push deployments rarely hit the poller at all.
const POLL_MS = 2500;
const SNAPSHOT_TIMEOUT_MS = 6000;

// ── tiny fetch helpers ───────────────────────────────────────────

async function jget<T>(url: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), SNAPSHOT_TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

const rpc = <T,>(method: string, params: unknown = {}) =>
  jget<{ result: T }>("/api/monero", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "0", method, params }),
  }).then((r) => r.result);

// ── mappers: v4 JSON → MoneroLive fields ─────────────────────────
// These are deliberately defensive: any missing field falls back to the
// previous (seeded) value, so a partial backend never blanks the UI.

function mapInfo(prev: MoneroLive, info: any): Partial<MoneroLive> {
  if (!info) return {};
  return {
    height: info.height ?? prev.height,
    hashrate: info.hashrate ?? info.difficulty / prev.blockTarget ?? prev.hashrate,
    difficulty: info.difficulty ?? prev.difficulty,
    nonce: info.nonce ?? prev.nonce,
    hardfork: info.hardfork ?? prev.hardfork,
    protocol: info.version ?? prev.protocol,
    peerIn: info.incoming_connections_count ?? prev.peerIn,
    peerOut: info.outgoing_connections_count ?? prev.peerOut,
  };
}

function mapMempool(prev: MoneroLive, pool: any): Partial<MoneroLive> {
  const raw: any[] = pool?.transactions ?? pool?.txs ?? [];
  if (!raw.length) return {};
  const mempool: Tx[] = raw.map((t, i) => {
    const size = t.blob_size ?? t.size ?? 1500;
    const fee = (t.fee ?? 0) / 1e12; // piconero → XMR
    return {
      id: t.id_hash ?? t.id ?? "",
      size,
      fee,
      ringSize: t.ring_size ?? 16,
      perB: size ? (t.fee ?? 0) / size : 0,
      age: t.receive_time ? Math.max(0, Date.now() / 1000 - t.receive_time) : i,
      inputs: t.inputs ?? 1,
      outputs: t.outputs ?? 2,
      seed: t.seed ?? i,
    };
  });
  return { mempool };
}

function mapBlocks(prev: MoneroLive, blocks: any[]): Partial<MoneroLive> {
  if (!blocks?.length) return {};
  const mapped: Block[] = blocks.map((b) => ({
    height: b.height,
    hash: b.hash ?? "",
    txs: b.num_txes ?? b.txs ?? 0,
    sizeKB: (b.block_size ?? b.size ?? 0) / 1024,
    reward: (b.reward ?? 0) / 1e12,
    difficulty: b.difficulty ?? prev.difficulty,
    pool: b.pool ?? "unknown",
    age: b.timestamp ? Math.max(0, Date.now() / 1000 - b.timestamp) : 0,
    conf: b.depth ?? 0,
  }));
  return { blocks: mapped };
}

function mapPeers(prev: MoneroLive, peers: any[]): Partial<MoneroLive> {
  if (!peers?.length) return {};
  const mapped: Peer[] = peers.map((p) => ({
    ip: p.host ?? p.ip ?? "0.0.0.0",
    port: p.port ?? 18080,
    h: p.height ?? prev.height,
    agent: p.agent ?? "monerod",
    lat: p.rtt ?? p.lat ?? 0,
    cnt: p.country ?? "??",
  }));
  return { peers: mapped };
}

function mapMarket(prev: MoneroLive, m: any): Partial<MoneroLive> {
  const xmr = m?.monero ?? m?.["monero"];
  const btc = m?.bitcoin ?? m?.["bitcoin"];
  if (!xmr && !btc) return {};
  const price = xmr?.usd ?? prev.price;
  const btcUsd = btc?.usd ?? prev.btc;
  return {
    price,
    change24h: xmr?.usd_24h_change ?? prev.change24h,
    btc: btcUsd,
    btcChg: btc?.usd_24h_change ?? prev.btcChg,
    btcRatio: btcUsd ? price / btcUsd : prev.btcRatio,
    priceSeries: [...prev.priceSeries.slice(-59), price],
  };
}

// ── the hook ─────────────────────────────────────────────────────

export function useXmrIrishFeed(): MoneroLive {
  // Seed from the simulated feed so every field is populated on frame 1.
  // We then overwrite fields as real data arrives and flip `source`/`live`.
  const seed = useSimulatedMoneroLive();
  const [state, setState] = React.useState<MoneroLive>(seed);
  const seededOnce = React.useRef(false);

  // Capture the very first simulated frame as our base, once.
  if (!seededOnce.current) {
    seededOnce.current = true;
  }

  React.useEffect(() => {
    let alive = true;
    let ws: WebSocket | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const merge = (patch: Partial<MoneroLive>, src: MoneroLive["source"]) =>
      setState((s) => ({ ...s, ...patch, source: src, live: true, lastUpdate: Date.now() }));

    async function snapshot() {
      try {
        const [info, pool, blocks, peers, market] = await Promise.allSettled([
          rpc<any>("get_info"),
          jget<any>("/api/xmr/mempool"),
          jget<any[]>("/api/xmr/blocks"),
          jget<any[]>("/api/xmr/peers"),
          jget<any>("/api/coingecko?ids=monero,bitcoin&vs_currencies=usd&include_24hr_change=true"),
        ]);
        if (!alive) return;
        setState((s) => {
          let next: MoneroLive = { ...s };
          if (info.status === "fulfilled")   next = { ...next, ...mapInfo(next, info.value) };
          if (pool.status === "fulfilled")   next = { ...next, ...mapMempool(next, pool.value) };
          if (blocks.status === "fulfilled") next = { ...next, ...mapBlocks(next, blocks.value) };
          if (peers.status === "fulfilled")  next = { ...next, ...mapPeers(next, peers.value) };
          if (market.status === "fulfilled") next = { ...next, ...mapMarket(next, market.value) };
          const anyLive = [info, pool, blocks, peers, market].some((r) => r.status === "fulfilled");
          return { ...next, source: anyLive ? "rpc" : "simulated", live: anyLive, lastUpdate: Date.now() };
        });
      } catch {
        /* keep prior state; stay on simulated */
      }
    }

    function startPolling() {
      if (poll) return;
      poll = setInterval(snapshot, POLL_MS);
    }

    // 1. Always take an immediate snapshot.
    snapshot();

    // 2. Try the relay WS for push; fall back to polling on any failure.
    try {
      const wsURL = `${location.origin.replace(/^http/, "ws")}/ws`;
      ws = new WebSocket(wsURL);
      ws.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data);
          if (m.type === "block") {
            setState((s) => ({
              ...s,
              height: m.payload.height ?? s.height,
              blocks: [mapBlocks(s, [m.payload]).blocks?.[0]!, ...s.blocks].filter(Boolean).slice(0, 14),
              hashSeries: [...s.hashSeries.slice(-59), m.payload.hashrate ?? s.hashrate],
              source: "ws", live: true, lastUpdate: Date.now(),
            }));
          } else if (m.type === "tx") {
            setState((s) => ({
              ...s,
              mempool: [...(mapMempool(s, { transactions: [m.payload] }).mempool ?? []), ...s.mempool].slice(0, 600),
              source: "ws", live: true, lastUpdate: Date.now(),
            }));
          } else if (m.type === "price") {
            merge(mapMarket(state, m.payload), "ws");
          }
        } catch { /* ignore malformed frame */ }
      };
      ws.onerror = () => { try { ws?.close(); } catch {} startPolling(); };
      ws.onclose = () => startPolling();
    } catch {
      startPolling();
    }

    return () => {
      alive = false;
      try { ws?.close(); } catch {}
      if (poll) clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
