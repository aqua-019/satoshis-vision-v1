/**
 * pages/monero/legality/StatusChip.tsx — one chip, every presentation.
 * Used by matrix cells, the mobile headline, stacked panel rows, and the legend.
 */

import * as React from "react";
import { STATUS_META } from "./status";
import type { ActivityStatus } from "./data";

export interface StatusChipProps {
  status: ActivityStatus;
  /** Override the visible label (defaults to the status word, e.g. "Legal"). */
  label?: string;
  /** Screen-reader-only prefix, e.g. an activity name — without it, a row of
      five chips reads as five unlabelled statuses with no idea which is which. */
  srPrefix?: string;
  /** Full-width, centered — used on mobile so a chip can never clip. */
  block?: boolean;
}

export function StatusChip({ status, label, srPrefix, block }: StatusChipProps) {
  const meta = STATUS_META[status];
  const text = label ?? meta.label;
  // An explicit `label` means this chip is standing in for a headline reason
  // (the mobile primary datum) rather than a bare status word in a matrix
  // cell/legend/stacked row — bump it to the mono scale accordingly.
  const fontSize = label ? "var(--fs-mono)" : "var(--fs-label)";
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        width: block ? "100%" : undefined,
        justifyContent: block ? "center" : undefined,
        padding: "3px 8px", border: "1px solid " + meta.c, color: meta.c, borderRadius: 2,
        fontFamily: "var(--f-mono)", fontSize, letterSpacing: "0.08em", textTransform: "uppercase",
        background: status === "illegal" ? "color-mix(in srgb, var(--status-down) 6%, transparent)" : "transparent",
      }}
    >
      {srPrefix ? <span className="sr-only">{srPrefix}: </span> : null}
      <span style={{ width: 5, height: 5, borderRadius: 5, background: meta.c, boxShadow: `0 0 4px ${meta.c}`, flexShrink: 0 }} />
      {text}
    </span>
  );
}
