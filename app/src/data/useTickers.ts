/**
 * data/useTickers.ts — REAL per-exchange volume/spread for the Markets surface.
 *
 * Fetches CoinGecko's /coins/monero/tickers through the same-origin proxy and
 * maps it to a compact per-venue shape. Degrades exactly like useMarketHistory:
 * failure → last-good cache ("stale"), no cache → "loading" + 45 s retry.
 * Refreshes every 5 minutes (the proxy edge-caches 120 s) — deliberately NOT
 * part of the 2.5 s chain poll loop.
 */

import * as React from "react";
import { cacheKey, readCache, writeCache, type SeriesStatus } from "./useMarketHistory";

export interface Ticker {
  /** exchange display name, e.g. "Kraken" */
  venue: string;
  /** CoinGecko market identifier, e.g. "kraken" */
  id: string;
  /** e.g. "XMR/USDT" */
  pair: string;
  /** 24h converted volume in USD */
  volUsd: number;
  /** bid/ask spread, percent */
  spreadPct: number;
  /** CoinGecko trust score: "green" | "yellow" | "red" | null */
  trust: string | null;
  /** flagged by CG as anomalous or not recently updated */
  anomalous: boolean;
}

export interface TickersResult {
  data: Ticker[];
  status: SeriesStatus;
}

interface CgTicker {
  base?: string;
  target?: string;
  market?: { name?: string; identifier?: string };
  converted_volume?: { usd?: number };
  bid_ask_spread_percentage?: number;
  trust_score?: string | null;
  is_anomaly?: boolean;
  is_stale?: boolean;
}

const KEY = cacheKey("tickers", "monero", "usd", 0);
const REFRESH_MS = 5 * 60_000;
const RETRY_MS = 45_000;

function safeStore(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function mapTickers(raw: unknown): Ticker[] {
  const list = (raw as { tickers?: CgTicker[] })?.tickers;
  if (!Array.isArray(list)) return [];
  return list
    .filter((t) => typeof t?.converted_volume?.usd === "number" && t.market?.name)
    .map((t) => ({
      venue: t.market?.name ?? "?",
      id: t.market?.identifier ?? "",
      pair: `${t.base ?? "XMR"}/${t.target ?? "?"}`,
      volUsd: t.converted_volume?.usd ?? 0,
      spreadPct: typeof t.bid_ask_spread_percentage === "number" ? t.bid_ask_spread_percentage : 0,
      trust: t.trust_score ?? null,
      anomalous: !!(t.is_anomaly || t.is_stale),
    }))
    .sort((a, b) => b.volUsd - a.volUsd);
}

export function useTickers(): TickersResult {
  const [result, setResult] = React.useState<TickersResult>(() => {
    const hit = readCache<Ticker[]>(safeStore(), KEY);
    return hit ? { data: hit.data, status: "stale" } : { data: [], status: "loading" };
  });

  React.useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      let nextDelay = REFRESH_MS;
      try {
        const r = await fetch("/api/coingecko?path=coins/monero/tickers");
        if (!r.ok) throw new Error(`CG ${r.status}`);
        const data = mapTickers(await r.json());
        if (data.length === 0) throw new Error("empty tickers");
        writeCache(safeStore(), KEY, data);
        if (alive) setResult({ data, status: "live" });
      } catch {
        nextDelay = RETRY_MS;
        if (alive) {
          setResult((prev) => {
            if (prev.data.length) return { data: prev.data, status: "stale" };
            const hit = readCache<Ticker[]>(safeStore(), KEY);
            return hit ? { data: hit.data, status: "stale" } : { data: [], status: "loading" };
          });
        }
      }
      if (alive) timer = setTimeout(run, nextDelay);
    };

    void run();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return result;
}
