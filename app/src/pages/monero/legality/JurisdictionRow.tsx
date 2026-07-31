/**
 * pages/monero/legality/JurisdictionRow.tsx — one row, two CSS presentations.
 * Desktop: 8-col grid row (flag, name, 5 chips, caret) + hover popover.
 * Mobile (≤768px): flag, name/reason, one headline chip; tap expands a panel.
 * The DOM tree is identical at both widths — only classes flip via CSS.
 */

import * as React from "react";
import { StatusChip } from "./StatusChip";
import { headlineOf } from "./status";
import { ACTIVITIES } from "./data";
import type { MatrixRow } from "./data";

export interface JurisdictionRowProps {
  row: MatrixRow;
  open: boolean;
  onToggle: () => void;
}

function firstSentence(note: string): string {
  const m = note.match(/^[^.]+\./);
  return m ? m[0] : note;
}

export function JurisdictionRow({ row, open, onToggle }: JurisdictionRowProps) {
  const btnId = React.useId();
  const panelId = React.useId();
  const h = headlineOf(row);

  return (
    <li className="lg-item">
      <button
        type="button"
        className="lg-row"
        id={btnId}
        aria-controls={panelId}
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="lg-flag" aria-hidden="true">{row.c}</span>
        <span className="lg-name">
          {row.n}
          <span className="lg-reason">{h.reason}</span>
        </span>
        <span className="lg-headline">
          <StatusChip status={h.status} label={h.reason} block />
        </span>
        <span className="lg-acts">
          {ACTIVITIES.map((a) => (
            <StatusChip key={a.key} status={row[a.key]} srPrefix={a.long} block />
          ))}
        </span>
        <span className="lg-caret" aria-hidden="true">{open ? "▾" : "▸"}</span>
        <span className="lg-pop" aria-hidden="true">{firstSentence(row.note)}</span>
      </button>
      {open && (
        <div className="lg-panel" id={panelId} role="region" aria-labelledby={btnId}>
          <dl className="lg-acts-stack">
            {ACTIVITIES.map((a) => (
              <div className="lg-act-row" key={a.key}>
                <dt>{a.long}</dt>
                <dd><StatusChip status={row[a.key]} /></dd>
              </div>
            ))}
          </dl>
          <p className="lg-note">{row.note}</p>
        </div>
      )}
    </li>
  );
}
