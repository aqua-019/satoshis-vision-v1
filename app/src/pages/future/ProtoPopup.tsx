/**
 * pages/future/ProtoPopup.tsx — the protocol deep-dive dialog.
 *
 * Ported from the v6 future.jsx prototype's ProtoPopup. Two changes from the
 * prototype, both correctness:
 *
 *  - `navigate` is no longer a prop; it comes from useNavigate() here. The
 *    prototype threaded it down because its runtime had no router context.
 *  - The "RUN THE X SIMULATOR" button is gated on SIM_IDS, so an ungated
 *    button can never send you somewhere other than where it says. An
 *    unregistered protocol gets a disabled SIMULATOR PENDING affordance
 *    instead — the same yellow = not-wired-yet convention the automation
 *    registry uses.
 *
 *    CORRECTED p4·06: this sentence used to say "Only `fcmp` is actually
 *    registered in the /simulate chunk". Measured — SIM_IDS has 21 members
 *    and ALL FIVE protocols are among them, so the PENDING branch is
 *    currently unreachable rather than the common case. The gate is still
 *    right and still worth keeping; only its stated reason had rotted.
 *
 *  - p4·06 moved everything below `v6-modal-head` into ./ProtocolDetail, so
 *    the /future/protocol page renders the identical body. See that file.
 */

import * as React from "react";

import { V6Modal } from "./V6Modal";
import { ProtocolDetail } from "./ProtocolDetail";
import { type FutureProtocol } from "./data";

export interface ProtoPopupProps {
  p: FutureProtocol;
  /** D0666: whether the dialog should be SHOWING — not whether it is
   *  mounted. V6Modal keeps its own `present` state so it can play an exit
   *  before unmounting, which only works if this component stays rendered
   *  across the close. FuturePage therefore holds the last-opened protocol
   *  and flips this to false rather than dropping <ProtoPopup> outright;
   *  hardcoding `open` here (as this file used to) would delete the exit
   *  frame again from one level up. */
  open: boolean;
  onClose: () => void;
  /** True while this popup is the TARGET of the card→modal shared-element
   *  morph (see FuturePage.tsx's `morph` state) — cleared once the opening
   *  transition settles, so the name does not linger on a modal that is
   *  just sitting open with no transition in flight. */
  morphed?: boolean;
}

export function ProtoPopup({ p, open, onClose, morphed }: ProtoPopupProps) {
  const titleId = React.useId();

  return (
    <V6Modal open={open} onClose={onClose} labelledBy={titleId}>
      <div className="v6-modal-head">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span className="v6-status" style={{ color: p.sc }}>
              <span className="led pulse" style={{ background: p.sc, boxShadow: `0 0 8px ${p.sc}`, margin: 0 }} />
              {p.status}
            </span>
            <span className="kicker">ETA {p.eta}</span>
          </div>
          <h2
            id={titleId}
            className="serif"
            style={{
              margin: 0,
              fontSize: "clamp(28px, 2.6vw, 44px)",
              fontWeight: 400,
              color: "var(--ink-100)",
              lineHeight: 1.08,
              // §6 shared-element morph target — the SAME name
              // pages/future/cards.tsx's <h3> carries while morphing, never
              // both at once. See that file's comment for why.
              viewTransitionName: morphed ? "proto-title" : undefined,
            }}
          >
            <em style={{ fontStyle: "normal", color: p.c, textShadow: `0 0 14px ${p.c}66` }}>{p.tag}</em> — {p.head}
          </h2>
          <p className="mono" style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "var(--ink-60)", maxWidth: "84ch" }}>{p.lede}</p>
        </div>
        <button type="button" className="v6-x" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <ProtocolDetail p={p} onNavigate={onClose} />
    </V6Modal>
  );
}
