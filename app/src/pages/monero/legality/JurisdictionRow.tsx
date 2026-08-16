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
import type { LegalSource, MatrixRow } from "./data";

export interface JurisdictionRowProps {
  row: MatrixRow;
  open: boolean;
  onToggle: () => void;
}

function firstSentence(note: string): string {
  const m = note.match(/^[^.]+\./);
  return m ? m[0] : note;
}

/**
 * One citation. Linked and unlinked are the SAME chip with two treatments, so an
 * unlinked source reads as a deliberate state rather than a missing one.
 *
 * `.v6-res` and `.chip-row` are reused verbatim from the resource chips on
 * /future, /operate/superstress and /about/peers — the fourth consumer of a class
 * that is already cross-route. That reuse is not incidental: cssGz sits at 17,900
 * of 18,200, a margin of 300 B, and this PR adds no stylesheet rule at all.
 *
 * `rel="noopener noreferrer"` is load-bearing on THIS page rather than boilerplate.
 * `noreferrer` withholds the Referer header, so a regulator's server is not told
 * that its visitor arrived from a Monero legality page. On a site used over Tor
 * that is the difference between a citation and a disclosure.
 */
function SourceChip({ source }: { source: LegalSource }) {
  const [label, href] = source;
  if (href) {
    return (
      <a className="v6-res" data-lg-source="linked" href={href} target="_blank" rel="noopener noreferrer">
        {label} <span aria-hidden="true">↗</span>
      </a>
    );
  }
  return (
    <span
      className="v6-res"
      data-lg-source="unlinked"
      style={{ borderStyle: "dashed", color: "var(--ink-40)", cursor: "default" }}
    >
      {label}
      <span className="sr-only"> — named in this note, not linked</span>
    </span>
  );
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

          {/* Citations. A named-but-unlinked statute is a claim the reader cannot
              check, which on a legal surface is the same defect as an unsourced
              number on a live one. */}
          <div style={{ marginTop: 12 }}>
            <div className="kicker">Sources</div>
            <div className="chip-row" data-lg-sources style={{ marginTop: 6 }}>
              {row.sources.map((s) => <SourceChip key={s[0]} source={s} />)}
            </div>
            {/* Rendered IFF an unlinked source exists, so the sentence is never a
                standing disclaimer that has stopped describing the page. */}
            {row.sources.some(([, href]) => href === null) && (
              <p className="mono dim" data-lg-unlinked-note style={{ margin: "6px 0 0", fontSize: "var(--fs-label)", lineHeight: 1.5 }}>
                Dashed entries are named in the note above but carry no link — no
                primary source URL we can vouch for without guessing a path.
              </p>
            )}
          </div>

          {/* "note last updated", never "verified". The date is when this claim was
              last WRITTEN — a lower bound on staleness, not evidence anyone
              re-checked the law that day. See MatrixRow.reviewed. */}
          <p className="mono dim" data-lg-reviewed={row.reviewed} style={{ margin: "10px 0 0", fontSize: "var(--fs-label)", letterSpacing: "0.04em" }}>
            Note last updated {row.reviewed}
          </p>
        </div>
      )}
    </li>
  );
}
