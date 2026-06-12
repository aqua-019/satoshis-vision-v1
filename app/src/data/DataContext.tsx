/**
 * data/DataContext.tsx — pluggable provider for MoneroLive.
 *
 * Every view reads via `useMoneroLive()`. The default `<DataProvider>` runs the
 * real xmr.irish feed (`useXmrIrishFeed` — same-origin /api/* polling); pass
 * `useFeed` to swap in another live source (a host runtime, a relay, a worker).
 *
 * Drop-in for claude.ai / your worker:
 *
 *   import { DataProvider } from "@/data/DataContext";
 *   import { useYourLiveFeed } from "./your-feed";
 *
 *   <DataProvider useFeed={useYourLiveFeed}>
 *     <App />
 *   </DataProvider>
 *
 * Your hook MUST return a MoneroLive shape (see types.ts). It can subscribe
 * to a websocket, poll an RPC, or anything else — as long as it yields a
 * stable object each render and keeps `ready`/`marketReady`/`stale` truthful.
 *
 * Read README.md → "Plugging live data" for the suggested REST + WS surface.
 */

import * as React from "react";
import type { MoneroLive } from "./types";
import { useXmrIrishFeed } from "./xmrirish-feed";

const Ctx = React.createContext<MoneroLive | null>(null);

export interface DataProviderProps {
  /** Provide your own hook to swap in another live source. Defaults to the
   *  real xmr.irish feed. */
  useFeed?: () => MoneroLive;
  children: React.ReactNode;
}

export function DataProvider({ useFeed, children }: DataProviderProps) {
  const hook = useFeed ?? useXmrIrishFeed;
  const data = hook();
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

/** Read the current MoneroLive snapshot. Re-renders on every update. */
export function useMoneroLive(): MoneroLive {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useMoneroLive must be called within <DataProvider>");
  return v;
}
