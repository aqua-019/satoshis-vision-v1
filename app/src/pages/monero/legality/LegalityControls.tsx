/**
 * pages/monero/legality/LegalityControls.tsx — summary + filter chips + search.
 * Above the fold at every width. Every number here comes from `summarize()` —
 * none of it is a hardcoded jurisdiction count.
 */

import * as React from "react";
import { Card } from "@/design/primitives";
import { STATUS_META } from "./status";
import type { Summary } from "./status";
import type { ActivityStatus } from "./data";

export interface LegalityControlsProps {
  /** Summary over the FULL, unfiltered matrix — chip counts must not collapse as you filter. */
  summary: Summary;
  query: string;
  onQueryChange: (q: string) => void;
  active: ReadonlySet<ActivityStatus>;
  onToggleActive: (status: ActivityStatus) => void;
  resultCount: number;
}

const BUCKET_ORDER: { status: ActivityStatus; noun: string }[] = [
  { status: "legal", noun: "fully legal" },
  { status: "unclear", noun: "unclear" },
  { status: "restricted", noun: "restricted" },
  { status: "illegal", noun: "with an activity banned" },
];

export function LegalityControls({
  summary, query, onQueryChange, active, onToggleActive, resultCount,
}: LegalityControlsProps) {
  const summaryLine = BUCKET_ORDER
    .filter((b) => summary.counts[b.status] > 0)
    .map((b) => `${summary.counts[b.status]} ${b.noun}`)
    .join(" · ") + ` — of ${summary.total} jurisdictions`;

  const cexRestricted = summary.total - summary.activityLegal.cex;
  const thesisLine =
    `Holding is legal in ${summary.activityLegal.hold} of ${summary.total}. ` +
    `What's actually restricted is mostly exchange listing (${cexRestricted} of ${summary.total}).`;

  return (
    <Card style={{ padding: 18 }}>
      <div className="lg-controls">
        <div className="kicker">Legal status at a glance</div>
        <p className="mono" style={{ margin: 0, fontSize: "var(--fs-mono)", color: "var(--ink-100)", lineHeight: 1.5 }}>
          {summaryLine}
        </p>
        <p className="mono dim" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.6 }}>
          {thesisLine}
        </p>

        <div className="chip-row">
          {BUCKET_ORDER.map((b) => (
            <button
              key={b.status}
              type="button"
              className="lg-chip"
              aria-pressed={active.has(b.status)}
              onClick={() => onToggleActive(b.status)}
            >
              {STATUS_META[b.status].label} {summary.counts[b.status]}
            </button>
          ))}
          <label className="sr-only" htmlFor="lg-search-input">Search jurisdictions</label>
          <input
            id="lg-search-input"
            type="search"
            className="lg-search"
            placeholder="Search country, activity, note…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>

        <p aria-live="polite" aria-atomic="true" className="mono dim" style={{ margin: 0, fontSize: "var(--fs-label)", letterSpacing: "0.04em" }}>
          {resultCount} of {summary.total} jurisdictions shown
        </p>
      </div>
    </Card>
  );
}
