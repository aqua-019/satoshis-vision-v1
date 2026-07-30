/**
 * pages/future/EcoPopup.tsx — the ecosystem/partner brief dialog.
 *
 * Shared by FuturePage (the stressnet band) and TrustedPeersPage (the `our
 * brief` footer button on each partner card). Lives here rather than beside
 * either page so neither has to import the other — and so TrustedPeersPage
 * never transitively pulls in FutureMini's canvas code.
 *
 * v6.0.1 addition: when the entry carries a `url`, the dialog grows a
 * VISIT <NAME> ↗ anchor. Partner cards now open the partner's own site on
 * body click, so this dialog is the in-site brief that click used to show —
 * nothing that was reachable before became unreachable.
 */

import * as React from "react";
import { useNavigate } from "react-router-dom";

import { V6Modal } from "./V6Modal";
import { SIM_IDS, type EcoEntry } from "./data";

export interface EcoPopupProps {
  e: EcoEntry;
  onClose: () => void;
}

/** `/simulate?p=<id>` → <id>, so a simLink can be gated on SIM_IDS the same
 *  way ProtoPopup gates its button. SimulatePage silently falls back to the
 *  decoy sim for an unknown ?p=, so an unregistered link would mislead. */
function simIdOf(simLink: string | undefined): string | null {
  if (!simLink) return null;
  const id = simLink.split("?p=")[1];
  return id && SIM_IDS.has(id) ? id : null;
}

export function EcoPopup({ e, onClose }: EcoPopupProps) {
  const navigate = useNavigate();
  const titleId = React.useId();
  const simId = simIdOf(e.simLink);

  return (
    <V6Modal open onClose={onClose} labelledBy={titleId}>
      <div className="v6-modal-head">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="v6-status" style={{ color: e.c }}>
              <span className="led pulse" style={{ background: e.c, boxShadow: `0 0 8px ${e.c}`, margin: 0 }} />
              {e.status}
            </span>
            <span className="kicker">{e.kind}</span>
          </div>
          <h2
            id={titleId}
            className="serif"
            style={{ margin: 0, fontSize: "clamp(26px, 2.4vw, 40px)", fontWeight: 400, color: "var(--ink-100)" }}
          >
            <em style={{ fontStyle: "normal", color: e.c, textShadow: `0 0 14px ${e.c}66` }}>{e.name}</em> — {e.head}
          </h2>
        </div>
        <button type="button" className="v6-x" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="v6-modal-body">
        <div className="col-2" style={{ gridTemplateColumns: "1.2fr 1fr", gap: 26 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {e.body.map((par, i) => (
              <p key={i} className="mono" style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.78, color: "var(--ink-80)" }}>{par}</p>
            ))}
            {simId ? (
              <button
                type="button"
                className="proto-btn"
                onClick={() => { onClose(); navigate("/simulate?p=" + simId); }}
                style={{ alignSelf: "flex-start", borderColor: e.c, color: e.c, boxShadow: `0 0 10px ${e.c}44` }}
              >
                ▶ {e.simLabel}
              </button>
            ) : null}
            {e.url ? (
              <a
                className="proto-btn"
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ alignSelf: "flex-start", borderColor: e.c, color: e.c, boxShadow: `0 0 10px ${e.c}44` }}
              >
                VISIT {e.name.toUpperCase()} ↗
              </a>
            ) : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {e.slots.map((s, i) => (
              <div
                key={i}
                style={{
                  border: "1px dashed var(--ink-20)", height: s.h || 120,
                  display: "grid", placeItems: "center",
                  background: "repeating-linear-gradient(-45deg, rgba(255,255,255,0.015) 0 10px, rgba(255,255,255,0.04) 10px 20px)",
                }}
              >
                <span className="mono" style={{ fontSize: "var(--fs-label)", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-40)" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 16 }}>
          <div className="kicker" style={{ marginBottom: 10 }}>Links</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {e.links.map(([label, href]) =>
              href ? (
                <a key={label} className="v6-res" href={href} target="_blank" rel="noopener noreferrer">
                  <span className="led" style={{ background: e.c, boxShadow: `0 0 6px ${e.c}` }} />{label} ↗
                </a>
              ) : (
                /* Deliberate honest placeholder — these are links the partner
                   hasn't supplied yet, not an oversight. Do not invent URLs. */
                <span key={label} className="v6-res" style={{ borderStyle: "dashed", color: "var(--ink-40)", cursor: "default" }}>
                  {label} · <em style={{ fontStyle: "normal", color: "var(--y-50)" }}>link pending — send it over</em>
                </span>
              ),
            )}
          </div>
        </div>
      </div>
    </V6Modal>
  );
}
