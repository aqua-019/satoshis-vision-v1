/**
 * pages/network/SyncShell.tsx — the D0993 node-sync shell.
 *
 * Height against the network tip, block-production velocity, and the census
 * read, composed so a **"your node" column slots in beside "the network"
 * without a redesign**.
 *
 * ── THE V7 SEAM IS STRUCTURAL, NOT PROMISED ───────────────────────────────
 *
 * This component maps over an ARRAY of column descriptors. Today that array
 * has exactly one entry, built by the page. When the operator points their own
 * monerod at the site, the second column is a second `SyncColumn` object —
 * a DATA addition to a list, not a rewrite of a layout. A reviewer can confirm
 * that by reading `columns.map(...)` below: there is no `if (haveOwnNode)`,
 * no left/right split, no `gridTemplateColumns: "1fr 1fr"` waiting to be
 * uncommented. The grid is `repeat(auto-fit, …)`, so one column fills the row
 * and two share it with no change here at all.
 *
 * That is the difference between a seam and a plan. A plan is a comment saying
 * where the second column would go; a seam is a shape in which the second
 * column requires no decision.
 *
 * ── NODE vs NETWORK, THE DISTINCTION THIS PAGE EXISTS TO KEEP STRAIGHT ─────
 *
 * Each column names its own provenance and they are deliberately not the same
 * word. NODE is telemetry from the node THIS SITE READS — the public cascade
 * behind `/api/xmr`. NETWORK is a census of the nodes it does NOT read,
 * sampled by monero.fail and proxied through `/api/nodes`. A future "your
 * node" column would be NODE-sourced too, and would sit beside this one
 * precisely so the reader can see two independent NODE readings disagree if
 * they ever do. The population panel's no-geography rule is untouched here:
 * nothing in this component reads or renders a location.
 */

import * as React from "react";
import { PanelFrame } from "@/design/primitives";
import { NodeProvenance } from "@/design/provenance";
import type { ProvSource } from "@/design/primitives";
import type { FeedPhase } from "@/data/feed-status";

/** Reserved height for one column's row stack. Quoted at the call site too. */
export const SYNC_COL_H = 168;

/** Minimum column width before the grid wraps to one per row. */
const COL_MIN_PX = 240;

export interface SyncRow {
  k: string;
  /** Already formatted, or an em-dash. A number is real or it is "—". */
  v: React.ReactNode;
  /** Dim trailing gloss, e.g. the source of the reading. */
  note?: string;
}

/**
 * One column. The whole v7 seam is that this is a plain object in an array.
 *
 * `pending` marks a column whose subject exists but whose data does not yet —
 * it renders dimmed with em-dashes and an explicit reason, the same treatment
 * the paused peer-telemetry panel already uses, rather than being absent.
 */
export interface SyncColumn {
  id: string;
  label: string;
  /** NODE for telemetry from a node; NETWORK for a census of nodes. */
  source: ProvSource;
  /** DERIVED. `verify-provenance` bans a literal here exactly as it bans
   *  `fresh="live"`. */
  phase: FeedPhase;
  detail?: string;
  rows: SyncRow[];
  pending?: string;
}

export function SyncShell({ columns }: { columns: readonly SyncColumn[] }) {
  return (
    <PanelFrame
      title="Node sync · height, velocity, census"
      right={<span className="dim">{columns.length === 1 ? "1 column · your node slots in beside" : `${columns.length} columns`}</span>}
    >
      <div
        data-sync-columns={columns.length}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(${COL_MIN_PX}px, 1fr))`,
          gap: 12,
          alignItems: "start",
        }}
      >
        {columns.map((c) => (
          <div
            key={c.id}
            data-sync-column={c.id}
            style={{ minHeight: SYNC_COL_H, opacity: c.pending ? 0.62 : 1 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
              <span className="kicker">{c.label}</span>
              <NodeProvenance source={c.source} phase={c.phase} detail={c.detail} />
            </div>

            <div
              className="mono keep-cols"
              style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "9px 10px", fontSize: "var(--fs-mono)", alignItems: "baseline" }}
            >
              {c.rows.map((r, i) => (
                <React.Fragment key={i}>
                  <span className="dim">
                    {r.k}
                    {r.note ? <span style={{ color: "var(--ink-40)" }}> · {r.note}</span> : null}
                  </span>
                  <span style={{ textAlign: "right", color: "var(--ink-80)", whiteSpace: "nowrap" }}>{r.v}</span>
                </React.Fragment>
              ))}
            </div>

            {c.pending ? (
              <p className="mono dim" style={{ fontSize: "var(--fs-body)", margin: "10px 0 0", lineHeight: 1.5, color: "var(--ink-40)" }}>
                {c.pending}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </PanelFrame>
  );
}
