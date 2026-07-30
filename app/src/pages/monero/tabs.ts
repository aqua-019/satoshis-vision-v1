/**
 * pages/monero/tabs.ts — tab metadata + shared tab props contract.
 *
 * The Monero surface is a tabbed section routed via /monero and /monero/:tab.
 * Every tab component takes the same props (data + navigate); tabs that don't
 * need them simply ignore them.
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
  { id: "markets", label: "Markets · thesis" },
  { id: "comparison", label: "vs Bitcoin" },
  { id: "attacks", label: "Attacks survived" },
  // "future" retired in v6.0.1 — the roadmap now has its own top-level page at
  // /future (live repo pulses + feeds). /monero/future redirects there; see App.tsx.
  { id: "bottomline", label: "Bottom Line" },
  { id: "outlook", label: "2027+ Outlook" },
];

/** Resolve a (possibly undefined) :tab param to a valid tab id, defaulting to overview. */
export function resolveTab(tab: string | undefined): string {
  return MONERO_TABS.some((t) => t.id === tab) ? (tab as string) : "overview";
}
