/**
 * pages/monero/tabs.ts — tab metadata + shared tab props contract.
 *
 * The Monero surface is a tabbed section routed via /monero and /monero/:tab.
 * Every tab component takes the same props (data + navigate); tabs that don't
 * need them simply ignore them.
 *
 * v6.1.6: 9 → 7. "Markets · thesis" and "2027+ Outlook" moved out to their
 * own top-level pages — /live/markets/thesis and /future/outlook — as real
 * routes rather than Monero sub-tabs (MarketsThesisPage.tsx, OutlookPage.tsx).
 * Their components (MarketsThesisTab, OutlookTab) are NOT deleted; the new
 * pages mount them directly. /monero#markets-thesis and /monero#outlook
 * still work as a courtesy — MoneroPage.tsx reads the hash and forwards to
 * the new URL — since a fragment can be bookmarked or shared exactly like a
 * path, and this is the closest a client-only redirect gets to matching
 * vercel.json's server-side pattern for something a server can never see.
 */

import type { MoneroLive } from "@/data/types";

export interface MoneroTabProps {
  data: MoneroLive;
  navigate: (to: string) => void;
}

export interface MoneroTabMeta {
  id: string;
  label: string;
}

export const MONERO_TABS: readonly MoneroTabMeta[] = [
  { id: "overview", label: "Overview" },
  { id: "origin", label: "Origin" },
  { id: "tech", label: "Tech" },
  { id: "legality", label: "Legality" },
  { id: "comparison", label: "vs Bitcoin" },
  { id: "attacks", label: "Attacks survived" },
  // p4·M11 — the demand thesis. Sits between "Attacks survived" and "Bottom
  // Line" because it is the argument the bottom line concludes from. The tab
  // component is the only LAZY one on this page; see ThesisTab.tsx's header
  // for the measurement that forced it.
  { id: "thesis", label: "Thesis" },
  // "future" retired in v6.0.1 — the roadmap now has its own top-level page at
  // /future (live repo pulses + feeds). /monero/future redirects there; see App.tsx.
  { id: "bottomline", label: "Bottom Line" },
];

/** Resolve a (possibly undefined) :tab param to a valid tab id, defaulting to overview. */
export function resolveTab(tab: string | undefined): string {
  return MONERO_TABS.some((t) => t.id === tab) ? (tab as string) : "overview";
}
