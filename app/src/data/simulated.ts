/**
 * data/simulated.ts — built-in simulated MoneroLive feed.
 *
 * Produces a realistic, deterministic-ish stream of mempool tx / block
 * activity. Used as the default when no host provider is supplied.
 *
 * Realism:
 *  - 64-char hex txids
 *  - Fee/byte ratios that look like real Monero txs (50–1000 piconero/B)
 *  - Block sizes derived from tx count + 0.6 XMR reward
 *  - Pool distribution = real recent shares (P2Pool, SupportXMR, etc.)
 *  - Hashrate series drifts plausibly
 *
 * Swap-in path: see PORTING.md → "live data".
 */

import * as React from "react";
import type { Block, MoneroLive, Peer, Pool, Tx } from "./types";
import { randHex } from "./types";

const SEED_HEIGHT = 3_676_070;

export const POOLS: Pool[] = [
  { name: "P2Pool",         share: 0.072, fee: 0.000, type: "decentralized", rec: true,  color: "#ff7a1a" },
  { name: "Nanopool",       share: 0.058, fee: 0.010, type: "centralized",   rec: false, color: "#5ed3f4" },
  { name: "SupportXMR",     share: 0.310, fee: 0.006, type: "centralized",   rec: false, color: "#ff4d6d" },
  { name: "MineXMR",        share: 0.018, fee: 0.010, type: "centralized",   rec: false, color: "#ffd400" },
  { name: "HashVault",      share: 0.042, fee: 0.009, type: "centralized",   rec: false, color: "#b87aff" },
  { name: "MoneroOcean",    share: 0.054, fee: 0.001, type: "decentralized", rec: false, color: "#4ade80" },
  { name: "Solo / Unknown", share: 0.446, fee: 0.000, type: "solo",          rec: false, color: "rgba(255,255,255,0.5)" },
];

export const PEERS: Peer[] = [
  { ip: "65.21.187.214",          port: 18080, h: SEED_HEIGHT,     agent: "monerod 0.18.4.0", lat: 42,  cnt: "DE" },
  { ip: "108.61.176.10",          port: 18080, h: SEED_HEIGHT,     agent: "monerod 0.18.3.4", lat: 88,  cnt: "US" },
  { ip: "5.9.84.122",             port: 18080, h: SEED_HEIGHT - 1, agent: "monerod 0.18.4.0", lat: 51,  cnt: "DE" },
  { ip: "176.9.34.221",           port: 18080, h: SEED_HEIGHT,     agent: "monerod 0.18.4.0", lat: 39,  cnt: "DE" },
  { ip: "37.187.74.171",          port: 18080, h: SEED_HEIGHT,     agent: "monerod 0.18.3.4", lat: 64,  cnt: "FR" },
  { ip: "159.203.62.18",          port: 18080, h: SEED_HEIGHT - 2, agent: "monerod 0.18.4.0", lat: 122, cnt: "CA" },
  { ip: "94.130.157.81",          port: 18080, h: SEED_HEIGHT,     agent: "monerod 0.18.4.0", lat: 57,  cnt: "DE" },
  { ip: "node.community.rino.io", port: 18080, h: SEED_HEIGHT,     agent: "monerod 0.18.4.0", lat: 71,  cnt: "EU" },
  { ip: "138.201.131.49",         port: 18080, h: SEED_HEIGHT,     agent: "monerod 0.18.4.0", lat: 48,  cnt: "DE" },
  { ip: "212.83.175.67",          port: 18080, h: SEED_HEIGHT,     agent: "monerod 0.18.4.0", lat: 92,  cnt: "FR" },
  { ip: "node.melo.tools",        port: 18080, h: SEED_HEIGHT,     agent: "monerod 0.18.4.0", lat: 67,  cnt: "US" },
  { ip: "xmr.suprnova.cc",        port: 18080, h: SEED_HEIGHT - 2, agent: "monerod 0.18.3.4", lat: 114, cnt: "NL" },
];

export function genTx(seed = Math.random()): Tx {
  const ringSize = 16;
  const fee = (50 + Math.pow(seed, 3) * 950) * 1e-7;
  return {
    id: randHex(64),
    size: 1500 + ((seed * 50) | 0) * 60,
    fee,
    ringSize,
    perB: (fee / (1500 + seed * 1500)) * 1e9,
    age: 0,
    inputs: 1 + ((seed * 4) | 0),
    outputs: 2,
    seed,
  };
}

function seedBlocks(count: number): Block[] {
  const arr: Block[] = [];
  const counts = [4, 17, 22, 39, 103, 7, 9, 47, 6, 140, 12, 18, 24];
  for (let i = 0; i < count; i++) {
    const h = SEED_HEIGHT - i;
    const txCount = counts[i % counts.length];
    const sizeKB = 6.8 + txCount * 1.4 + Math.random() * 8;
    arr.push({
      height: h,
      hash: randHex(64),
      txs: txCount,
      sizeKB,
      reward: 0.6 + Math.random() * 0.04,
      difficulty: 7.738e11 + (Math.random() - 0.5) * 2e9,
      pool: POOLS[Math.floor(Math.random() * POOLS.length)].name,
      age: i * 120 + Math.floor(Math.random() * 30),
      conf: i + 1,
    });
  }
  return arr;
}

function initialState(): MoneroLive {
  return {
    price: 394.53,
    change24h: 4.11,
    btcRatio: 0.005034,
    btc: 78368,
    btcChg: 0.44,
    height: SEED_HEIGHT,
    hashrate: 6.45e9,
    difficulty: 7.738e11,
    nonce: 65797,
    hardfork: "v16 (CLSAG + Bulletproofs+)",
    protocol: "v16",
    blockTarget: 120,
    peers: PEERS.slice(0, 12).map((p) => ({ ...p })),
    peerIn: 0,
    peerOut: 12,
    blocks: seedBlocks(14),
    mempool: Array.from({ length: 38 }, () => ({
      ...genTx(Math.random()),
      age: Math.floor(Math.random() * 240),
    })),
    poolDist: POOLS,
    hashSeries: Array.from({ length: 168 }, (_, i) => 6.1e9 + Math.sin(i * 0.2) * 0.3e9 + Math.random() * 0.2e9),
    priceSeries: Array.from({ length: 168 }, (_, i) => 380 + Math.sin(i * 0.18) * 18 + Math.cos(i * 0.07) * 12 + Math.random() * 4),
    feeHist: Array.from({ length: 32 }, (_, i) => Math.exp(-Math.pow((i - 8) / 7, 2)) * 100 + Math.random() * 8),
    live: false,
    source: "simulated",
    lastUpdate: Date.now(),
  };
}

/**
 * SIM_SEED — a single, module-load-time snapshot of the simulated shape.
 *
 * The live feed (`useXmrIrishFeed`) seeds its initial state from this so the
 * first paint is never empty, and any field v4 doesn't expose can be carried
 * over verbatim (peers list, sparkline series, etc.) instead of flashing NaN.
 */
export const SIM_SEED: MoneroLive = initialState();

/**
 * useSimulatedMoneroLive — drop-in hook that yields a live-feeling MoneroLive.
 *
 * Cadence:
 *  - new mempool tx every ~2.2s
 *  - new block every ~30s (10× wall-clock for visual interest)
 *  - CoinGecko price every 60s (CORS-open, no key)
 */
export function useSimulatedMoneroLive(): MoneroLive {
  const [state, setState] = React.useState<MoneroLive>(initialState);

  React.useEffect(() => {
    let cancelled = false;
    const fetchPrice = async () => {
      try {
        const r = await fetch(
          "/api/coingecko?path=simple/price&ids=monero,bitcoin&vs_currencies=usd&include_24hr_change=true"
        );
        if (!r.ok) throw new Error("CG " + r.status);
        const d = await r.json();
        if (cancelled) return;
        setState((s) => ({
          ...s,
          price: d.monero?.usd ?? s.price,
          change24h: d.monero?.usd_24h_change ?? s.change24h,
          btc: d.bitcoin?.usd ?? s.btc,
          btcChg: d.bitcoin?.usd_24h_change ?? s.btcChg,
          btcRatio: (d.monero?.usd ?? s.price) / (d.bitcoin?.usd ?? s.btc),
          live: true,
          source: "coingecko",
          lastUpdate: Date.now(),
        }));
      } catch { /* fall back to simulated */ }
    };
    void fetchPrice();
    const id = setInterval(fetchPrice, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  React.useEffect(() => {
    const id = setInterval(() => {
      setState((s) => {
        const newTx = Math.random() < 0.7 ? [genTx(Math.random())] : [];
        let mem = [...s.mempool.map((t) => ({ ...t, age: t.age + 2 })), ...newTx];
        if (Math.random() < 0.06 && mem.length > 4) {
          mem = mem.slice(0, Math.max(8, mem.length - 3));
        }
        const drift = (Math.random() - 0.5) * 0.3;
        const priceSeries = [...s.priceSeries.slice(-167), s.price + drift];
        return { ...s, mempool: mem, price: s.price + drift, priceSeries, lastUpdate: Date.now() };
      });
    }, 2200);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    const id = setInterval(() => {
      setState((s) => {
        const newH = s.height + 1;
        const nb: Block = {
          height: newH,
          hash: randHex(64),
          txs: 1 + Math.floor(Math.random() * 30),
          sizeKB: 8 + Math.random() * 80,
          reward: 0.6 + Math.random() * 0.04,
          difficulty: s.difficulty + (Math.random() - 0.5) * 2e9,
          pool: POOLS[Math.floor(Math.random() * POOLS.length)].name,
          age: 0,
          conf: 1,
        };
        const blocks = [nb, ...s.blocks.slice(0, 13).map((b) => ({ ...b, conf: b.conf + 1, age: b.age + 120 }))];
        return { ...s, height: newH, blocks };
      });
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  return state;
}
