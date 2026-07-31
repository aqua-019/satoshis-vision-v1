/**
 * pages/future/ProtoPopup.tsx — the protocol deep-dive dialog.
 *
 * Ported from the v6 future.jsx prototype's ProtoPopup. Two changes from the
 * prototype, both correctness:
 *
 *  - `navigate` is no longer a prop; it comes from useNavigate() here. The
 *    prototype threaded it down because its runtime had no router context.
 *  - The "RUN THE X SIMULATOR" button is gated on SIM_IDS. Only `fcmp` is
 *    actually registered in the /simulate chunk; SimulatePage falls back to
 *    the decoy sim for an unknown ?p=, so an ungated button would silently
 *    send you somewhere other than where it says. The other four protocols
 *    get a disabled SIMULATOR PENDING affordance instead — same yellow =
 *    not-wired-yet convention the automation registry uses.
 */

import * as React from "react";
import { useNavigate } from "react-router-dom";

import { useRepoPulse, agoStr, isStale } from "@/data/useCachedFeed";
import { V6Modal } from "./V6Modal";
import { FutureMini } from "./FutureMini";
import { SIM_IDS, type FutureProtocol } from "./data";

export interface ProtoPopupProps {
  p: FutureProtocol;
  onClose: () => void;
}

export function ProtoPopup({ p, onClose }: ProtoPopupProps) {
  const navigate = useNavigate();
  const pulse = useRepoPulse(p.repo);
  const titleId = React.useId();
  const hasSim = p.sim !== null && SIM_IDS.has(p.sim);
  const stale = pulse ? isStale(pulse.pushed) : false;

  return (
    <V6Modal open onClose={onClose} labelledBy={titleId}>
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
            style={{ margin: 0, fontSize: "clamp(28px, 2.6vw, 44px)", fontWeight: 400, color: "var(--ink-100)", lineHeight: 1.08 }}
          >
            <em style={{ fontStyle: "normal", color: p.c, textShadow: `0 0 14px ${p.c}66` }}>{p.tag}</em> — {p.head}
          </h2>
          <p className="mono" style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "var(--ink-60)", maxWidth: "84ch" }}>{p.lede}</p>
        </div>
        <button type="button" className="v6-x" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="v6-modal-body">
        <div className="col-2" style={{ gridTemplateColumns: "1.25fr 1fr", gap: 26, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {p.deep.map((par, i) => (
              <p key={i} className="mono" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.78, color: "var(--ink-80)" }}>{par}</p>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <FutureMini mode={p.mini} height={224} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {p.metrics.map(([k, v]) => (
                <div key={k} className="stat">
                  <div className="lbl">{k}</div>
                  <div className="val" style={{ fontSize: 15, color: p.c }}>{v}</div>
                </div>
              ))}
            </div>
            {hasSim ? (
              <button
                type="button"
                className="proto-btn"
                onClick={() => { onClose(); navigate("/simulate?p=" + p.sim); }}
                style={{ borderColor: p.c, color: p.c, boxShadow: `0 0 10px ${p.c}44` }}
              >
                ▶ RUN THE {p.tag.toUpperCase()} SIMULATOR
              </button>
            ) : (
              <button
                type="button"
                className="proto-btn"
                disabled
                title={`No ${p.tag} simulator exists yet — the /simulate chunk registers ${SIM_IDS.size} protocols and this is not one of them.`}
                style={{ borderColor: "var(--y-50)", color: "var(--y-50)" }}
              >
                {p.tag.toUpperCase()} SIMULATOR PENDING
              </button>
            )}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 18, display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "start" }}>
          <div>
            <div className="kicker" style={{ marginBottom: 10 }}>Community resources · canonical sources</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {p.resources.map(([label, href, kind]) => (
                <a key={href} className="v6-res" href={href} target="_blank" rel="noopener noreferrer">
                  <span className="led" style={{ background: p.c, boxShadow: `0 0 6px ${p.c}` }} />
                  {label} <span style={{ color: "var(--ink-40)" }}>· {kind} ↗</span>
                </a>
              ))}
            </div>
          </div>
          <div className="mono" style={{ fontSize: "var(--fs-mono)", color: "var(--ink-40)", textAlign: "right", lineHeight: 1.8 }}>
            <div className="kicker" style={{ marginBottom: 6 }}>Live repo pulse · {p.repo}</div>
            {pulse ? (
              <>
                <div>★ <b style={{ color: "var(--ink-80)" }}>{pulse.stars.toLocaleString()}</b> · open issues <b style={{ color: "var(--ink-80)" }}>{pulse.issues}</b></div>
                <div>
                  last push <b style={{ color: stale ? "var(--y-50)" : "var(--g-50)" }}>{agoStr(pulse.pushed)}</b>
                  {stale ? " · repo quiet" : ""} · refreshed every 24h via /api/feeds
                </div>
              </>
            ) : (
              <div>fetching via /api/feeds … <span className="dim2">(last-good cache shows when available)</span></div>
            )}
          </div>
        </div>
      </div>
    </V6Modal>
  );
}
