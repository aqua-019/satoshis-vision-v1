/**
 * pages/monero/legality/StatusChip.tsx — one chip, every presentation.
 * Used by matrix cells, the mobile headline, stacked panel rows, and the legend.
 */

import * as React from "react";
import { STATUS_META } from "./status";
import type { StatusShape } from "./status";
import type { ActivityStatus } from "./data";

/**
 * The ONE mapping from shape token to geometry. Everything that draws a status
 * marker — matrix chips, the mobile headline, the stacked panel rows, the legend —
 * goes through here, so a reader who learns "diamond = restricted" in the legend
 * reads the same shape in the matrix.
 *
 * All inline: this ships JS bytes and ZERO stylesheet bytes, which is the trade the
 * cssGz budget wants (margin 300 B at 1d64871). `transform` is used for the diamond
 * rather than a rotated border because a transform does not affect layout, so the
 * four shapes occupy identical boxes and no chip changes width by status. The box is
 * over-sized against the painted mark for exactly that reason: a 45°-rotated square
 * of side S paints S·√2 across, so the box carries the diagonal and the diamond
 * cannot collide with the label at any status.
 */
const MARK_SIDE = 6;
const MARK_BOX = 9; // ceil(6 · √2) — holds the rotated diamond without clipping

export function StatusMark({ status }: { status: ActivityStatus }) {
  const { c, shape } = STATUS_META[status];
  const geometry: Record<StatusShape, React.CSSProperties> = {
    disc:    { borderRadius: "50%", background: c },
    ring:    { borderRadius: "50%", background: "transparent", border: `1.5px solid ${c}` },
    diamond: { borderRadius: 1, background: c, transform: "rotate(45deg)" },
    square:  { borderRadius: 1, background: c },
  };
  return (
    <span
      aria-hidden="true"
      style={{
        width: MARK_BOX, height: MARK_BOX, flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <span
        data-status-shape={shape}
        style={{
          width: MARK_SIDE, height: MARK_SIDE, boxShadow: `0 0 4px ${c}`,
          ...geometry[shape],
        }}
      />
    </span>
  );
}

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
      <StatusMark status={status} />
      {text}
    </span>
  );
}
